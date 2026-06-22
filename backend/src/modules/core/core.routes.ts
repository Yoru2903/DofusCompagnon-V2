import type { FastifyInstance } from 'fastify';
import { authMiddleware } from './core.middleware.js';
import type { CoreService } from './core.service.js';

export async function registerCoreRoutes(app: FastifyInstance, coreService: CoreService) {
  app.post('/api/auth/register', async (request) => {
    return coreService.createUser(request.body as never);
  });

  app.post('/api/auth/login', async (request) => {
    return coreService.login(request.body as never);
  });

  app.get('/api/auth/me', { preHandler: authMiddleware(coreService) }, async (request) => {
    return { user: request.currentUser };
  });

  app.get('/api/dev/default-session', async () => {
    return coreService.ensureDefaultUserAndGroup();
  });
}
