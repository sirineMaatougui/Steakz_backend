import express, { type Express } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import hqRoutes from './routes/hqRoutes.js';
import branchRoutes from './routes/branchRoutes.js';
import waiterRoutes from './routes/waiterRoutes.js';
import kitchenRoutes from './routes/kitchenRoutes.js';
import cashierRoutes from './routes/cashierRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import customerRoutes from './routes/customerRoutes.js';

/**
 * Build the Express app. Exported as a factory so tests can mount it with
 * Supertest without binding a port.
 */
export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use(express.json());

  app.get('/api/v1/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', service: 'steakz-mis' } });
  });

  // Feature routes (grouped by access tier / role).
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/hq', hqRoutes);
  app.use('/api/v1/branch', branchRoutes);
  app.use('/api/v1/waiter', waiterRoutes);
  app.use('/api/v1/kitchen', kitchenRoutes);
  app.use('/api/v1/cashier', cashierRoutes);
  app.use('/api/v1/delivery', deliveryRoutes);
  app.use('/api/v1/customer', customerRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
