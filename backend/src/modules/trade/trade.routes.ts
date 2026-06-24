import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../core/core.middleware.js';
import type { CoreService } from '../core/core.service.js';
import type { TradeService } from './trade.service.js';

export async function registerTradeRoutes(
  app: FastifyInstance,
  service: TradeService,
  coreService: CoreService,
) {
  const authenticate = { preHandler: authMiddleware(coreService) };

  app.get('/api/trade/sessions', authenticate, async () => service.listSessions());
  app.post('/api/trade/sessions', authenticate, async (request) =>
    service.createSession(request.body as never, request.currentUser!),
  );
  app.put('/api/trade/sessions/:id', authenticate, async (request) =>
    service.updateSession((request.params as { id: string }).id, request.body as never),
  );
  app.delete('/api/trade/sessions/:id', authenticate, async (request) =>
    service.deleteSession((request.params as { id: string }).id),
  );
  app.post('/api/trade/sessions/:id/lines', authenticate, async (request) =>
    service.addLine(
      (request.params as { id: string }).id,
      request.body as never,
      request.currentUser!,
    ),
  );
  app.post('/api/trade/lines/:id/sell', authenticate, async (request) =>
    service.sellLine(
      (request.params as { id: string }).id,
      request.body as never,
      request.currentUser!,
    ),
  );
  app.post('/api/trade/lines/:id/cancel', authenticate, async (request) =>
    service.cancelLine((request.params as { id: string }).id),
  );
}
