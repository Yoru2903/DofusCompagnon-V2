import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../core/core.middleware.js';
import type { CoreService } from '../core/core.service.js';
import type { DashboardService } from './dashboard.service.js';

export async function registerDashboardRoutes(
  app: FastifyInstance,
  service: DashboardService,
  coreService: CoreService,
) {
  const authenticate = { preHandler: authMiddleware(coreService) };

  app.get('/api/dashboard/summary', authenticate, async (request) =>
    service.summary(request.query as never),
  );

  app.get('/api/dashboard/operations', authenticate, async (request) =>
    service.operations(request.query as never),
  );

  app.get('/api/dashboard/evolution', authenticate, async (request) =>
    service.evolution(request.query as never),
  );
}
