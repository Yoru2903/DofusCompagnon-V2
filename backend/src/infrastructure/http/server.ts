import cors from '@fastify/cors';
import Fastify from 'fastify';
import { prisma } from '../../database/prisma.js';
import { BreakingRepository } from '../../modules/breaking/breaking.repository.js';
import { registerBreakingRoutes } from '../../modules/breaking/breaking.routes.js';
import { BreakingService } from '../../modules/breaking/breaking.service.js';
import { CoreRepository } from '../../modules/core/core.repository.js';
import { registerCoreRoutes } from '../../modules/core/core.routes.js';
import { CoreService } from '../../modules/core/core.service.js';
import { CraftRepository } from '../../modules/craft/craft.repository.js';
import { registerCraftRoutes } from '../../modules/craft/craft.routes.js';
import { CraftService } from '../../modules/craft/craft.service.js';
import { DashboardRepository } from '../../modules/dashboard/dashboard.repository.js';
import { registerDashboardRoutes } from '../../modules/dashboard/dashboard.routes.js';
import { DashboardService } from '../../modules/dashboard/dashboard.service.js';
import { DofusDataRepository } from '../../modules/dofus-data/dofus-data.repository.js';
import { registerDofusDataRoutes } from '../../modules/dofus-data/dofus-data.routes.js';
import { DofusDataService } from '../../modules/dofus-data/dofus-data.service.js';
import { PricesRepository } from '../../modules/prices/prices.repository.js';
import { registerPricesRoutes } from '../../modules/prices/prices.routes.js';
import { PricesService } from '../../modules/prices/prices.service.js';
import { StockRepository } from '../../modules/stock/stock.repository.js';
import { registerStockRoutes } from '../../modules/stock/stock.routes.js';
import { StockService } from '../../modules/stock/stock.service.js';
import { SimulatorRepository } from '../../modules/simulator/simulator.repository.js';
import { registerSimulatorRoutes } from '../../modules/simulator/simulator.routes.js';
import { SimulatorService } from '../../modules/simulator/simulator.service.js';
import { TradeRepository } from '../../modules/trade/trade.repository.js';
import { registerTradeRoutes } from '../../modules/trade/trade.routes.js';
import { TradeService } from '../../modules/trade/trade.service.js';
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
  const pricesRepository = new PricesRepository(prisma);
  const pricesService = new PricesService(pricesRepository);
  await registerPricesRoutes(app, pricesService, coreService);
  const stockRepository = new StockRepository(prisma);
  const stockService = new StockService(stockRepository, pricesService);
  await registerStockRoutes(app, stockService, coreService);
  const craftRepository = new CraftRepository(prisma);
  const craftService = new CraftService(craftRepository, pricesService, stockService);
  await registerCraftRoutes(app, craftService, coreService);
  const breakingRepository = new BreakingRepository(prisma);
  const breakingService = new BreakingService(breakingRepository, pricesService, stockService);
  await registerBreakingRoutes(app, breakingService, coreService);
  const tradeRepository = new TradeRepository(prisma);
  const tradeService = new TradeService(tradeRepository, pricesService, stockService);
  await registerTradeRoutes(app, tradeService, coreService);
  const dashboardRepository = new DashboardRepository(prisma);
  const dashboardService = new DashboardService(dashboardRepository);
  await registerDashboardRoutes(app, dashboardService, coreService);
  const simulatorRepository = new SimulatorRepository(prisma);
  const simulatorService = new SimulatorService(simulatorRepository, pricesService);
  await registerSimulatorRoutes(app, simulatorService, coreService);

  return { app, coreService };
}
