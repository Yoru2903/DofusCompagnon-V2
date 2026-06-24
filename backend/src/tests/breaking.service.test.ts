import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../database/prisma.js';
import type { AuthenticatedUser } from '../modules/core/core.types.js';
import { BreakingRepository } from '../modules/breaking/breaking.repository.js';
import { BreakingService } from '../modules/breaking/breaking.service.js';
import { PricesRepository } from '../modules/prices/prices.repository.js';
import { PricesService } from '../modules/prices/prices.service.js';

const pricesService = new PricesService(new PricesRepository(prisma), 7);
const service = new BreakingService(new BreakingRepository(prisma), pricesService);

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

describe('BreakingService', () => {
  it('stores obtained runes and calculates positive realized profitability', async () => {
    const fixture = await createBreakingFixture();
    const session = await service.createSession({ name: 'Brisage positif' }, fixture.user);
    const lineResult = await service.addLine(
      session.id,
      { itemId: fixture.item.id, quantity: 1, unitCost: 50, tauxBrisage: 1 },
      fixture.user,
    );

    const result = await service.addResults(
      lineResult.line.id,
      { results: [{ runeItemId: fixture.rune.id, quantity: 2, unitPrice: 40 }] },
      fixture.user,
    );

    expect(result.valuation.totalValue).toBe(80);
    expect(result.profitability.benefit).toBe(30);
    expect(result.profitability.type).toBe('realise');
    expect(result.line.results).toHaveLength(1);
  });

  it('calculates negative realized profitability', async () => {
    const fixture = await createBreakingFixture();
    const session = await service.createSession({ name: 'Brisage perte' }, fixture.user);
    const lineResult = await service.addLine(
      session.id,
      { itemId: fixture.item.id, quantity: 1, unitCost: 100, tauxBrisage: 1 },
      fixture.user,
    );

    const result = await service.addResults(
      lineResult.line.id,
      { results: [{ runeItemId: fixture.rune.id, quantity: 1, unitPrice: 10 }] },
      fixture.user,
    );

    expect(result.profitability.benefit).toBe(-90);
    expect(result.profitability.roi).toBe(-90);
  });

  it('supports breaking an item linked to a craft session line', async () => {
    const fixture = await createBreakingFixture();
    const sourceCraftLine = await createSourceCraftLine(fixture);
    const session = await service.createSession({ name: 'Brisage lie craft' }, fixture.user);

    const result = await service.addLine(
      session.id,
      {
        itemId: fixture.item.id,
        quantity: 1,
        unitCost: 25,
        sourceCraftLineId: sourceCraftLine.id,
        tauxBrisage: 1,
      },
      fixture.user,
    );

    expect(result.line.sourceCraftLineId).toBe(sourceCraftLine.id);
    await expect(prisma.craftSessionLine.findUniqueOrThrow({ where: { id: sourceCraftLine.id } })).resolves.toMatchObject({
      status: 'broken',
    });
  });

  it('lists only active craft lines available as breaking source', async () => {
    const fixture = await createBreakingFixture();
    const activeLine = await createSourceCraftLine(fixture);
    const brokenLine = await createSourceCraftLine(fixture);
    await prisma.craftSessionLine.update({ where: { id: brokenLine.id }, data: { status: 'broken' } });

    const lines = await service.listAvailableCraftLines();

    expect(lines).toEqual([
      expect.objectContaining({
        id: activeLine.id,
        itemName: fixture.item.name,
        quantity: 1,
      }),
    ]);
  });

  it('previews runes from item effects with percentage rates and rune names', async () => {
    const fixture = await createBreakingFixture({ itemVerificationStatus: 'imported' });
    await prisma.priceSnapshot.create({
      data: {
        itemId: fixture.rune.id,
        unitPrice: 25,
        lotSize: 1,
        totalPrice: 25,
        priceType: 'rune',
        scope: 'group',
        userId: fixture.user.id,
        groupId: fixture.user.groupId,
        observedAt: new Date(),
      },
    });
    await prisma.itemEffect.updateMany({
      where: { itemId: fixture.item.id },
      data: { verificationStatus: 'imported' },
    });

    const preview = await service.previewItemRunes(
      { itemId: fixture.item.id, quantity: 1, tauxBrisage: 60 },
      fixture.user,
    );

    expect(preview[0]).toMatchObject({
      runeItemId: fixture.rune.id,
      runeName: fixture.rune.name,
      expectedQuantity: 1.2,
      latestPrice: expect.objectContaining({ unitPrice: 25 }),
    });
    expect(preview[0]?.warnings).not.toContain('LOW_CONFIDENCE_PA_PM_PO');
    expect(preview[0]?.warnings).toContain('UNVERIFIED_DATA');
  });

  it('supports breaking an item without craft link', async () => {
    const fixture = await createBreakingFixture();
    const session = await service.createSession({ name: 'Brisage achat HDV' }, fixture.user);

    const result = await service.addLine(
      session.id,
      { itemId: fixture.item.id, quantity: 2, unitCost: 30, tauxBrisage: 1 },
      fixture.user,
    );

    expect(result.line.sourceCraftLineId).toBeNull();
    expect(result.line.totalCost).toBe(60);
  });

  it('calculates expected runes for special effects without crashing', async () => {
    const fixture = await createBreakingFixture({ isSpecial: true, characteristicCode: 'po' });
    const session = await service.createSession({ name: 'Brisage special' }, fixture.user);

    const result = await service.addLine(
      session.id,
      { itemId: fixture.item.id, quantity: 1, unitCost: 30, tauxBrisage: 1 },
      fixture.user,
    );

    expect(result.expectedRunes.runes[0]?.confidence).toBe('special');
    expect(result.expectedRunes.runes[0]?.warnings).toContain('SPECIAL_EFFECT');
  });

  it('signals imported item data in breaking calculations', async () => {
    const fixture = await createBreakingFixture({ itemVerificationStatus: 'imported' });
    const session = await service.createSession({ name: 'Brisage imported' }, fixture.user);

    const result = await service.addLine(
      session.id,
      { itemId: fixture.item.id, quantity: 1, unitCost: 30, tauxBrisage: 1 },
      fixture.user,
    );

    expect(result.signals).toContain('UNVERIFIED_ITEM');
  });

  it('updates, lists, filters, retrieves, and soft-deletes breaking sessions', async () => {
    const fixture = await createBreakingFixture();
    const session = await service.createSession(
      { name: 'Historique brisage', sessionDate: new Date('2026-06-02T00:00:00.000Z') },
      fixture.user,
    );
    await service.addLine(
      session.id,
      { itemId: fixture.item.id, quantity: 1, unitCost: 20, tauxBrisage: 1 },
      fixture.user,
    );

    const updated = await service.updateSession(session.id, { name: 'Historique brisage maj' });
    const fetched = await service.getSession(session.id);
    const filteredByName = await service.listSessions({ q: 'maj' });
    const filteredByItem = await service.listSessions({ itemId: fixture.item.id });

    expect(updated.name).toBe('Historique brisage maj');
    expect(fetched.lines).toHaveLength(1);
    expect(filteredByName).toHaveLength(1);
    expect(filteredByItem).toHaveLength(1);

    await service.deleteSession(session.id);

    expect(await service.listSessions()).toHaveLength(0);
  });

  it('fails cleanly when an optional source craft line is unknown', async () => {
    const fixture = await createBreakingFixture();
    const session = await service.createSession({ name: 'Brisage source manquante' }, fixture.user);

    await expect(
      service.addLine(
        session.id,
        {
          itemId: fixture.item.id,
          quantity: 1,
          unitCost: 20,
          sourceCraftLineId: 'missing-craft-line',
          tauxBrisage: 1,
        },
        fixture.user,
      ),
    ).rejects.toMatchObject({ code: 'SOURCE_CRAFT_LINE_NOT_FOUND' });
  });
});

