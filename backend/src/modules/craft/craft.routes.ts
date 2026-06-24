import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../core/core.middleware.js';
import type { CoreService } from '../core/core.service.js';
import type { CraftService } from './craft.service.js';

export async function registerCraftRoutes(
  app: FastifyInstance,
  service: CraftService,
  coreService: CoreService,
) {
  const authenticate = { preHandler: authMiddleware(coreService) };

  app.get('/api/craft/sessions', authenticate, async (request) =>
    service.listSessions(request.query as never),
  );
  app.post('/api/craft/sessions', authenticate, async (request) =>
    service.createSession(request.body as never, request.currentUser!),
  );
  app.get('/api/craft/sessions/:id', authenticate, async (request) =>
    service.getSession((request.params as { id: string }).id),
  );
  app.put('/api/craft/sessions/:id', authenticate, async (request) =>
    service.updateSession((request.params as { id: string }).id, request.body as never),
  );
  app.delete('/api/craft/sessions/:id', authenticate, async (request) =>
    service.deleteSession((request.params as { id: string }).id),
  );
  app.post('/api/craft/sessions/:id/lines', authenticate, async (request) =>
    service.addLine(
      (request.params as { id: string }).id,
      request.body as never,
      request.currentUser!,
    ),
  );
  app.get('/api/craft/items/:itemId/recipes', authenticate, async (request) =>
    service.listRecipesForItem((request.params as { itemId: string }).itemId, request.currentUser!),
  );
  app.get('/api/craft/stats', authenticate, async () => service.stats());
}
