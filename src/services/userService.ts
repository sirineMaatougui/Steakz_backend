import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { SAFE_USER_SELECT, hashPassword } from './authService.js';
import { badRequest, conflict, notFound } from '../lib/AppError.js';

const GLOBAL_ROLES: Role[] = [Role.ADMIN, Role.HQ_MANAGER, Role.CUSTOMER];

/** A branch-scoped role must have a branch; a global role must not. */
export function assertRoleBranchConsistency(role: Role, branchId: number | null): void {
  const isGlobal = GLOBAL_ROLES.includes(role);
  if (isGlobal && branchId !== null) {
    throw badRequest(`${role} accounts are not tied to a branch`);
  }
  if (!isGlobal && branchId === null) {
    throw badRequest(`${role} accounts require a branchId`);
  }
}

export async function listUsers(branchId?: number) {
  return prisma.user.findMany({
    where: branchId === undefined ? undefined : { branchId },
    select: SAFE_USER_SELECT,
    orderBy: { id: 'asc' },
  });
}

export async function getUser(id: number) {
  const user = await prisma.user.findUnique({ where: { id }, select: SAFE_USER_SELECT });
  if (!user) throw notFound('User not found');
  return user;
}

interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role: Role;
  branchId: number | null;
}

export async function createUser(input: CreateUserInput) {
  assertRoleBranchConsistency(input.role, input.branchId);
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict('An account with that email already exists');
  if (input.branchId !== null) {
    const branch = await prisma.branch.findUnique({ where: { id: input.branchId } });
    if (!branch) throw notFound('Branch not found');
  }
  return prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      role: input.role,
      branchId: input.branchId,
      password: await hashPassword(input.password),
    },
    select: SAFE_USER_SELECT,
  });
}

interface UpdateUserInput {
  name?: string;
  role?: Role;
  branchId?: number | null;
}

export async function updateUser(id: number, input: UpdateUserInput, actingUserId?: number) {
  const current = await getUser(id);
  if (actingUserId === id && input.role && input.role !== current.role) {
    throw badRequest('You cannot change your own role');
  }
  const role = input.role ?? current.role;
  const branchId = input.branchId !== undefined ? input.branchId : current.branchId;
  assertRoleBranchConsistency(role, branchId);
  return prisma.user.update({
    where: { id },
    data: { name: input.name, role: input.role, branchId: input.branchId },
    select: SAFE_USER_SELECT,
  });
}

export async function deleteUser(id: number, actingUserId: number): Promise<void> {
  if (id === actingUserId) throw badRequest('You cannot delete your own account');
  await getUser(id);
  await prisma.user.delete({ where: { id } });
}