async function createBreakingFixture(
  options: {
    isSpecial?: boolean;
    characteristicCode?: string;
    itemVerificationStatus?: string;
  } = {},
) {
  const { user, dbUser, group } = await createUserAndGroup();
  const item = await prisma.item.create({
    data: {
      name: 'Bottes a briser',
      normalizedName: 'bottes a briser',
      verificationStatus: options.itemVerificationStatus ?? 'verified',
      confidenceLevel: 'high',
    },
  });
  const rune = await prisma.item.create({
    data: {
      name: 'Rune test',
      normalizedName: 'rune test',
      isRune: true,
      runeTier: 'base',
      verificationStatus: 'verified',
      confidenceLevel: 'high',
    },
  });
  const characteristic = await prisma.characteristic.create({
    data: {
      code: options.characteristicCode ?? 'vi',
      name: 'Vitalite',
      shortName: `vi-${randomUUID()}`,
      runeCharacteristics: {
        create: {
          runeItemId: rune.id,
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
      minValue: 2,
      maxValue: 2,
      verificationStatus: 'verified',
    },
  });

  return { user, dbUser, group, item, rune };
}

async function createSourceCraftLine(fixture: Awaited<ReturnType<typeof createBreakingFixture>>) {
  const recipe = await prisma.recipe.upsert({
    where: { resultItemId_version: { resultItemId: fixture.item.id, version: 1 } },
    create: {
      resultItemId: fixture.item.id,
      version: 1,
      verificationStatus: 'verified',
      confidenceLevel: 'high',
    },
    update: {},
  });
  const craftSession = await prisma.craftSession.create({
    data: {
      userId: fixture.user.id,
      groupId: fixture.user.groupId,
      name: 'Source craft',
      sessionDate: new Date(),
    },
  });
  const snapshot = await prisma.economicSnapshot.create({
    data: {
      userId: fixture.user.id,
      groupId: fixture.user.groupId,
      snapshotType: 'craft_calculation',
      dataJson: { result: { totalCost: 25 } },
    },
  });

  return prisma.craftSessionLine.create({
    data: {
      craftSessionId: craftSession.id,
      itemId: fixture.item.id,
      recipeId: recipe.id,
      quantity: 1,
      unitCost: 25,
      totalCost: 25,
      costSource: 'manual',
      economicSnapshotId: snapshot.id,
    },
  });
}

async function createUserAndGroup() {
  const dbUser = await prisma.user.create({
    data: {
      username: `user-${randomUUID()}`,
      displayName: 'Breaking User',
      email: `${randomUUID()}@example.test`,
      passwordHash: 'hash',
    },
  });
  const group = await prisma.group.create({
    data: {
      name: 'Groupe brisage',
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
