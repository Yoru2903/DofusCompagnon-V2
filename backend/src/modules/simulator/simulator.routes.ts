import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../core/core.middleware.js';
import type { CoreService } from '../core/core.service.js';
import type { SimulatorService } from './simulator.service.js';

export async function registerSimulatorRoutes(
  app: FastifyInstance,
  service: SimulatorService,
  coreService: CoreService,
) {
  const authenticate = { preHandler: authMiddleware(coreService) };

  app.post('/api/simulator/craft', authenticate, async (request) =>
    service.simulateCraft(request.body as never, request.currentUser!),
  );

  app.post('/api/simulator/breaking', authenticate, async (request) =>
    service.simulateBreaking(request.body as never, request.currentUser!),
  );

  app.post('/api/simulator/compare', authenticate, async (request) =>
    service.compareItems(request.body as never, request.currentUser!),
  );

  app.get('/api/simulator/simulations', authenticate, async (request) =>
    service.listSimulations(request.currentUser!),
  );
}
