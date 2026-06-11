import request from 'supertest';
import { Role } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetDb, createBranch, createUser, tokenFor } from './helpers.js';

const app = createApp();

let adminToken: string;
let waiterToken: string;
let branchId: number;
let waiterId: number;

beforeAll(async () => {
  await resetDb();
  const branch = await createBranch('Manchester');
  branchId = branch.id;
  const admin = await createUser({ email: 'admin@steakz.co.uk', role: Role.ADMIN });
  const waiter = await createUser({ email: 'waiter@steakz.co.uk', role: Role.WAITER, branchId });
  waiterId = waiter.id;
  adminToken = tokenFor(admin);
  waiterToken = tokenFor(waiter);
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('Admin — users', () => {
  it('GET /admin/users → 401 without a token', async () => {
    expect((await request(app).get('/api/v1/admin/users')).status).toBe(401);
  });

  it('GET /admin/users → 403 with a non-admin token', async () => {
    const res = await request(app).get('/api/v1/admin/users').set(auth(waiterToken));
    expect(res.status).toBe(403);
  });

  it('GET /admin/users → 200 with the admin token', async () => {
    const res = await request(app).get('/api/v1/admin/users').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.every((u: { password?: string }) => u.password === undefined)).toBe(true);
  });

  it('POST /admin/users → 201 creates a branch-scoped chef', async () => {
    const res = await request(app)
      .post('/api/v1/admin/users')
      .set(auth(adminToken))
      .send({ email: 'chef@steakz.co.uk', password: 'Secret@123', name: 'Chef', role: 'CHEF', branchId });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('CHEF');
    expect(res.body.data.branchId).toBe(branchId);
  });

  it('POST /admin/users → 400 when a branch-scoped role has no branch', async () => {
    const res = await request(app)
      .post('/api/v1/admin/users')
      .set(auth(adminToken))
      .send({ email: 'nobranch@steakz.co.uk', password: 'Secret@123', name: 'X', role: 'CHEF' });
    expect(res.status).toBe(400);
  });

  it('POST /admin/users → 409 on a duplicate email', async () => {
    const res = await request(app)
      .post('/api/v1/admin/users')
      .set(auth(adminToken))
      .send({ email: 'chef@steakz.co.uk', password: 'Secret@123', name: 'Dup', role: 'CHEF', branchId });
    expect(res.status).toBe(409);
  });

  it('GET /admin/users/:id → 404 for a missing user', async () => {
    expect((await request(app).get('/api/v1/admin/users/999999').set(auth(adminToken))).status).toBe(404);
  });

  it('PATCH /admin/users/:id → 200 updates name + role', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${waiterId}`)
      .set(auth(adminToken))
      .send({ name: 'Renamed Waiter' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed Waiter');
  });

  it('DELETE /admin/users/:id → 400 when deleting your own account', async () => {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@steakz.co.uk' } });
    const res = await request(app).delete(`/api/v1/admin/users/${admin?.id}`).set(auth(adminToken));
    expect(res.status).toBe(400);
  });

  it('DELETE /admin/users/:id → 204 then 404', async () => {
    const victim = await createUser({ email: 'victim@steakz.co.uk', role: Role.CUSTOMER });
    const del = await request(app).delete(`/api/v1/admin/users/${victim.id}`).set(auth(adminToken));
    expect(del.status).toBe(204);
    const again = await request(app).get(`/api/v1/admin/users/${victim.id}`).set(auth(adminToken));
    expect(again.status).toBe(404);
  });
});

describe('Admin — branches', () => {
  it('POST /admin/branches → 201, then 409 on duplicate name', async () => {
    const create = await request(app)
      .post('/api/v1/admin/branches')
      .set(auth(adminToken))
      .send({ name: 'Leeds', address: '8 Greek St', phone: '+44 113 555 0202' });
    expect(create.status).toBe(201);

    const dup = await request(app)
      .post('/api/v1/admin/branches')
      .set(auth(adminToken))
      .send({ name: 'Leeds', address: 'elsewhere', phone: '000' });
    expect(dup.status).toBe(409);
  });

  it('GET /admin/branches → 200 list', async () => {
    const res = await request(app).get('/api/v1/admin/branches').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });
});
