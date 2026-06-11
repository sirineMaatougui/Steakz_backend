import { Role } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';
import { signToken, hashPassword } from '../src/services/authService.js';

/** Wipe all tables in FK-safe order. */
export async function resetDb(): Promise<void> {
  await prisma.payment.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
}

export async function createBranch(name: string) {
  return prisma.branch.create({
    data: { name, address: `${name} High Street`, phone: '+44 000 000 0000' },
  });
}

interface UserOpts {
  email: string;
  role: Role;
  branchId?: number | null;
  password?: string;
  name?: string;
}

export async function createUser(opts: UserOpts) {
  return prisma.user.create({
    data: {
      email: opts.email,
      name: opts.name ?? opts.email,
      role: opts.role,
      branchId: opts.branchId ?? null,
      password: await hashPassword(opts.password ?? 'Password@123'),
    },
  });
}

export function tokenFor(user: {
  id: number;
  email: string;
  role: Role;
  branchId: number | null;
}): string {
  return signToken(user);
}

/** Convenience: create a user and return [user, bearerToken]. */
export async function userWithToken(opts: UserOpts): Promise<[Awaited<ReturnType<typeof createUser>>, string]> {
  const user = await createUser(opts);
  return [user, tokenFor(user)];
}

export const bearer = (token: string): string => `Bearer ${token}`;
