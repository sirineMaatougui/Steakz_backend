import request from 'supertest';
import { Role } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetDb, createBranch, createUser, tokenFor } from './helpers.js';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

let branchId: number;
let otherMenuId: number;
let ribeyeId: number;
let friesId: number;
let waiterToken: string;
let chefToken: string;
let cashierToken: string;
let customerToken: string;

beforeAll(async () => {
  await resetDb();
  const manchester = await createBranch('Manchester');
  const leeds = await createBranch('Leeds');
  branchId = manchester.id;

  const ribeye = await prisma.menuItem.create({
    data: { branchId, name: 'Ribeye', description: 'Steak', price: 30, category: 'Steaks' },
  });
  const fries = await prisma.menuItem.create({
    data: { branchId, name: 'Fries', description: 'Side', price: 5, category: 'Sides' },
  });
  const leedsItem = await prisma.menuItem.create({
    data: { branchId: leeds.id, name: 'Leeds Steak', description: 'Steak', price: 30, category: 'Steaks' },
  });
  ribeyeId = ribeye.id;
  friesId = fries.id;
  otherMenuId = leedsItem.id;

  waiterToken = tokenFor(await createUser({ email: 'waiter@steakz.co.uk', role: Role.WAITER, branchId }));
  chefToken = tokenFor(await createUser({ email: 'chef@steakz.co.uk', role: Role.CHEF, branchId }));
  cashierToken = tokenFor(await createUser({ email: 'cashier@steakz.co.uk', role: Role.CASHIER, branchId }));
  customerToken = tokenFor(await createUser({ email: 'cust@example.com', role: Role.CUSTOMER }));
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe('Order lifecycle: waiter → kitchen → cashier', () => {
  let orderId: number;

  it('waiter creates an order and the total is computed (201)', async () => {
    const res = await request(app)
      .post('/api/v1/waiter/orders')
      .set(auth(waiterToken))
      .send({ type: 'DINE_IN', items: [{ menuItemId: ribeyeId, quantity: 2 }, { menuItemId: friesId, quantity: 1 }] });
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(65); // 2*30 + 1*5
    expect(res.body.data.items).toHaveLength(2);
    orderId = res.body.data.id;
  });

  it('waiter cannot add an item from another branch (400)', async () => {
    const res = await request(app)
      .post('/api/v1/waiter/orders')
      .set(auth(waiterToken))
      .send({ type: 'DINE_IN', items: [{ menuItemId: otherMenuId, quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  it('an empty order is rejected (400)', async () => {
    const res = await request(app)
      .post('/api/v1/waiter/orders')
      .set(auth(waiterToken))
      .send({ type: 'DINE_IN', items: [] });
    expect(res.status).toBe(400);
  });

  it('chef cannot skip straight from PENDING to READY (409)', async () => {
    const skip = await request(app)
      .patch(`/api/v1/kitchen/orders/${orderId}/status`)
      .set(auth(chefToken))
      .send({ status: 'READY' });
    expect(skip.status).toBe(409);
  });

  it('chef advances the order PENDING → PREPARING → READY (200)', async () => {
    const queue = await request(app).get('/api/v1/kitchen/orders').set(auth(chefToken));
    expect(queue.status).toBe(200);
    expect(queue.body.data.some((o: { id: number }) => o.id === orderId)).toBe(true);

    const prep = await request(app)
      .patch(`/api/v1/kitchen/orders/${orderId}/status`)
      .set(auth(chefToken))
      .send({ status: 'PREPARING' });
    expect(prep.status).toBe(200);

    const update = await request(app)
      .patch(`/api/v1/kitchen/orders/${orderId}/status`)
      .set(auth(chefToken))
      .send({ status: 'READY' });
    expect(update.status).toBe(200);
    expect(update.body.data.status).toBe('READY');
  });

  it('cashier takes payment (201) and a second payment is rejected (409)', async () => {
    const pay = await request(app)
      .post(`/api/v1/cashier/orders/${orderId}/payment`)
      .set(auth(cashierToken))
      .send({ method: 'CARD' });
    expect(pay.status).toBe(201);
    expect(pay.body.data.amount).toBe(65);

    const dup = await request(app)
      .post(`/api/v1/cashier/orders/${orderId}/payment`)
      .set(auth(cashierToken))
      .send({ method: 'CASH' });
    expect(dup.status).toBe(409);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe('PAID');
  });
});

describe('Customer self-service ordering', () => {
  it('a customer browses a branch menu and places a takeaway order (201)', async () => {
    const menu = await request(app).get(`/api/v1/customer/branches/${branchId}/menu`).set(auth(customerToken));
    expect(menu.status).toBe(200);
    expect(menu.body.data.length).toBeGreaterThan(0);

    const place = await request(app)
      .post('/api/v1/customer/orders')
      .set(auth(customerToken))
      .send({ branchId, type: 'TAKEAWAY', items: [{ menuItemId: ribeyeId, quantity: 1 }] });
    expect(place.status).toBe(201);
    expect(place.body.data.customer.email).toBe('cust@example.com');

    const mine = await request(app).get('/api/v1/customer/orders').set(auth(customerToken));
    expect(mine.status).toBe(200);
    expect(mine.body.data).toHaveLength(1);
  });

  it('a customer cannot reach waiter routes (403)', async () => {
    const res = await request(app).get('/api/v1/waiter/orders').set(auth(customerToken));
    expect(res.status).toBe(403);
  });
});
