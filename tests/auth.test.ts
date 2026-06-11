import request from 'supertest';
import { Role } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetDb, createUser, tokenFor } from './helpers.js';

const app = createApp();

beforeAll(async () => {
  await resetDb();
  await createUser({ email: 'waiter@steakz.co.uk', role: Role.WAITER, password: 'Secret@123', name: 'Test Waiter' });
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe('POST /api/v1/auth/login', () => {
  it('returns 200 + JWT for valid credentials (no password in payload)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'waiter@steakz.co.uk', password: 'Secret@123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.user.email).toBe('waiter@steakz.co.uk');
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('returns 401 for a wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'waiter@steakz.co.uk', password: 'WrongPass' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a non-existent email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@steakz.co.uk', password: 'whatever' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when fields are missing', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'waiter@steakz.co.uk' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/register', () => {
  it('returns 201 and creates a CUSTOMER with a token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'newcustomer@example.com', password: 'Customer@123', name: 'New Customer' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('CUSTOMER');
    expect(res.body.data.user.branchId).toBeNull();
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('returns 409 for a duplicate email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'newcustomer@example.com', password: 'Customer@123', name: 'Dup' });
    expect(res.status).toBe(409);
  });

  it('returns 400 for an invalid email or short password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: '123', name: 'Bad' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns 200 + own profile with a valid token', async () => {
    const user = await createUser({ email: 'me@steakz.co.uk', role: Role.CHEF, branchId: null });
    const token = tokenFor(user);
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('me@steakz.co.uk');
    expect(res.body.data.password).toBeUndefined();
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});
