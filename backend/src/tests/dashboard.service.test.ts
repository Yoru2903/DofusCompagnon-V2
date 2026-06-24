import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../database/prisma.js';
import { DashboardRepository } from '../modules/dashboard/dashboard.repository.js';
import { DashboardService } from '../modules/dashboard/dashboard.service.js';
import type { AuthenticatedUser } from '../modules/core/core.types.js';

const service = new DashboardService(new DashboardRepository(prisma));

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

describe('DashboardService', () => {
  it('calculates realized totals with mixed craft and trade sessions', async () => {
    await createDashboardFixture();

    const summary = await service.summary();

    expect(summary.resultType).toBe('realise');
    expect(summary.expensesTotal).toBe(300);
    expect(summary.gainsTotal).toBe(294);
    expect(summary.benefitTotal).toBe(-6);
  });

  it('filters realized operations by date range', async () => {
    await createDashboardFixture();

    const summary = await service.summary({
      dateFrom: new Date('2026-06-01T00:00:00.000Z'),
      dateTo: new Date('2026-06-30T23:59:59.999Z'),
    });

    expect(summary.operationCount).toBe(1);
    expect(summary.expensesTotal).toBe(100);
  });

  it('excludes forecast trade lines from realized KPIs and returns top/worst operations', async () => {
    await createDashboardFixture();

    const [summary, operations, evolution] = await Promise.all([
      service.summary({ operationType: 'trade' }),
      service.operations(),
      service.evolution({ period: 'month' }),
    ]);

    expect(summary.operationCount).toBe(1);
    expect(summary.benefitTotal).toBe(94);
    expect(operations.best.trade[0]?.benefit).toBe(94);
    expect(operations.worst[0]?.type).toBe('craft');
    expect(evolution.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ period: '2026-06' }),
        expect.objectContaining({ period: '2026-07' }),
      ]),
    );
  });
});

async function createDashboardFixture() {
  const { user } = await createUserAndGroup();
  const item = await prisma.item.create({
    data: {
      name: 'Item dashboard',
      normalizedName: 'item dashboard',
      verificationStatus: 'verified',
      confidenceLevel: 'high',
    },
  });
  const recipe = await prisma.recipe.create({
    data: {
      resultItemId: item.id,
      version: 1,
      verificationStatus: 'verified',
      confidenceLevel: 'high',
    },
  });
  const craftSession = await prisma.craftSession.create({
    data: {
      userId: user.id,
      groupId: user.groupId,
      name: 'Craft realise',
      sessionDate: new Date('2026-06-15T00:00:00.000Z'),
    },
  });
  await prisma.craftSessionLine.create({
    data: {
      craftSessionId: craftSession.id,
      itemId: item.id,
      recipeId: recipe.id,
      quantity: 1,
      unitCost: 100,
      totalCost: 100,
      costSource: 'manual',
    },
  });
  const tradeSession = await prisma.tradeSession.create({
    data: {
      userId: user.id,
      groupId: user.groupId,
      name: 'Trade realise',
      sessionDate: new Date('2026-07-01T00:00:00.000Z'),
    },
  });
  await prisma.tradeLine.create({
    data: {
      tradeSessionId: tradeSession.id,
      itemId: item.id,
      quantity: 2,
      unitBuyPrice: 100,
      totalBuyPrice: 200,
      expectedUnitSellPrice: 120,
      expectedTotalSellPrice: 240,
      actualUnitSellPrice: 150,
      actualTotalSellPrice: 300,
      feeRate: 0.02,
      fees: 6,
      status: 'sold',
    },
  });
  await prisma.tradeLine.create({
    data: {
      tradeSessionId: tradeSession.id,
      itemId: item.id,
      quantity: 1,
      unitBuyPrice: 1_000,
      totalBuyPrice: 1_000,
      expectedUnitSellPrice: 2_000,
      expectedTotalSellPrice: 2_000,
      feeRate: 0.02,
      fees: 40,
      status: 'pending',
    },
  });
}

async function createUserAndGroup() {
  const dbUser = await prisma.user.create({
    data: {
      username: `user-${randomUUID()}`,
      displayName: 'Dashboard User',
      email: `${randomUUID()}@example.test`,
      passwordHash: 'hash',
    },
  });
  const group = await prisma.group.create({ data: { name: 'Groupe dashboard', createdBy: dbUser.id } });
  await prisma.membership.create({ data: { userId: dbUser.id, groupId: group.id, role: 'admin' } });
  const user: AuthenticatedUser = {
    id: dbUser.id,
    username: dbUser.username,
    displayName: dbUser.displayName,
    email: dbUser.email,
    groupId: group.id,
    role: 'admin',
  };

  return { user };
}
