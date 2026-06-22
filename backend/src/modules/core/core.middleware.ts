import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '../../shared/errors/api-error.js';
import type { AuthenticatedUser } from './core.types.js';
import type { CoreService } from './core.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: AuthenticatedUser;
  }
}

export function authMiddleware(coreService: CoreService) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new ApiError(401, 'AUTH_MISSING_TOKEN', 'Authentification requise.');
    }

    const payload = coreService.validateJwt(header.slice('Bearer '.length));
    request.currentUser = await coreService.getAuthenticatedUser(payload);
  };
}
