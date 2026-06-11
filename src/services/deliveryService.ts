import { DeliveryStatus, OrderStatus, OrderType, Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, notFound } from '../lib/AppError.js';
import { assertBranchAccess } from '../lib/access.js';
import type { JwtPayload } from '../types/index.js';

const DELIVERY_INCLUDE = {
  order: { select: { id: true, branchId: true, total: true, status: true, type: true } },
  driver: { select: { id: true, name: true } },
} as const;

/** Deliveries for a branch, optionally limited to one driver. */
export async function listDeliveries(branchId: number, driverId?: number) {
  return prisma.delivery.findMany({
    where: { order: { branchId }, ...(driverId ? { driverId } : {}) },
    include: DELIVERY_INCLUDE,
    orderBy: { assignedAt: 'desc' },
  });
}

/**
 * Branch manager / admin assigns (or reassigns) a driver to a delivery order.
 * The driver must be a DELIVERY-role user in the same branch as the order.
 */
export async function assignDriverToOrder(user: JwtPayload, orderId: number, driverId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { delivery: true },
  });
  if (!order) throw notFound('Order not found');
  assertBranchAccess(user, order.branchId);
  if (order.type !== OrderType.DELIVERY || !order.delivery) {
    throw badRequest('This order is not a delivery order');
  }

  const driver = await prisma.user.findUnique({ where: { id: driverId } });
  if (!driver || driver.role !== Role.DELIVERY) {
    throw badRequest('Selected user is not a delivery driver');
  }
  if (driver.branchId !== order.branchId) {
    throw badRequest('That driver belongs to a different branch');
  }

  return prisma.delivery.update({
    where: { id: order.delivery.id },
    data: {
      driverId,
      // Bring an unstarted delivery back to ASSIGNED; leave in-progress runs untouched.
      status: order.delivery.status === DeliveryStatus.DELIVERED ? order.delivery.status : DeliveryStatus.ASSIGNED,
    },
    include: DELIVERY_INCLUDE,
  });
}

/** Update delivery status; keeps the parent order's status in sync. */
export async function updateDeliveryStatus(user: JwtPayload, deliveryId: number, status: DeliveryStatus) {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: { order: { select: { id: true, branchId: true } } },
  });
  if (!delivery) throw notFound('Delivery not found');
  assertBranchAccess(user, delivery.order.branchId);

  const orderStatus =
    status === DeliveryStatus.DELIVERED
      ? OrderStatus.DELIVERED
      : status === DeliveryStatus.OUT_FOR_DELIVERY
        ? OrderStatus.OUT_FOR_DELIVERY
        : undefined;

  const [updated] = await prisma.$transaction([
    prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status,
        deliveredAt: status === DeliveryStatus.DELIVERED ? new Date() : null,
      },
      include: DELIVERY_INCLUDE,
    }),
    ...(orderStatus
      ? [prisma.order.update({ where: { id: delivery.order.id }, data: { status: orderStatus } })]
      : []),
  ]);

  return updated;
}
