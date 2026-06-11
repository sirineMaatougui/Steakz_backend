import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { conflict, notFound, unauthorized } from '../lib/AppError.js';
import type { JwtPayload } from '../types/index.js';

const BCRYPT_ROUNDS = 12;

/** Columns safe to return to clients (never the password hash). */
export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  branchId: true,
  createdAt: true,
  updatedAt: true,
} as const;

interface TokenUser {
  id: number;
  email: string;
  role: Role;
  branchId: number | null;
}

export function signToken(user: TokenUser): string {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    branchId: user.branchId,
  };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '8h' });
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw notFound('No account found with that email');
  }
  const matches = await bcrypt.compare(password, user.password);
  if (!matches) {
    throw unauthorized('Incorrect password');
  }
  const { password: _password, ...safe } = user;
  return { token: signToken(user), user: safe };
}

/** Public self-registration — always creates a CUSTOMER (no branch). */
export async function registerCustomer(input: { email: string; password: string; name: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw conflict('An account with that email already exists');
  }
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      role: Role.CUSTOMER,
      branchId: null,
      password: await hashPassword(input.password),
    },
    select: SAFE_USER_SELECT,
  });
  return { token: signToken(user), user };
}

export async function getProfile(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: SAFE_USER_SELECT,
  });
  if (!user) {
    throw notFound('User not found');
  }
  return user;
}
