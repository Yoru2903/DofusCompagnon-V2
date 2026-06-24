import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../database/prisma.js';
import type { AuthenticatedUser } from '../modules/core/core.types.js';
import { CraftRepository } from '../modules/craft/craft.repository.js';
import { CraftService } from '../modules/craft/craft.service.js';
import { PricesRepository } from '../modules/prices/prices.repository.js';
import { PricesService } from '../modules/prices/prices.service.js';

const pricesService = new PricesService(new PricesRepository(prisma), 7);
const service = new CraftService(new CraftRepository(prisma), pricesService);

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

describe('CraftService', () => {
  it('calculates craft cost with theoretical prices only', async () => {
    const fixture = await createCraftFixture();
    await createResourcePrice(fixture.user, fixture.resourceA.id, 10);
    await createResourcePrice(fixture.user, fixture.resourceB.id, 5);
    const session = await service.createSession({ name: 'Session craft' }, fixture.user);

    const result = await service.addLine(
      session.id,
      {
        itemId: fixture.item.id,
        recipeId: fixture.recipe.id,
        quantity: 2,
        costSource: 'theoretical',
      },
      fixture.user,
    );

    expect(result.calculation.totalCost).toBe(60);
    expect(result.line.costSource).toBe('theoretical');
    expect(result.line.ingredients).toHaveLength(2);
    expect(
      await prisma.economicSnapshot.count({ where: { snapshotType: 'craft_calculation' } }),
    ).toBe(1);
  });

  it('lists recipes for a selected item with latest ingredient prices', async () => {
    const fixture = await createCraftFixture();
    await createResourcePrice(fixture.user, fixture.resourceA.id, 10);

    const recipes = await service.listRecipesForItem(fixture.item.id, fixture.user);

    expect(recipes).toHaveLength(1);
    expect(recipes[0]?.ingredients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ingredientItemId: fixture.resourceA.id,
          latestPrice: expect.objectContaining({ unitPrice: 10 }),
        }),
        expect.objectContaining({
          ingredientItemId: fixture.resourceB.id,
          latestPrice: null,
        }),
      ]),
    );
  });

  it('calculates craft cost with manual prices only', async () => {
    const fixture = await createCraftFixture();
    const session = await service.createSession({ name: 'Craft manuel' }, fixture.user);

    const result = await service.addLine(
      session.id,
      {
        itemId: fixture.item.id,
        recipeId: fixture.recipe.id,
        quantity: 1,
        costSource: 'manual',
        manualPrices: [
          { ingredientItemId: fixture.resourceA.id, unitPrice: 12 },
          { ingredientItemId: fixture.resourceB.id, unitPrice: 6 },
        ],
      },
      fixture.user,
    );

    expect(result.calculation.totalCost).toBe(36);
    expect(result.line.ingredients.every((ingredient) => ingredient.priceSnapshotId === null)).toBe(
      true,
    );
  });

  it('calculates mixed craft cost when one ingredient has no known price', async () => {
    const fixture = await createCraftFixture();
    await createResourcePrice(fixture.user, fixture.resourceA.id, 10);
    const session = await service.createSession({ name: 'Craft mixte' }, fixture.user);

    const result = await service.addLine(
      session.id,
      {
        itemId: fixture.item.id,
        recipeId: fixture.recipe.id,
        quantity: 1,
        costSource: 'mixed',
        manualPrices: [{ ingredientItemId: fixture.resourceB.id, unitPrice: 7 }],
      },
      fixture.user,
    );

    expect(result.calculation.totalCost).toBe(34);
    expect(result.line.costSource).toBe('mixed');
  });

  it('signals stale theoretical prices', async () => {
    const fixture = await createCraftFixture();
    await createResourcePrice(fixture.user, fixture.resourceA.id, 10, 9);
    await createResourcePrice(fixture.user, fixture.resourceB.id, 5);
    const session = await service.createSession({ name: 'Craft prix stale' }, fixture.user);

    const result = await service.addLine(
      session.id,
      {
        itemId: fixture.item.id,
        recipeId: fixture.recipe.id,
        quantity: 1,
        costSource: 'theoretical',
      },
      fixture.user,
    );

    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'stale_price', itemId: fixture.resourceA.id }),
      ]),
    );
  });

  it('signals imported crafted items', async () => {
    const fixture = await createCraftFixture({ itemVerificationStatus: 'imported' });
    await createResourcePrice(fixture.user, fixture.resourceA.id, 10);
    await createResourcePrice(fixture.user, fixture.resourceB.id, 5);
    const session = await service.createSession({ name: 'Craft imported' }, fixture.user);

    const result = await service.addLine(
      session.id,
      {
        itemId: fixture.item.id,
        recipeId: fixture.recipe.id,
        quantity: 1,
        costSource: 'theoretical',
      },
      fixture.user,
    );

    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'unverified_data', itemId: fixture.item.id }),
      ]),
    );
  });

  it('updates, lists, filters, computes stats, and soft-deletes sessions', async () => {
    const fixture = await createCraftFixture();
    await createResourcePrice(fixture.user, fixture.resourceA.id, 10);
    await createResourcePrice(fixture.user, fixture.resourceB.id, 5);
    const session = await service.createSession(
      { name: 'Historique craft', sessionDate: new Date('2026-06-01T00:00:00.000Z') },
      fixture.user,
    );
    await service.addLine(
      session.id,
      {
        itemId: fixture.item.id,
        recipeId: fixture.recipe.id,
        quantity: 1,
        costSource: 'theoretical',
      },
      fixture.user,
    );

    const updated = await service.updateSession(session.id, { name: 'Historique craft maj' });
    const filteredByName = await service.listSessions({ q: 'maj' });
    const filteredByItem = await service.listSessions({ itemId: fixture.item.id });
    const stats = await service.stats();

    expect(updated.name).toBe('Historique craft maj');
    expect(filteredByName).toHaveLength(1);
    expect(filteredByItem).toHaveLength(1);
    expect(stats.craftCount).toBe(1);
    expect(stats.averageUnitCost).toBe(30);
    expect(stats.evolution).toHaveLength(1);

    await service.deleteSession(session.id);

    expect(await service.listSessions()).toHaveLength(0);
  });

  it('fails cleanly when a theoretical price is missing', async () => {
    const fixture = await createCraftFixture();
    await createResourcePrice(fixture.user, fixture.resourceA.id, 10);
    const session = await service.createSession({ name: 'Craft incomplet' }, fixture.user);

    await expect(
      service.addLine(
        session.id,
        {
          itemId: fixture.item.id,
          recipeId: fixture.recipe.id,
          quantity: 1,
          costSource: 'theoretical',
        },
        fixture.user,
      ),
    ).rejects.toMatchObject({ code: 'PRICE_MISSING' });
  });
});

