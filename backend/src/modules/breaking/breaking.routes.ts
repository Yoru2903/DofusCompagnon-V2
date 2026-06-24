import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../core/core.middleware.js';
import type { CoreService } from '../core/core.service.js';
import type { BreakingService } from './breaking.service.js';

export async function registerBreakingRoutes(
  app: FastifyInstance,
  service: BreakingService,
  coreService: CoreService,
) {
  const authenticate = { preHandler: authMiddleware(coreService) };

  app.get('/api/breaking/sessions', authenticate, async (request) =>
    service.listSessions(request.query as never),
  );
  app.post('/api/breaking/sessions', authenticate, async (request) =>
    service.createSession(request.body as never, request.currentUser!),
  );
  app.get('/api/breaking/sessions/:id', authenticate, async (request) =>
    service.getSession((request.params as { id: string }).id),
  );
  app.put('/api/breaking/sessions/:id', authenticate, async (request) =>
    service.updateSession((request.params as { id: string }).id, request.body as never),
  );
  app.delete('/api/breaking/sessions/:id', authenticate, async (request) =>
    service.deleteSession((request.params as { id: string }).id),
  );
  app.post('/api/breaking/sessions/:id/lines', authenticate, async (request) =>
    service.addLine(
      (request.params as { id: string }).id,
      request.body as never,
      request.currentUser!,
    ),
  );
  app.get('/api/breaking/craft-lines/available', authenticate, async () =>
    service.listAvailableCraftLines(),
  );
  app.get('/api/breaking/items/:itemId/runes', authenticate, async (request) =>
    service.previewItemRunes(
      {
        itemId: (request.params as { itemId: string }).itemId,
        quantity: Number((request.query as { quantity?: string }).quantity ?? 1),
        tauxBrisage: Number((request.query as { tauxBrisage?: string }).tauxBrisage ?? 0),
      },
      request.currentUser!,
    ),
  );
  app.post('/api/breaking/lines/:id/results', authenticate, async (request) =>
    service.addResults(
      (request.params as { id: string }).id,
      request.body as never,
      request.currentUser!,
    ),
  );
}
