import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../core/core.middleware.js';
import type { CoreService } from '../core/core.service.js';
import type { StockService } from './stock.service.js';

export async function registerStockRoutes(
  app: FastifyInstance,
  service: StockService,
  coreService: CoreService,
) {
  const authenticate = { preHandler: authMiddleware(coreService) };

  app.get('/api/stock/locations', authenticate, async () => service.listLocations());
  app.post('/api/stock/locations', authenticate, async (request) =>
    service.createLocation(request.body as never, request.currentUser!),
  );
  app.put('/api/stock/locations/:id', authenticate, async (request) =>
    service.updateLocation(
      (request.params as { id: string }).id,
      request.body as never,
      request.currentUser!,
    ),
  );
  app.delete('/api/stock/locations/:id', authenticate, async (request) =>
    service.deleteLocation((request.params as { id: string }).id),
  );
  app.post('/api/stock/movements', authenticate, async (request) =>
    service.addMovement(request.body as never, request.currentUser!),
  );
  app.get('/api/stock/locations/:id/inventory', authenticate, async (request) =>
    service.inventory((request.params as { id: string }).id, request.currentUser!),
  );
}
