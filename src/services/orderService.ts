import { OrderStatus, OrderType, Role, DeliveryStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, notFound } from '../lib/AppError.js';
import { assertBranchAccess, assertOwnership } from '../lib/access.js';
import type { JwtPayload } from '../types/index.js';

export const ORDER_INCLUDE = {
  items: true,
  payment: true,
  delivery: { include: { driver: { select: { id: true, name: true } } } },
  branch: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true, email: true } },
  waiter: { select: { id: true, name: true } },
} as const;

interface OrderItemInput {
  menuItemId: number;
  quantity: number;
  notes?: string;
}

interface CreateOrderInput {
  branchId: number;
  type: OrderType;
  items: OrderItemInput[];
  customerId?: number | null;
  waiterId?: number | null;
  deliveryAddress?: string;
}

/**
 * Auto-assignment: pick the least-busy driver in a branch (fewest in-progress runs),
 * tie-broken by id for stable, fair rotation. Returns null if the branch has no drivers.
 */
export async function pickBranchDriver(branchId: number): Promise<number | null> {
  const drivers = await prisma.user.findMany({
    where: { branchId, role: Role.DELIVERY },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  if (drivers.length === 0) return null;

  const loads = await Promise.all(
    drivers.map(async (d) => ({
      id: d.id,
      active: await prisma.delivery.count({
        where: { driverId: d.id, status: { in: [DeliveryStatus.ASSIGNED, DeliveryStatus.OUT_FOR_DELIVERY] } },
      }),
    })),
  );
  loads.sort((a, b) => a.active - b.active || a.id - b.id);
  return loads[0].id;
}

export async function createOrder(input: CreateOrderInput) {
  if (input.items.length === 0) {
    throw badRequest('An order must contain at least one item');
  }
  if (input.type === OrderType.DELIVERY && !input.deliveryAddress) {
    throw badRequest('A delivery order requires a delivery address');
  }

  const ids = input.items.map((i) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: ids }, branchId: input.branchId },
  });
  const byId = new Map(menuItems.map((m) => [m.id, m]));

  let total = 0;
  const itemData = input.items.map((line) => {
    const item = byId.get(line.menuItemId);
    if (!item) throw badRequest(`Menu item ${line.menuItemId} is not on this branch's menu`);
    if (!item.available) throw badRequest(`${item.name} is currently unavailable`);
    if (line.quantity < 1) throw badRequest('Quantity must be at least 1');
    total += item.price * line.quantity;
    return {
      menuItemId: item.id,
      name: item.name,
      quantity: line.quantity,
      unitPrice: item.price,
      notes: line.notes ?? null,
    };
  });

  // A delivery order is auto-assigned the least-busy driver in its branch (a manager can reassign).
  const driverId =
    input.type === OrderType.DELIVERY && input.deliveryAddress ? await pickBranchDriver(input.branchId) : null;

  return prisma.order.create({
    data: {
      branchId: input.branchId,
      type: input.type,
      total: Math.round(total * 100) / 100,
      customerId: input.customerId ?? null,
      waiterId: input.waiterId ?? null,
      items: { create: itemData },
      delivery:
        input.type === OrderType.DELIVERY && input.deliveryAddress
          ? { create: { address: input.deliveryAddress, driverId } }
          : undefined,
    },
    include: ORDER_INCLUDE,
  });
}

interface ListOrderFilter {
  branchId?: number;
  customerId?: number;
  driverId?: number;
  statuses?: OrderStatus[];
}

export async function listOrders(filter: ListOrderFilter) {
  return prisma.order.findMany({
    where: {
      branchId: filter.branchId,
      customerId: filter.customerId,
      delivery: filter.driverId ? { driverId: filter.driverId } : undefined,
      status: filter.statuses ? { in: filter.statuses } : undefined,
    },
    include: ORDER_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

/** Fetch an order, enforcing branch isolation and (for customers) ownership. */
export async function getOrderForUser(user: JwtPayload, id: number) {
  const order = await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
  if (!order) throw notFound('Order not found');
  // Customers are scoped by ownership (they have no branch); staff by branch.
  if (user.role === Role.CUSTOMER) {
    assertOwnership(user, order.customerId);
  } else {
    assertBranchAccess(user, order.branchId);
  }
  return order;
}

/** Chef advances a ticket one valid step only: PENDING → PREPARING → READY. */
export async function advanceKitchenStatus(user: JwtPayload, id: number, target: OrderStatus) {
  const order = await getOrderForUser(user, id);
  const valid =
    (target === OrderStatus.PREPARING && order.status === OrderStatus.PENDING) ||
    (target === OrderStatus.READY && order.status === OrderStatus.PREPARING);
  if (!valid) {
    throw conflict(`Cannot move an order from ${order.status} to ${target}`);
  }
  return prisma.order.update({ where: { id: order.id }, data: { status: target }, include: ORDER_INCLUDE });
}

/** Waiter serves an order — only once the kitchen has marked it READY. */
export async function markServed(user: JwtPayload, id: number) {
  const order = await getOrderForUser(user, id);
  if (order.status !== OrderStatus.READY) {
    throw conflict('Only orders that are READY can be served');
  }
  return prisma.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.SERVED },
    include: ORDER_INCLUDE,
  });
}

/** Orders that can no longer be cancelled (already settled or finished). */
const NON_CANCELLABLE: OrderStatus[] = [OrderStatus.PAID, OrderStatus.DELIVERED, OrderStatus.CANCELLED];

/** A branch manager / admin cancels (voids) an order that is not yet paid or delivered. */
export async function cancelOrderByStaff(user: JwtPayload, id: number) {
  const order = await getOrderForUser(user, id); // enforces branch isolation for managers
  if (NON_CANCELLABLE.includes(order.status)) {
    throw conflict(`A ${order.status} order cannot be cancelled`);
  }
  return prisma.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.CANCELLED },
    include: ORDER_INCLUDE,
  });
}

/** A customer cancels their own order — only while it is still pending approval. */
export async function cancelOwnOrder(user: JwtPayload, id: number) {
  const order = await getOrderForUser(user, id); // enforces customer ownership
  if (order.status !== OrderStatus.PENDING) {
    throw conflict('Only orders still pending approval can be cancelled');
  }
  return prisma.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.CANCELLED },
    include: ORDER_INCLUDE,
  });
}
