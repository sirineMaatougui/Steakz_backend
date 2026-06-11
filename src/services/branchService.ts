import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/AppError.js';

export async function listBranches() {
  return prisma.branch.findMany({
    orderBy: { id: 'asc' },
    include: { _count: { select: { users: true, menuItems: true, orders: true } } },
  });
}

export async function getBranch(id: number) {
  const branch = await prisma.branch.findUnique({ where: { id } });
  if (!branch) throw notFound('Branch not found');
  return branch;
}

interface BranchInput {
  name: string;
  address: string;
  phone: string;
}

export async function createBranch(input: BranchInput) {
  // A duplicate name triggers Prisma P2002 → mapped to 409 by the error handler.
  return prisma.branch.create({ data: input });
}

export async function updateBranch(id: number, input: Partial<BranchInput>) {
  await getBranch(id);
  return prisma.branch.update({ where: { id }, data: input });
}

export async function deleteBranch(id: number): Promise<void> {
  await getBranch(id);
  await prisma.branch.delete({ where: { id } });
}
