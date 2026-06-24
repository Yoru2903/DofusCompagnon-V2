import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../database/prisma.js';
import type { AuthenticatedUser } from '../modules/core/core.types.js';
import { PricesRepository } from '../modules/prices/prices.repository.js';
import { PricesService } from '../modules/prices/prices.service.js';
import { SimulatorRepository } from '../modules/simulator/simulator.repository.js';
import { SimulatorService } from '../modules/simulator/simulator.service.js';

const pricesService = new PricesService(new PricesRepository(prisma), 7);
const service = new SimulatorService(new SimulatorRepository(prisma), pricesService);

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

describe('SimulatorService', () => {
  it('simulates craft cost with known resource prices', async () => {
    const fixture = await createSimulatorFixture();
    await createPrice(fixture.user, fixture.resourceA.id, 'resource', 10);
    await createPrice(fixture.user, fixture.resourceB.id, 'resource', 5);

    const result = await service.simulateCraft(
      { itemId: fixture.item.id, quantity: 2 },
      fixture.user,
    );

    expect(result.calculation?.totalCost).toBe(60);
    expect(result.missingPrices).toHaveLength(0);
  });

  it('returns missing prices without crashing on craft simulation', async () => {
    const fixture = await createSimulatorFixture();
    await createPrice(fixture.user, fixture.resourceA.id, 'resource', 10);

    const result = await service.simulateCraft({ itemId: fixture.item.id }, fixture.user);

    expect(result.calculation).toBeNull();
    expect(result.missingPrices).toEqual([
      expect.objectContaining({ itemId: fixture.resourceB.id }),
    ]);
  });

  it('simulates breaking on a nominal case and taux 0', async () => {
    const fixture = await createSimulatorFixture();
    await createPrice(fixture.user, fixture.rune.id, 'rune', 100);

    const nominal = await service.simulateBreaking(
      { itemId: fixture.item.id, quantity: 1, tauxBrisage: 1 },
      fixture.user,
    );
    const zero = await service.simulateBreaking(
      { itemId: fixture.item.id, quantity: 1, tauxBrisage: 0 },
      fixture.user,
    );

    expect(nominal.breaking.runes[0]?.runesMoyennes).toBe(2);
    expect(nominal.valuation.totalValue).toBe(200);
    expect(zero.breaking.runes[0]?.runesMoyennes).toBe(0);
  });

  it('normalizes percentage breaking rates and exposes rune names', async () => {
    const fixture = await createSimulatorFixture();
    await createPrice(fixture.user, fixture.rune.id, 'rune', 100);

    const result = await service.simulateBreaking(
      { itemId: fixture.item.id, quantity: 1, tauxBrisage: 60 },
      fixture.user,
    );

    expect(result.tauxBrisage).toBe(0.6);
    expect(result.breaking.runes[0]).toMatchObject({
      runeItemId: fixture.rune.id,
      runeName: fixture.rune.name,
      runesMoyennes: 1.2,
    });
    expect(result.breaking.runes[0]?.warnings).not.toContain('LOW_CONFIDENCE_PA_PM_PO');
  });

  it('marks special effects in breaking simulation', async () => {
    const fixture = await createSimulatorFixture({ isSpecial: true, characteristicCode: 'po' });

    const result = await service.simulateBreaking(
      { itemId: fixture.item.id, quantity: 1, tauxBrisage: 1 },
      fixture.user,
    );

    expect(result.breaking.runes[0]?.confidence).toBe('special');
    expect(result.breaking.warnings).toContain('SPECIAL_EFFECT');
  });

  it('sorts item comparison by estimated profitability descending', async () => {
    const fixture = await createSimulatorFixture();
    const second = await createBreakableItem('Item rentable', fixture.rune.id, 5);
    await createPrice(fixture.user, fixture.rune.id, 'rune', 100);
    await createPrice(fixture.user, fixture.item.id, 'item', 50);
    await createPrice(fixture.user, second.id, 'item', 10);

    const results = await service.compareItems(
      { itemIds: [fixture.item.id, second.id], quantity: 1, tauxBrisage: 1 },
      fixture.user,
    );

    expect(results[0]?.itemId).toBe(second.id);
    expect(results[0]?.profitability.benefit).toBeGreaterThan(results[1]?.profitability.benefit ?? 0);
  });

  it('saves and lists simulations', async () => {
    const fixture = await createSimulatorFixture();
    await createPrice(fixture.user, fixture.resourceA.id, 'resource', 10);
    await createPrice(fixture.user, fixture.resourceB.id, 'resource', 5);

    const result = await service.simulateCraft(
      { itemId: fixture.item.id, quantity: 1, save: true },
      fixture.user,
    );
    const simulations = await service.listSimulations(fixture.user);

    expect(result.savedSimulation?.simulationType).toBe('craft');
    expect(simulations).toHaveLength(1);
    expect(simulations[0]?.economicSnapshotId).toBeTruthy();
  });
});

