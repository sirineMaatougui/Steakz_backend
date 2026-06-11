import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/AppError.js';
import { assertBranchAccess } from '../lib/access.js';
import type { JwtPayload } from '../types/index.js';

export async function listMenu(branchId: number, onlyAvailable = false) {
  return prisma.menuItem.findMany({
    where: { branchId, ...(onlyAvailable ? { available: true } : {}) },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
}

async function getOwnedItem(user: JwtPayload, id: number) {
  const item = await prisma.menuItem.findUnique({ where: { id } });
  if (!item) throw notFound('Menu item not found');
  assertBranchAccess(user, item.branchId);
  return item;
}

export async function getMenuItem(user: JwtPayload, id: number) {
  return getOwnedItem(user, id);
}

interface MenuInput {
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string | null;
  available?: boolean;
}

export async function createMenuItem(branchId: number, input: MenuInput) {
  return prisma.menuItem.create({ data: { ...input, branchId } });
}

export async function updateMenuItem(user: JwtPayload, id: number, input: Partial<MenuInput>) {
  await getOwnedItem(user, id);
  return prisma.menuItem.update({ where: { id }, data: input });
}

export async function deleteMenuItem(user: JwtPayload, id: number): Promise<void> {
  await getOwnedItem(user, id);
  await prisma.menuItem.delete({ where: { id } });
}
