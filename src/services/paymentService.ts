import { OrderStatus, PaymentMethod } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { conflict, notFound } from '../lib/AppError.js';
import { assertBranchAccess } from '../lib/access.js';
import type { JwtPayload } from '../types/index.js';

/** Record a payment for an order (one per order — duplicate → 409). */
export async function recordPayment(
  user: JwtPayload,
  orderId: number,
  method: PaymentMethod,
) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } });
  if (!order) throw notFound('Order not found');
  assertBranchAccess(user, order.branchId);
  if (order.status === OrderStatus.CANCELLED) throw conflict('Cannot take payment for a cancelled order');
  if (order.payment) throw conflict('This order has already been paid');

  const [payment] = await prisma.$transaction([
    prisma.payment.create({
      data: { orderId, cashierId: user.userId, amount: order.total, method },
    }),
    prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.PAID } }),
  ]);

  return payment;
}
