import cors from '@fastify/cors';
import Fastify from 'fastify';
import { prisma } from '../../database/prisma.js';
import { CoreRepository } from '../../modules/core/core.repository.js';
import { registerCoreRoutes } from '../../modules/core/core.routes.js';
import { CoreService } from '../../modules/core/core.service.js';
import { DofusDataRepository } from '../../modules/dofus-data/dofus-data.repository.js';
import { registerDofusDataRoutes } from '../../modules/dofus-data/dofus-data.routes.js';
import { DofusDataService } from '../../modules/dofus-data/dofus-data.service.js';
import { errorHandler } from '../../shared/errors/error-handler.js';
import type { AppConfig } from '../config/env.js';

export async function buildServer(config: AppConfig) {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: config.frontendOrigin,
  });

  app.setErrorHandler(errorHandler);

  app.get('/api/health', async () => ({
    status: 'ok',
    service: 'dofuscompagnon-backend',
  }));

  const coreRepository = new CoreRepository(prisma);
  const coreService = new CoreService(coreRepository, config.jwtSecret);
  await registerCoreRoutes(app, coreService);
  const dofusDataRepository = new DofusDataRepository(prisma);
  const dofusDataService = new DofusDataService(dofusDataRepository, prisma);
  await registerDofusDataRoutes(app, dofusDataService);

  return { app, coreService };
}
