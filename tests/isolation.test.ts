import request from 'supertest';
import { Role, OrderType, OrderStatus } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetDb, createBranch, createUser, tokenFor } from './helpers.js';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

let manchesterId: number;
let leedsId: number;
let mChefToken: string;
let lChefToken: string;
let mManagerToken: string;
let custAToken: string;
let custBToken: string;
let mMenuId: number;
let lMenuId: number;
let mOrderId: number;
let lOrderId: number;
let custAOrderId: number;
let custBOrderId: number;

async function makeMenuItem(branchId: number, name: string) {
  return prisma.menuItem.create({
    data: { branchId, name, description: name, price: 10, category: 'Steaks' },
  });
}

async function makeOrder(branchId: number, menuItemId: number, customerId: number | null) {
  return prisma.order.create({
    data: {
      branchId,
      customerId,
      type: OrderType.DINE_IN,
      status: OrderStatus.PENDING,
      total: 10,
      items: { create: [{ menuItemId, name: 'Item', quantity: 1, unitPrice: 10 }] },
    },
  });
}

beforeAll(async () => {
  await resetDb();
  const manchester = await createBranch('Manchester');
  const leeds = await createBranch('Leeds');
  manchesterId = manchester.id;
  leedsId = leeds.id;

  const mChef = await createUser({ email: 'chef.m@steakz.co.uk', role: Role.CHEF, branchId: manchesterId });
  const lChef = await createUser({ email: 'chef.l@steakz.co.uk', role: Role.CHEF, branchId: leedsId });
  const mManager = await createUser({ email: 'mgr.m@steakz.co.uk', role: Role.BRANCH_MANAGER, branchId: manchesterId });
  const custA = await createUser({ email: 'a@example.com', role: Role.CUSTOMER });
  const custB = await createUser({ email: 'b@example.com', role: Role.CUSTOMER });

  mChefToken = tokenFor(mChef);
  lChefToken = tokenFor(lChef);
  mManagerToken = tokenFor(mManager);
  custAToken = tokenFor(custA);
  custBToken = tokenFor(custB);

  mMenuId = (await makeMenuItem(manchesterId, 'Manchester Ribeye')).id;
  lMenuId = (await makeMenuItem(leedsId, 'Leeds Ribeye')).id;

  mOrderId = (await makeOrder(manchesterId, mMenuId, null)).id;
  lOrderId = (await makeOrder(leedsId, lMenuId, null)).id;
  custAOrderId = (await makeOrder(manchesterId, mMenuId, custA.id)).id;
  custBOrderId = (await makeOrder(leedsId, lMenuId, custB.id)).id;
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe('Branch isolation', () => {
  it('a branch manager only sees their OWN branch orders', async () => {
    const res = await request(app).get('/api/v1/branch/orders').set(auth(mManagerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((o: { branch: { name: string } }) => o.branch.name === 'Manchester')).toBe(true);
  });

  it('a Manchester chef CANNOT update a Leeds order (403)', async () => {
    const res = await request(app)
      .patch(`/api/v1/kitchen/orders/${lOrderId}/status`)
      .set(auth(mChefToken))
      .send({ status: 'PREPARING' });
    expect(res.status).toBe(403);
  });

  it('a Leeds chef CANNOT update a Manchester order (403)', async () => {
    const res = await request(app)
      .patch(`/api/v1/kitchen/orders/${mOrderId}/status`)
      .set(auth(lChefToken))
      .send({ status: 'PREPARING' });
    expect(res.status).toBe(403);
  });

  it('a Manchester chef CAN update a Manchester order (200)', async () => {
    const res = await request(app)
      .patch(`/api/v1/kitchen/orders/${mOrderId}/status`)
      .set(auth(mChefToken))
      .send({ status: 'PREPARING' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PREPARING');
  });

  it('a branch manager CANNOT edit another branch\'s menu item (403)', async () => {
    const res = await request(app)
      .patch(`/api/v1/branch/menu/${lMenuId}`)
      .set(auth(mManagerToken))
      .send({ price: 99 });
    expect(res.status).toBe(403);
  });

  it('a branch manager creates staff scoped to their OWN branch', async () => {
    const res = await request(app)
      .post('/api/v1/branch/staff')
      .set(auth(mManagerToken))
      .send({ email: 'newchef.m@steakz.co.uk', password: 'Secret@123', name: 'New Chef', role: 'CHEF' });
    expect(res.status).toBe(201);
    expect(res.body.data.branchId).toBe(manchesterId);
  });
});

describe('Customer ownership', () => {
  it('a customer CAN read their own order (200)', async () => {
    const res = await request(app).get(`/api/v1/customer/orders/${custAOrderId}`).set(auth(custAToken));
    expect(res.status).toBe(200);
  });

  it('a customer CANNOT read another customer\'s order (403)', async () => {
    const res = await request(app).get(`/api/v1/customer/orders/${custBOrderId}`).set(auth(custAToken));
    expect(res.status).toBe(403);
  });

  it('a customer only lists their OWN orders', async () => {
    const res = await request(app).get('/api/v1/customer/orders').set(auth(custBToken));
    expect(res.status).toBe(200);
    expect(res.body.data.every((o: { customer: { id: number } | null }) => o.customer?.id !== undefined)).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('Role + token guards', () => {
  it('no token → 401', async () => {
    expect((await request(app).get('/api/v1/branch/orders')).status).toBe(401);
  });

  it('wrong role (chef → admin route) → 403', async () => {
    const res = await request(app).get('/api/v1/admin/users').set(auth(mChefToken));
    expect(res.status).toBe(403);
  });

  it('HQ manager sees orders across ALL branches', async () => {
    const hq = await createUser({ email: 'hq@steakz.co.uk', role: Role.HQ_MANAGER });
    const res = await request(app).get('/api/v1/hq/orders').set(auth(tokenFor(hq)));
    expect(res.status).toBe(200);
    const branches = new Set(res.body.data.map((o: { branch: { name: string } }) => o.branch.name));
    expect(branches.has('Manchester')).toBe(true);
    expect(branches.has('Leeds')).toBe(true);
  });
});
