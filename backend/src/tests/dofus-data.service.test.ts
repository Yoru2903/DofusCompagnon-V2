import { resolve } from 'node:path';
import { EventEmitter } from 'node:events';
import https from 'node:https';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../database/prisma.js';
import { DofusDataRepository } from '../modules/dofus-data/dofus-data.repository.js';
import { DofusDataService } from '../modules/dofus-data/dofus-data.service.js';

const service = new DofusDataService(new DofusDataRepository(prisma), prisma);

beforeEach(async () => {
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

describe('DofusDataService', () => {
  it('imports the 83 runes with expected tiers and reliability statuses', async () => {
    const summary = await service.importRunesFromFile(
      resolve('src/database/seeds/runes-dofus-touch-regenerated.json'),
    );

    expect(summary.imported).toBe(83);
    expect(summary.verified).toBe(2);
    expect(summary.byStatus).toEqual({ verified: 2, imported: 81 });
    expect(summary.byTier).toEqual({ base: 43, pa: 31, ra: 9 });

    const runeCount = await prisma.item.count({ where: { isRune: true } });
    const verifiedCount = await prisma.item.count({ where: { verificationStatus: 'verified' } });
    const rawRecords = await prisma.importRecord.count({ where: { entityType: 'runes_file' } });

    expect(runeCount).toBe(83);
    expect(verifiedCount).toBe(2);
    expect(rawRecords).toBe(1);
  });

  it('imports equipment, ignores type O effects, and derives missing resources', async () => {
    const summary = await service.importEquipments([
      {
        id: 1001,
        level: 12,
        category_id: 1,
        category_name: 'Bottes',
        category_type: 'equipment',
        name: 'Bottes du Bouftou',
        slug: 'bottes-du-bouftou',
        cloth_id: 10,
        cloth_name: 'Panoplie Bouftou',
        effects: [
          { id: 1, name: 'vi', type: 'E', min: 11, max: 20 },
          { id: 2, name: 'sort', type: 'O', spell: 99, spellDesc: 'Effet special' },
        ],
        ingredients: [{ item_id: 9001, name: 'Laine de Bouftou', count: 5 }],
      },
    ]);

    expect(summary.imported).toBe(1);
    expect(summary.resourcesCreated).toBe(1);
    expect(summary.effectsCreated).toBe(1);

    const resources = await prisma.item.findMany({ where: { isResource: true } });
    const effects = await prisma.itemEffect.findMany();
    const records = await prisma.importRecord.findMany({ where: { entityType: 'equipment' } });

    expect(resources).toHaveLength(1);
    expect(resources[0]?.verificationStatus).toBe('imported');
    expect(resources[0]?.confidenceLevel).toBe('low');
    expect(effects).toHaveLength(1);
    expect(records).toHaveLength(1);
    expect(records[0]?.rawDataJson).toMatchObject({ name: 'Bottes du Bouftou' });
  });

  it('searches items without case or accent sensitivity', async () => {
    await service.createItem({
      name: 'Cape Résistance',
      isCraftable: false,
      isRune: false,
      isResource: false,
      verificationStatus: 'draft',
      confidenceLevel: 'low',
    });

    const results = await service.searchItems('resistance');

    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('Cape Résistance');
  });

  it('supports CRUD with logical deletion for catalog entities', async () => {
    const source = await service.createSource({
      name: 'Source test',
      url: 'https://example.test/source',
      sourceType: 'manual_reference',
      reliabilityLevel: 'low',
    });
    const updatedSource = await service.updateSource(source.id, {
      name: 'Source test maj',
      url: 'https://example.test/source',
      sourceType: 'manual_reference',
      reliabilityLevel: 'medium',
    });
    const itemType = await service.createItemType({ name: 'Anneau', category: 'equipment' });
    const updatedItemType = await service.updateItemType(itemType.id, {
      name: 'Anneau magique',
      category: 'equipment',
    });
    const job = await service.createJob({ name: 'Bijoutier' });
    const updatedJob = await service.updateJob(job.id, { name: 'Bijoutier expert' });
    const item = await service.createItem({
      name: 'Anneau test',
      level: 10,
      itemTypeId: itemType.id,
      jobId: job.id,
      isCraftable: true,
      isRune: false,
      isResource: false,
      verificationStatus: 'draft',
      confidenceLevel: 'low',
      sourceId: source.id,
    });
    const ingredient = await service.createItem({
      name: 'Minerai test',
      isCraftable: false,
      isRune: false,
      isResource: true,
      verificationStatus: 'draft',
      confidenceLevel: 'low',
      sourceId: source.id,
    });
    const recipe = await service.createRecipe({
      resultItemId: item.id,
      jobId: job.id,
      version: 1,
      verificationStatus: 'draft',
      confidenceLevel: 'low',
      sourceId: source.id,
      ingredients: [{ ingredientItemId: ingredient.id, quantity: 2 }],
    });
    const updatedRecipe = await service.updateRecipe(recipe.id, {
      resultItemId: item.id,
      jobId: job.id,
      version: 1,
      verificationStatus: 'imported',
      confidenceLevel: 'medium',
      sourceId: source.id,
      ingredients: [{ ingredientItemId: ingredient.id, quantity: 3 }],
    });
    const updatedItem = await service.updateItem(item.id, {
      name: 'Anneau test maj',
      level: 11,
      itemTypeId: updatedItemType.id,
      jobId: updatedJob.id,
      isCraftable: true,
      isRune: false,
      isResource: false,
      verificationStatus: 'imported',
      confidenceLevel: 'medium',
      sourceId: updatedSource.id,
    });

    expect(updatedSource.reliabilityLevel).toBe('medium');
    expect(updatedItemType.name).toBe('Anneau magique');
    expect(updatedJob.name).toBe('Bijoutier expert');
    expect(updatedItem.name).toBe('Anneau test maj');
    expect(updatedRecipe.verificationStatus).toBe('imported');
    expect(await service.listSources()).toHaveLength(1);
    expect(await service.listItemTypes()).toHaveLength(1);
    expect(await service.listJobs()).toHaveLength(1);
    expect(await service.listItems()).toHaveLength(2);
    expect(await service.listRecipes()).toHaveLength(1);

    await service.deleteRecipe(recipe.id);
    await service.deleteItem(item.id);
    await service.deleteItemType(itemType.id);
    await service.deleteJob(job.id);
    await service.deleteSource(source.id);

    expect(await service.listSources()).toHaveLength(0);
    expect(await service.listItemTypes()).toHaveLength(0);
    expect(await service.listJobs()).toHaveLength(0);
    expect(await service.listRecipes()).toHaveLength(0);
  });

  it('fails cleanly when DofusBook is unavailable', async () => {
    mockHttpsResponses([{ statusCode: 503, body: 'unavailable' }]);

    await expect(
      service.importEquipmentFromUrl({ url: 'https://example.test/equipment' }),
    ).rejects.toMatchObject({
      code: 'DOFUSBOOK_HTTP_503',
      statusCode: 502,
    });
  });

  it('imports DofusBook equipment from paginated HTTP payloads', async () => {
    const httpsMock = mockHttpsResponses([
      {
        statusCode: 200,
        body: JSON.stringify({
            data: [
              {
                id: 2001,
                level: 1,
                category_id: 1,
                category_name: 'Coiffe',
                category_type: 'equipment',
                name: 'Coiffe page 1',
                effects: [],
                ingredients: [],
              },
              {
                id: 2002,
                level: 2,
                category_id: 1,
                category_name: 'Coiffe',
                category_type: 'equipment',
                name: 'Coiffe page 1 bis',
                effects: [],
                ingredients: [],
              },
            ],
        }),
      },
      {
        statusCode: 200,
        body: JSON.stringify({
            data: [
              {
                id: 2003,
                level: 3,
                category_id: 1,
                category_name: 'Coiffe',
                category_type: 'equipment',
                name: 'Coiffe page 2',
                effects: [],
                ingredients: [],
              },
            ],
        }),
      },
    ]);

    const summary = await service.importEquipmentFromUrl({
      url: 'https://example.test/equipment?page=1',
    });

    expect(summary.imported).toBe(3);
    expect(httpsMock).toHaveBeenCalledTimes(2);
  });
});

function mockHttpsResponses(responses: Array<{ statusCode: number; body: string }>) {
  return vi.spyOn(https, 'get').mockImplementation((_url, _options, callback) => {
    const responseData = responses.shift();
    const response = new EventEmitter() as EventEmitter & {
      statusCode: number;
      setEncoding: (encoding: string) => void;
    };
    response.statusCode = responseData?.statusCode ?? 500;
    response.setEncoding = vi.fn();
    const request = new EventEmitter() as EventEmitter & {
      setTimeout: (timeout: number, callback?: () => void) => void;
      destroy: (error?: Error) => void;
    };
    request.setTimeout = vi.fn();
    request.destroy = vi.fn();

    queueMicrotask(() => {
      callback?.(response as never);
      response.emit('data', responseData?.body ?? '');
      response.emit('end');
    });

    return request as never;
  });
}
