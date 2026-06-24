import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../database/prisma.js';
import type { AuthenticatedUser } from '../modules/core/core.types.js';
import { PricesRepository } from '../modules/prices/prices.repository.js';
import { PricesService } from '../modules/prices/prices.service.js';
import { StockRepository } from '../modules/stock/stock.repository.js';
import { StockService } from '../modules/stock/stock.service.js';

const pricesService = new PricesService(new PricesRepository(prisma), 7);
const service = new StockService(new StockRepository(prisma), pricesService);

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

describe('StockService', () => {
  it('adds in and out movements and values stock with a known price', async () => {
    const { user, item } = await createFixture();
    const location = await service.createLocation({ name: 'Coffre', scope: 'group' }, user);
    await createPrice(user, item.id, 25);

    await service.addMovement(
      {
        stockLocationId: location.id,
        itemId: item.id,
        movementType: 'in',
        quantity: 5,
        unitValue: 10,
      },
      user,
    );
    await service.addMovement(
      {
        stockLocationId: location.id,
        itemId: item.id,
        movementType: 'out',
        quantity: 2,
        unitValue: 10,
      },
      user,
    );

    const inventory = await service.inventory(location.id, user);

    expect(inventory.items[0]).toMatchObject({
      itemId: item.id,
      quantity: 3,
      unitValue: 25,
      totalValue: 75,
    });
    expect(inventory.totalValue).toBe(75);
  });

  it('values stock with null item value when no price is known', async () => {
    const { user, item } = await createFixture();
    const location = await service.createLocation({ name: 'Coffre', scope: 'personal' }, user);

    await service.addMovement(
      {
        stockLocationId: location.id,
        itemId: item.id,
        movementType: 'in',
        quantity: 2,
        unitValue: 0,
      },
      user,
    );

    const inventory = await service.inventory(location.id, user);

    expect(inventory.items[0]?.unitValue).toBeNull();
    expect(inventory.items[0]?.totalValue).toBeNull();
    expect(inventory.totalValue).toBe(0);
  });

  it('keeps stock movement linked to a craft line after the source session is soft-deleted', async () => {
    const { user, item } = await createFixture();
    const location = await service.createLocation({ name: 'Coffre craft', scope: 'group' }, user);
    const craftLine = await createCraftLine(user, item.id);

    await service.addMovement(
      {
        stockLocationId: location.id,
        itemId: item.id,
        movementType: 'in',
        quantity: 1,
        unitValue: 100,
        relatedEntityType: 'craft_session_line',
        relatedEntityId: craftLine.id,
      },
      user,
    );
    await prisma.craftSession.update({
      where: { id: craftLine.craftSessionId },
      data: { deletedAt: new Date() },
    });

    const movements = await prisma.stockMovement.findMany({
      where: { relatedEntityId: craftLine.id },
    });

    expect(movements).toHaveLength(1);
    expect(movements[0]?.relatedEntityType).toBe('craft_session_line');
  });

  it('supports location update and soft delete', async () => {
    const { user } = await createFixture();
    const location = await service.createLocation({ name: 'Ancien coffre', scope: 'group' }, user);
    const updated = await service.updateLocation(location.id, { name: 'Nouveau coffre' }, user);

    expect(updated.name).toBe('Nouveau coffre');
    expect(await service.listLocations()).toHaveLength(1);

    await service.deleteLocation(location.id);

    expect(await service.listLocations()).toHaveLength(0);
  });

  it('records automatic movements for craft, breaking, breaking results, and trade sale', async () => {
    const { user, item } = await createFixture();
    const rune = await prisma.item.create({
      data: {
        name: 'Rune stock',
        normalizedName: 'rune stock',
        isRune: true,
        verificationStatus: 'verified',
        confidenceLevel: 'high',
      },
    });

    await service.recordCraftOutput(
      { id: 'craft-line-1', itemId: item.id, quantity: 2, unitCost: 50, totalCost: 100 },
      user,
    );
    await service.recordBreakingConsumption(
      { id: 'breaking-line-1', itemId: item.id, quantity: 1, unitCost: 50, totalCost: 50 },
      user,
    );
    await service.recordBreakingResult(
      { id: 'breaking-result-1', runeItemId: rune.id, quantity: 3, unitPrice: 20, totalValue: 60 },
      user,
    );
    await service.recordTradeSale(
      {
        id: 'trade-line-1',
        itemId: item.id,
        quantity: 1,
        actualUnitSellPrice: 80,
        actualTotalSellPrice: 80,
      },
      user,
    );

    const movements = await prisma.stockMovement.findMany({ orderBy: { createdAt: 'asc' } });

    expect(movements.map((movement) => movement.relatedEntityType)).toEqual([
      'craft_session_line',
      'breaking_session_line',
      'breaking_result',
      'trade_line',
    ]);
    expect(await service.listLocations()).toHaveLength(1);
  });
});

async function createFixture() {
  const dbUser = await prisma.user.create({
    data: {
      username: `user-${randomUUID()}`,
      displayName: 'Stock User',
      email: `${randomUUID()}@example.test`,
      passwordHash: 'hash',
    },
  });
  const group = await prisma.group.create({ data: { name: 'Groupe stock', createdBy: dbUser.id } });
  await prisma.membership.create({ data: { userId: dbUser.id, groupId: group.id, role: 'admin' } });
  const item = await prisma.item.create({
    data: {
      name: 'Item stock',
      normalizedName: 'item stock',
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

async function createPrice(user: AuthenticatedUser, itemId: string, unitPrice: number) {
  return prisma.priceSnapshot.create({
    data: {
      itemId,
      unitPrice,
      lotSize: 1,
      totalPrice: unitPrice,
      priceType: 'item',
      scope: 'group',
      userId: user.id,
      groupId: user.groupId,
      observedAt: new Date(),
    },
  });
}

async function createCraftLine(user: AuthenticatedUser, itemId: string) {
  const recipe = await prisma.recipe.create({
    data: {
      resultItemId: itemId,
      version: 1,
      verificationStatus: 'verified',
      confidenceLevel: 'high',
    },
  });
  const session = await prisma.craftSession.create({
    data: { userId: user.id, groupId: user.groupId, name: 'Craft source', sessionDate: new Date() },
  });

  return prisma.craftSessionLine.create({
    data: {
      craftSessionId: session.id,
      itemId,
      recipeId: recipe.id,
      quantity: 1,
      unitCost: 100,
      totalCost: 100,
      costSource: 'manual',
    },
  });
}
