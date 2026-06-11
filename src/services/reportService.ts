import { prisma } from '../lib/prisma.js';

/** Operational + tactical report for a single branch. */
export async function branchReport(branchId: number) {
  const [totalOrders, revenueAgg, byStatus, topItems] = await Promise.all([
    prisma.order.count({ where: { branchId } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { order: { branchId } } }),
    prisma.order.groupBy({ by: ['status'], where: { branchId }, _count: { _all: true } }),
    prisma.orderItem.groupBy({
      by: ['name'],
      where: { order: { branchId } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
  ]);

  return {
    branchId,
    totalOrders,
    totalRevenue: Math.round((revenueAgg._sum.amount ?? 0) * 100) / 100,
    ordersByStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
    topItems: topItems.map((t) => ({ name: t.name, quantity: t._sum.quantity ?? 0 })),
  };
}

/** Strategic, chain-wide report across all branches. */
export async function chainReport() {
  const branches = await prisma.branch.findMany({ orderBy: { id: 'asc' } });

  const perBranch = await Promise.all(
    branches.map(async (b) => {
      const [orders, revenue, customers] = await Promise.all([
        prisma.order.count({ where: { branchId: b.id } }),
        prisma.payment.aggregate({ _sum: { amount: true }, where: { order: { branchId: b.id } } }),
        prisma.user.count({ where: { branchId: b.id } }),
      ]);
      return {
        branchId: b.id,
        branch: b.name,
        orders,
        revenue: Math.round((revenue._sum.amount ?? 0) * 100) / 100,
        staff: customers,
      };
    }),
  );

  const totals = perBranch.reduce(
    (acc, x) => ({ orders: acc.orders + x.orders, revenue: acc.revenue + x.revenue }),
    { orders: 0, revenue: 0 },
  );
  totals.revenue = Math.round(totals.revenue * 100) / 100;

  return { perBranch, totals, branchCount: branches.length };
}
