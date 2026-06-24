import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../database/prisma.js';
import type { AuthenticatedUser } from '../modules/core/core.types.js';
import { PricesRepository } from '../modules/prices/prices.repository.js';
import { PricesService } from '../modules/prices/prices.service.js';
import { StockRepository } from '../modules/stock/stock.repository.js';
import { StockService } from '../modules/stock/stock.service.js';
import { TradeRepository } from '../modules/trade/trade.repository.js';
import { defaultHdvFeeRate, TradeService } from '../modules/trade/trade.service.js';

const pricesService = new PricesService(new PricesRepository(prisma), 7);
const stockService = new StockService(new StockRepository(prisma), pricesService);
const service = new TradeService(new TradeRepository(prisma), pricesService, stockService);

beforeEach(async () => {
  await prisma.simulation.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stockLocation.deleteMany();
  await prisma.tradeLine.deleteMany();
  await prisma.tradeSession.deleteMany();
  await prisma.breakingResult.deleteMany();
  await prisma.breakingSessionLine.deleteMany();
  await prisma.breakingSession.deleteMany();
  await prisma.craftSessionIngredient.deleteMany();
  await prisma.craftSessionLine.deleteMany();
  await prisma.craftSession.deleteMany();
  await prisma.economicSnapshot.deleteMany();
  await prisma.priceSnapshot.deleteMany();
  await prisma.runeCharacteristic.deleteMany();
  await prisma.itemEffect.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.importRecord.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.item.deleteMany();
  await prisma.characteristic.deleteMany();
  await prisma.job.deleteMany();
  await prisma.itemType.deleteMany();
  await prisma.dataSource.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();
});

describe('TradeService', () => {
  it('calculates expected gross and net margin with default fees', async () => {
    const { user, item } = await createFixture();
    const session = await service.createSession({ name: 'Trade previsionnel' }, user);

    const line = await service.addLine(
      session.id,
      {
        itemId: item.id,
        quantity: 2,
        unitBuyPrice: 100,
        expectedUnitSellPrice: 150,
      },
      user,
    );

    expect(line.status).toBe('pending');
    expect(line.fees).toBe(300 * defaultHdvFeeRate);
    expect(line.economicSnapshot?.dataJson).toMatchObject({
      type: 'previsionnel',
      grossProfitability: { benefit: 100, type: 'previsionnel' },
      netProfitability: { benefit: 94, type: 'previsionnel' },
    });
  });

  it('moves a pending line to sold and creates a stock out movement', async () => {
    const { user, item } = await createFixture();
    const session = await service.createSession({ name: 'Trade realise' }, user);
    const line = await service.addLine(
      session.id,
      { itemId: item.id, quantity: 1, unitBuyPrice: 100, expectedUnitSellPrice: 120 },
      user,
    );

    const result = await service.sellLine(line.id, { actualUnitSellPrice: 150 }, user);
    const movements = await prisma.stockMovement.findMany({ where: { relatedEntityId: line.id } });

    expect(result.line.status).toBe('sold');
    expect(result.grossProfitability.benefit).toBe(50);
    expect(result.netProfitability.benefit).toBe(47);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ movementType: 'out', quantity: 1 });
  });

  it('calculates negative realized ROI', async () => {
    const { user, item } = await createFixture();
    const session = await service.createSession({ name: 'Trade perte' }, user);
    const line = await service.addLine(
      session.id,
      { itemId: item.id, quantity: 1, unitBuyPrice: 100, expectedUnitSellPrice: 150 },
      user,
    );

    const result = await service.sellLine(line.id, { actualUnitSellPrice: 80 }, user);

    expect(result.netProfitability.benefit).toBeCloseTo(-21.6);
    expect(result.netProfitability.roi).toBeCloseTo(-21.6);
  });

  it('cancels a trade line', async () => {
    const { user, item } = await createFixture();
    const session = await service.createSession({ name: 'Trade annule' }, user);
    const line = await service.addLine(
      session.id,
      { itemId: item.id, quantity: 1, unitBuyPrice: 100, expectedUnitSellPrice: 150 },
      user,
    );

    const cancelled = await service.cancelLine(line.id);

    expect(cancelled.status).toBe('cancelled');
    await expect(
      service.sellLine(line.id, { actualUnitSellPrice: 150 }, user),
    ).rejects.toMatchObject({
      code: 'TRADE_LINE_CANCELLED',
    });
  });

  it('updates and soft-deletes trade sessions', async () => {
    const { user } = await createFixture();
    const session = await service.createSession({ name: 'Ancien trade' }, user);

    const updated = await service.updateSession(session.id, { name: 'Nouveau trade' });

    expect(updated.name).toBe('Nouveau trade');
    expect(await service.listSessions()).toHaveLength(1);

    await service.deleteSession(session.id);

    expect(await service.listSessions()).toHaveLength(0);
  });
});

async function createFixture() {
  const dbUser = await prisma.user.create({
    data: {
      username: `user-${randomUUID()}`,
      displayName: 'Trade User',
      email: `${randomUUID()}@example.test`,
      passwordHash: 'hash',
    },
  });
  const group = await prisma.group.create({ data: { name: 'Groupe trade', createdBy: dbUser.id } });
  await prisma.membership.create({ data: { userId: dbUser.id, groupId: group.id, role: 'admin' } });
  const item = await prisma.item.create({
    data: {
      name: 'Item trade',
      normalizedName: 'item trade',
      verificationStatus: 'verified',
      confidenceLevel: 'high',
    },
  });
  const user: AuthenticatedUser = {
    id: dbUser.id,
    username: dbUser.username,
    displayName: dbUser.displayName,
    email: dbUser.email,
    groupId: group.id,
    role: 'admin',
  };

  return { user, item };
}
