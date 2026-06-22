import { prisma } from './database/prisma.js';
import { loadConfig } from './infrastructure/config/env.js';
import { buildServer } from './infrastructure/http/server.js';

const config = loadConfig();
const { app, coreService } = await buildServer(config);

await coreService.ensureDefaultUserAndGroup();

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  await prisma.$disconnect();
  process.exit(1);
}

const shutdown = async () => {
  await app.close();
  await prisma.$disconnect();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