async function createCraftFixture(options: { itemVerificationStatus?: string } = {}) {
  const { user, dbUser, group } = await createUserAndGroup();
  const item = await prisma.item.create({
    data: {
      name: 'Cape craft',
      normalizedName: 'cape craft',
      isCraftable: true,
      verificationStatus: options.itemVerificationStatus ?? 'verified',
      confidenceLevel: 'high',
    },
  });
  const resourceA = await prisma.item.create({
    data: {
      name: 'Ressource A',
      normalizedName: 'ressource a',
      isResource: true,
      verificationStatus: 'verified',
      confidenceLevel: 'high',
    },
  });
  const resourceB = await prisma.item.create({
    data: {
      name: 'Ressource B',
      normalizedName: 'ressource b',
      isResource: true,
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
      ingredients: {
        create: [
          { ingredientItemId: resourceA.id, quantity: 2 },
          { ingredientItemId: resourceB.id, quantity: 2 },
        ],
      },
    },
  });

  return { user, dbUser, group, item, resourceA, resourceB, recipe };
}

async function createUserAndGroup() {
  const dbUser = await prisma.user.create({
    data: {
      username: `user-${randomUUID()}`,
      displayName: 'Craft User',
      email: `${randomUUID()}@example.test`,
      passwordHash: 'hash',
    },
  });
  const group = await prisma.group.create({
    data: {
      name: 'Groupe craft',
      createdBy: dbUser.id,
    },
  });
  await prisma.membership.create({
    data: { userId: dbUser.id, groupId: group.id, role: 'admin' },
  });
  const user: AuthenticatedUser = {
    id: dbUser.id,
    username: dbUser.username,
    displayName: dbUser.displayName,
    email: dbUser.email,
    groupId: group.id,
    role: 'admin',
  };

  return { user, dbUser, group };
}

async function createResourcePrice(
  user: AuthenticatedUser,
  itemId: string,
  unitPrice: number,
  ageDays = 0,
) {
  return prisma.priceSnapshot.create({
    data: {
      itemId,
      unitPrice,
      lotSize: 1,
      totalPrice: unitPrice,
      priceType: 'resource',
      scope: 'group',
      userId: user.id,
      groupId: user.groupId,
      observedAt: new Date(Date.now() - ageDays * 86_400_000),
    },
  });
}
