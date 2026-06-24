import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../core/core.middleware.js';
import type { CoreService } from '../core/core.service.js';
import type { PricesService } from './prices.service.js';

export async function registerPricesRoutes(
  app: FastifyInstance,
  service: PricesService,
  coreService: CoreService,
) {
  const authenticate = { preHandler: authMiddleware(coreService) };

  app.post('/api/prices', authenticate, async (request) =>
    service.createPriceSnapshot(request.body as never, request.currentUser!),
  );

  app.get('/api/prices/:itemId/history', authenticate, async (request) =>
    service.listPriceHistory((request.params as { itemId: string }).itemId),
  );

  app.get('/api/prices/:itemId/latest', authenticate, async (request) =>
    service.getLatestPrice((request.params as { itemId: string }).itemId, request.query as never),
  );

  app.post('/api/economic-snapshots', authenticate, async (request) =>
    service.createEconomicSnapshot(request.body as never, request.currentUser!),
  );
}
