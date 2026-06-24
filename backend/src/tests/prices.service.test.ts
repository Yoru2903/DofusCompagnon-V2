import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../database/prisma.js';
import { PricesRepository } from '../modules/prices/prices.repository.js';
import { PricesService } from '../modules/prices/prices.service.js';
import type { AuthenticatedUser } from '../modules/core/core.types.js';

const service = new PricesService(new PricesRepository(prisma), 7);

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

describe('PricesService', () => {
  it('creates direct user price snapshots and keeps full history', async () => {
    const { user, item } = await createPriceFixture();

    await service.createPriceSnapshot(
      {
        itemId: item.id,
        unitPrice: 100,
        lotSize: 10,
        priceType: 'resource',
        scope: 'personal',
        observedAt: new Date('2026-06-01T10:00:00.000Z'),
      },
      user,
    );
    await service.createPriceSnapshot(
      {
        itemId: item.id,
        unitPrice: 125,
        lotSize: 10,
        priceType: 'resource',
        scope: 'personal',
        observedAt: new Date('2026-06-02T10:00:00.000Z'),
      },
      user,
    );

    const history = await service.listPriceHistory(item.id);

    expect(history).toHaveLength(2);
    expect(history[0]?.unitPrice).toBe(125);
    expect(history[1]?.unitPrice).toBe(100);
  });

  it('returns the latest known price with freshness metadata', async () => {
    const { user, item } = await createPriceFixture();
    const staleDate = new Date(Date.now() - 9 * 86_400_000);

    await service.createPriceSnapshot(
      {
        itemId: item.id,
        unitPrice: 42,
        lotSize: 1,
        priceType: 'rune',
        scope: 'group',
        observedAt: staleDate,
      },
      user,
    );

    const latest = await service.getLatestPrice(item.id, { priceType: 'rune', scope: 'group' });

    expect(latest?.unitPrice).toBe(42);
    expect(latest?.freshness.staleAfterDays).toBe(7);
    expect(latest?.freshness.isStale).toBe(true);
  });

  it('creates economic snapshots with calculation data frozen as JSON', async () => {
    const { user } = await createPriceFixture();
    const snapshot = await service.createEconomicSnapshot(
      {
        snapshotType: 'craft_calculation',
        dataJson: {
          prices: [{ itemId: 'res-1', unitPrice: 10, priceSnapshotId: 'price-1' }],
          result: { totalCost: 50 },
        },
      },
      user,
    );

    expect(snapshot.snapshotType).toBe('craft_calculation');
    expect(snapshot.dataJson).toMatchObject({
      prices: [{ itemId: 'res-1', unitPrice: 10, priceSnapshotId: 'price-1' }],
      result: { totalCost: 50 },
    });
  });

  it('rejects price creation for unknown items', async () => {
    const { user } = await createPriceFixture();

    await expect(
      service.createPriceSnapshot(
        {
          itemId: 'missing-item',
          unitPrice: 10,
          lotSize: 1,
          priceType: 'item',
          scope: 'personal',
        },
        user,
      ),
    ).rejects.toMatchObject({ code: 'ITEM_NOT_FOUND' });
  });
});

async function createPriceFixture() {
  const dbUser = await prisma.user.create({
    data: {
      username: `user-${randomUUID()}`,
      displayName: 'Testeur prix',
      email: `${randomUUID()}@example.test`,
      passwordHash: 'hash',
    },
  });
  const group = await prisma.group.create({
    data: {
      name: 'Groupe prix',
      createdBy: dbUser.id,
    },
  });
  await prisma.membership.create({
    data: {
      userId: dbUser.id,
      groupId: group.id,
      role: 'admin',
    },
  });
  const item = await prisma.item.create({
    data: {
      name: 'Rune test prix',
      normalizedName: 'rune test prix',
      isRune: true,
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

  return { user, item, group };
}