async function createSimulatorFixture(
  options: { isSpecial?: boolean; characteristicCode?: string } = {},
) {
  const { user } = await createUserAndGroup();
  const item = await createBreakableItem('Item simulateur', undefined, 2, options);
  const resourceA = await prisma.item.create({
    data: {
      name: 'Ressource simulateur A',
      normalizedName: 'ressource simulateur a',
      isResource: true,
      verificationStatus: 'verified',
      confidenceLevel: 'high',
    },
  });
  const resourceB = await prisma.item.create({
    data: {
      name: 'Ressource simulateur B',
      normalizedName: 'ressource simulateur b',
      isResource: true,
      verificationStatus: 'verified',
      confidenceLevel: 'high',
    },
  });
  const rune = await prisma.item.findFirstOrThrow({ where: { isRune: true } });

  await prisma.recipe.create({
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

  return { user, item, rune, resourceA, resourceB };
}

async function createBreakableItem(
  name: string,
  existingRuneId?: string,
  fixedValue = 2,
  options: { isSpecial?: boolean; characteristicCode?: string } = {},
) {
  const item = await prisma.item.create({
    data: {
      name,
      normalizedName: name.toLowerCase(),
      verificationStatus: 'verified',
      confidenceLevel: 'high',
    },
  });
  const rune =
    existingRuneId ??
    (
      await prisma.item.create({
        data: {
          name: `Rune ${randomUUID()}`,
          normalizedName: `rune ${randomUUID()}`,
          isRune: true,
          runeTier: 'base',
          verificationStatus: 'verified',
          confidenceLevel: 'high',
        },
      })
    ).id;
  const characteristic = await prisma.characteristic.create({
    data: {
      code: options.characteristicCode ?? `vi-${randomUUID()}`,
      name: `Caracteristique ${randomUUID()}`,
      shortName: `sim-${randomUUID()}`,
      runeCharacteristics: {
        create: {
          runeItemId: rune,
          weight: 1,
          bonusValue: 1,
          isSpecial: options.isSpecial ?? false,
        },
      },
    },
  });
  await prisma.itemEffect.create({
    data: {
      itemId: item.id,
      characteristicId: characteristic.id,
      minValue: fixedValue,
      maxValue: fixedValue,
      verificationStatus: 'verified',
    },
  });

  return item;
}

async function createUserAndGroup() {
  const dbUser = await prisma.user.create({
    data: {
      username: `user-${randomUUID()}`,
      displayName: 'Simulator User',
      email: `${randomUUID()}@example.test`,
      passwordHash: 'hash',
    },
  });
  const group = await prisma.group.create({ data: { name: 'Groupe simulateur', createdBy: dbUser.id } });
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

async function createPrice(
  user: AuthenticatedUser,
  itemId: string,
  priceType: 'resource' | 'rune' | 'item',
  unitPrice: number,
) {
  return prisma.priceSnapshot.create({
    data: {
      itemId,
      unitPrice,
      lotSize: 1,
      totalPrice: unitPrice,
      priceType,
      scope: 'group',
      userId: user.id,
      groupId: user.groupId,
      observedAt: new Date(),
    },
  });
}
