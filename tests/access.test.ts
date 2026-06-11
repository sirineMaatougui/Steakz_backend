import request from 'supertest';
import { Role, OrderType, OrderStatus } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetDb, createBranch, createUser, tokenFor } from './helpers.js';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

let mId: number;
let lId: number;
let itemId: number;
let adminId: number;
let adminToken: string;
let managerToken: string;
let waiterToken: string;
let cashierToken: string;
let driverToken: string;
let customerToken: string;
let mDriverId: number;
let lDriverId: number;

beforeAll(async () => {
  await resetDb();
  const m = await createBranch('Manchester');
  const l = await createBranch('Leeds');
  mId = m.id;
  lId = l.id;

  const item = await prisma.menuItem.create({
    data: { branchId: mId, name: 'Ribeye', description: 'Steak', price: 20, category: 'Steaks' },
  });
  itemId = item.id;

  const admin = await createUser({ email: 'admin@s.uk', role: Role.ADMIN, branchId: null });
  adminId = admin.id;
  adminToken = tokenFor(admin);
  managerToken = tokenFor(await createUser({ email: 'mgr@s.uk', role: Role.BRANCH_MANAGER, branchId: mId }));
  waiterToken = tokenFor(await createUser({ email: 'wtr@s.uk', role: Role.WAITER, branchId: mId }));
  cashierToken = tokenFor(await createUser({ email: 'csh@s.uk', role: Role.CASHIER, branchId: mId }));
  const mDriver = await createUser({ email: 'mdrv@s.uk', role: Role.DELIVERY, branchId: mId });
  mDriverId = mDriver.id;
  driverToken = tokenFor(mDriver);
  lDriverId = (await createUser({ email: 'ldrv@s.uk', role: Role.DELIVERY, branchId: lId })).id;
  customerToken = tokenFor(await createUser({ email: 'cust@e.com', role: Role.CUSTOMER }));
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

async function placeDeliveryOrder(): Promise<number> {
  const res = await request(app)
    .post('/api/v1/customer/orders')
    .set(auth(customerToken))
    .send({ branchId: mId, type: 'DELIVERY', items: [{ menuItemId: itemId, quantity: 1 }], deliveryAddress: '1 Test St' });
  return res.body.data.id;
}

async function waiterDineIn(): Promise<number> {
  const res = await request(app)
    .post('/api/v1/waiter/orders')
    .set(auth(waiterToken))
    .send({ type: 'DINE_IN', items: [{ menuItemId: itemId, quantity: 1 }] });
  return res.body.data.id;
}

describe('Driver assignment (manager/admin only)', () => {
  it('a new delivery order is auto-assigned a branch driver (201)', async () => {
    const res = await request(app)
      .post('/api/v1/customer/orders')
      .set(auth(customerToken))
      .send({ branchId: mId, type: 'DELIVERY', items: [{ menuItemId: itemId, quantity: 1 }], deliveryAddress: '2 Auto St' });
    expect(res.status).toBe(201);
    expect(res.body.data.delivery.driver).not.toBeNull();
    expect(res.body.data.delivery.driver.id).toBe(mDriverId); // only Manchester driver in this fixture
  });

  it('manager assigns a branch driver to a delivery order, and the driver then sees it (200)', async () => {
    const orderId = await placeDeliveryOrder();
    const assign = await request(app)
      .patch(`/api/v1/branch/orders/${orderId}/assign`)
      .set(auth(managerToken))
      .send({ driverId: mDriverId });
    expect(assign.status).toBe(200);
    expect(assign.body.data.driver.id).toBe(mDriverId);

    const runs = await request(app).get('/api/v1/delivery/deliveries').set(auth(driverToken));
    expect(runs.body.data.some((d: { order: { id: number } }) => d.order.id === orderId)).toBe(true);
  });

  it('manager cannot assign a driver from another branch (400)', async () => {
    const orderId = await placeDeliveryOrder();
    const res = await request(app)
      .patch(`/api/v1/branch/orders/${orderId}/assign`)
      .set(auth(managerToken))
      .send({ driverId: lDriverId });
    expect(res.status).toBe(400);
  });

  it('a dine-in (non-delivery) order cannot be assigned a driver (400)', async () => {
    const orderId = await waiterDineIn();
    const res = await request(app)
      .patch(`/api/v1/branch/orders/${orderId}/assign`)
      .set(auth(managerToken))
      .send({ driverId: mDriverId });
    expect(res.status).toBe(400);
  });
});

describe('Order cancellation by staff', () => {
  it('manager cancels an unpaid order and the cashier can no longer charge it', async () => {
    const orderId = await waiterDineIn();
    const cancel = await request(app).patch(`/api/v1/branch/orders/${orderId}/cancel`).set(auth(managerToken));
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe('CANCELLED');

    const pay = await request(app)
      .post(`/api/v1/cashier/orders/${orderId}/payment`)
      .set(auth(cashierToken))
      .send({ method: 'CARD' });
    expect(pay.status).toBe(409);
  });

  it('a paid order cannot be cancelled (409)', async () => {
    const paid = await prisma.order.create({
      data: {
        branchId: mId,
        type: OrderType.DINE_IN,
        status: OrderStatus.PAID,
        total: 20,
        items: { create: [{ menuItemId: itemId, name: 'Ribeye', quantity: 1, unitPrice: 20 }] },
      },
    });
    const res = await request(app).patch(`/api/v1/branch/orders/${paid.id}/cancel`).set(auth(managerToken));
    expect(res.status).toBe(409);
  });

  it("a manager cannot cancel another branch's order (403)", async () => {
    const leedsOrder = await prisma.order.create({
      data: { branchId: lId, type: OrderType.DINE_IN, status: OrderStatus.PENDING, total: 10 },
    });
    const res = await request(app).patch(`/api/v1/branch/orders/${leedsOrder.id}/cancel`).set(auth(managerToken));
    expect(res.status).toBe(403);
  });
});

describe('State machine + least privilege', () => {
  it('a waiter cannot serve an order that is not READY (409)', async () => {
    const orderId = await waiterDineIn();
    const res = await request(app).patch(`/api/v1/waiter/orders/${orderId}/serve`).set(auth(waiterToken));
    expect(res.status).toBe(409);
  });

  it('a waiter cannot create a DELIVERY order (400)', async () => {
    const res = await request(app)
      .post('/api/v1/waiter/orders')
      .set(auth(waiterToken))
      .send({ type: 'DELIVERY', items: [{ menuItemId: itemId, quantity: 1 }], deliveryAddress: '1 Test St' });
    expect(res.status).toBe(400);
  });

  it('a branch manager cannot create another branch manager (400)', async () => {
    const res = await request(app)
      .post('/api/v1/branch/staff')
      .set(auth(managerToken))
      .send({ name: 'X', email: 'x2mgr@s.uk', password: 'Password@123', role: 'BRANCH_MANAGER' });
    expect(res.status).toBe(400);
  });

  it('an admin cannot change their own role (400)', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${adminId}`)
      .set(auth(adminToken))
      .send({ role: 'WAITER' });
    expect(res.status).toBe(400);
  });
});
