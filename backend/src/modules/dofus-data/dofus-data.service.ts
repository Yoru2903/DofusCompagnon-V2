import { readFile } from 'node:fs/promises';
import https from 'node:https';
import type { Prisma, PrismaClient } from '@prisma/client';
import { ApiError } from '../../shared/errors/api-error.js';
import { normalizeSearchText } from '../../shared/utils/normalize.js';
import type {
  ConfidenceLevel,
  EquipmentImportSummary,
  RuneImportSummary,
  VerificationStatus,
} from './dofus-data.types.js';
import type {
  DofusBookEquipmentInput,
  ItemInput,
  ItemTypeInput,
  JobInput,
  RecipeInput,
  SourceInput,
} from './dofus-data.validator.js';
import {
  dofusBookEquipmentSchema,
  dofusBookUrlImportSchema,
  itemInputSchema,
  itemTypeInputSchema,
  jobInputSchema,
  recipeInputSchema,
  runesFileSchema,
  sourceInputSchema,
} from './dofus-data.validator.js';
import type { DofusDataRepository } from './dofus-data.repository.js';

const manualStatuses = new Set<VerificationStatus>(['verified', 'corrected']);
const dofusBookHeaders = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 DofusCompagnon/0.1',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'fr-FR,fr;q=0.9',
  Referer: 'https://touch.dofusbook.net/',
};
const dofusBookRequestTimeoutMs = 20_000;
const dofusBookPageDelayMs = 500;
const dofusBookMaxPages = 500;
const characteristicAliases = new Map([
  ['in', { code: 'ine', name: 'Intelligence' }],
]);

type SourceProfile = {
  verificationStatus: VerificationStatus;
  confidenceLevel: ConfidenceLevel;
  sourceName: string;
};

export class DofusDataService {
  constructor(
    private readonly repository: DofusDataRepository,
    private readonly db: PrismaClient,
  ) {}

  listSources() {
    return this.repository.source.list();
  }

  async createSource(rawInput: SourceInput) {
    const input = sourceInputSchema.parse(rawInput);
    return this.repository.source.create(input);
  }

  async updateSource(id: string, rawInput: SourceInput) {
    const input = sourceInputSchema.parse(rawInput);
    await this.ensureExists(await this.repository.source.findById(id), 'SOURCE_NOT_FOUND');
    return this.repository.source.update(id, input);
  }

  async deleteSource(id: string) {
    await this.ensureExists(await this.repository.source.findById(id), 'SOURCE_NOT_FOUND');
    return this.repository.source.softDelete(id);
  }

  listItemTypes() {
    return this.repository.itemType.list();
  }

  async createItemType(rawInput: ItemTypeInput) {
    const input = itemTypeInputSchema.parse(rawInput);
    return this.repository.itemType.create(input);
  }

  async updateItemType(id: string, rawInput: ItemTypeInput) {
    const input = itemTypeInputSchema.parse(rawInput);
    await this.ensureExists(await this.repository.itemType.findById(id), 'ITEM_TYPE_NOT_FOUND');
    return this.repository.itemType.update(id, input);
  }

  async deleteItemType(id: string) {
    await this.ensureExists(await this.repository.itemType.findById(id), 'ITEM_TYPE_NOT_FOUND');
    return this.repository.itemType.softDelete(id);
  }

  listJobs() {
    return this.repository.job.list();
  }

  async createJob(rawInput: JobInput) {
    const input = jobInputSchema.parse(rawInput);
    return this.repository.job.create(input);
  }

  async updateJob(id: string, rawInput: JobInput) {
    const input = jobInputSchema.parse(rawInput);
    await this.ensureExists(await this.repository.job.findById(id), 'JOB_NOT_FOUND');
    return this.repository.job.update(id, input);
  }

  async deleteJob(id: string) {
    await this.ensureExists(await this.repository.job.findById(id), 'JOB_NOT_FOUND');
    return this.repository.job.softDelete(id);
  }

  listItems() {
    return this.repository.item.list();
  }

  searchItems(query: string) {
    return this.repository.item.search(normalizeSearchText(query));
  }

  autocompleteItems(query: string, limit = 20) {
    return this.repository.item.autocomplete(normalizeSearchText(query), limit).then((items) =>
      items.map((item) => ({
        id: item.id,
        name: item.name,
        level: item.level,
        itemType: item.itemType ? { id: item.itemType.id, name: item.itemType.name } : null,
        verificationStatus: item.verificationStatus,
        isRune: item.isRune,
        isResource: item.isResource,
        isCraftable: item.isCraftable,
      })),
    );
  }

  async createItem(rawInput: ItemInput) {
    const input = itemInputSchema.parse(rawInput);
    const { itemTypeId, jobId, sourceId, ...data } = input;
    return this.repository.item.create({
      ...data,
      normalizedName: normalizeSearchText(input.name),
      itemType: itemTypeId ? { connect: { id: itemTypeId } } : undefined,
      job: jobId ? { connect: { id: jobId } } : undefined,
      source: sourceId ? { connect: { id: sourceId } } : undefined,
    });
  }

  async updateItem(id: string, rawInput: ItemInput) {
    const input = itemInputSchema.parse(rawInput);
    const { itemTypeId, jobId, sourceId, ...data } = input;
    await this.ensureExists(await this.repository.item.findById(id), 'ITEM_NOT_FOUND');
    return this.repository.item.update(id, {
      ...data,
      normalizedName: normalizeSearchText(input.name),
      itemType: itemTypeId ? { connect: { id: itemTypeId } } : { disconnect: true },
      job: jobId ? { connect: { id: jobId } } : { disconnect: true },
      source: sourceId ? { connect: { id: sourceId } } : { disconnect: true },
    });
  }

  async deleteItem(id: string) {
    await this.ensureExists(await this.repository.item.findById(id), 'ITEM_NOT_FOUND');
    return this.repository.item.softDelete(id);
  }

  listRecipes() {
    return this.repository.recipe.list();
  }

  async createRecipe(rawInput: RecipeInput) {
    const input = recipeInputSchema.parse(rawInput);
    return this.repository.recipe.create({
      resultItem: { connect: { id: input.resultItemId } },
      job: input.jobId ? { connect: { id: input.jobId } } : undefined,
      version: input.version,
      verificationStatus: input.verificationStatus,
      confidenceLevel: input.confidenceLevel,
      source: input.sourceId ? { connect: { id: input.sourceId } } : undefined,
      ingredients: {
        create: input.ingredients.map((ingredient) => ({
          ingredientItem: { connect: { id: ingredient.ingredientItemId } },
          quantity: ingredient.quantity,
        })),
      },
    });
  }

  async updateRecipe(id: string, rawInput: RecipeInput) {
    const input = recipeInputSchema.parse(rawInput);
    await this.ensureExists(await this.repository.recipe.findById(id), 'RECIPE_NOT_FOUND');

    return this.db.$transaction(async (tx) => {
      await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
      return tx.recipe.update({
        where: { id },
        data: {
          resultItem: { connect: { id: input.resultItemId } },
          job: input.jobId ? { connect: { id: input.jobId } } : { disconnect: true },
          version: input.version,
          verificationStatus: input.verificationStatus,
          confidenceLevel: input.confidenceLevel,
          source: input.sourceId ? { connect: { id: input.sourceId } } : { disconnect: true },
          ingredients: {
            create: input.ingredients.map((ingredient) => ({
              ingredientItem: { connect: { id: ingredient.ingredientItemId } },
              quantity: ingredient.quantity,
            })),
          },
        },
      });
    });
  }

  async deleteRecipe(id: string) {
    await this.ensureExists(await this.repository.recipe.findById(id), 'RECIPE_NOT_FOUND');
    return this.repository.recipe.softDelete(id);
  }

  async importRunesFromFile(filePath: string, importedBy?: string): Promise<RuneImportSummary> {
    const rawJson = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
    return this.importRunes(rawJson, importedBy, filePath);
  }

  async importRunes(rawInput: unknown, importedBy?: string, rawFileName?: string): Promise<RuneImportSummary> {
    const input = runesFileSchema.parse(rawInput);

    return this.db.$transaction(async (tx) => {
      const batchSource = await this.ensureSource(tx, {
        name: 'Fichier JSON runes Dofus Touch',
        url: null,
        sourceType: 'file',
        reliabilityLevel: 'mixed',
      });
      const batch = await tx.importBatch.create({
        data: {
          sourceId: batchSource.id,
          importedBy,
          status: 'completed',
          rawFileName,
          notes: 'Import referentiel runes Dofus Touch.',
        },
      });
      await tx.importRecord.create({
        data: {
          importBatchId: batch.id,
          entityType: 'runes_file',
          externalRef: rawFileName ?? 'runes-dofus-touch-regenerated.json',
          rawDataJson: input as Prisma.InputJsonValue,
          proposedDataJson: { count: input.runes.length },
          status: 'completed',
        },
      });

      const summary: RuneImportSummary = {
        imported: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        characteristics: 0,
        verified: 0,
        byStatus: {},
        byTier: {},
      };

      for (const rune of input.runes) {
        const profile = runeProfile(rune.rune);
        const source = await this.ensureSource(tx, sourceForProfile(profile));
        const characteristic = await tx.characteristic.upsert({
          where: { code: rune.code },
          create: {
            code: rune.code,
            name: rune.caracteristique,
            shortName: rune.code,
          },
          update: {
            name: rune.caracteristique,
          },
        });
        summary.characteristics += 1;

        const externalId = `rune:${rune.rune}`;
        const existingItem = await tx.item.findUnique({ where: { externalId } });

        if (existingItem && manualStatuses.has(existingItem.verificationStatus as VerificationStatus)) {
          summary.skipped += 1;
          continue;
        }

        const itemData = {
          externalId,
          name: rune.rune,
          normalizedName: normalizeSearchText(rune.rune),
          isCraftable: false,
          isRune: true,
          isResource: false,
          runeTier: rune.tier,
          verificationStatus: profile.verificationStatus,
          confidenceLevel: profile.confidenceLevel,
          sourceId: source.id,
        };

        const item = existingItem
          ? await tx.item.update({ where: { id: existingItem.id }, data: itemData })
          : await tx.item.create({ data: itemData });

        await tx.runeCharacteristic.upsert({
          where: {
            runeItemId_characteristicId: {
              runeItemId: item.id,
              characteristicId: characteristic.id,
            },
          },
          create: {
            runeItemId: item.id,
            characteristicId: characteristic.id,
            weight: rune.pwr,
            bonusValue: rune.bonus,
            isSpecial: rune.special,
          },
          update: {
            weight: rune.pwr,
            bonusValue: rune.bonus,
            isSpecial: rune.special,
          },
        });

        summary[existingItem ? 'updated' : 'imported'] += 1;
        if (profile.verificationStatus === 'verified') {
          summary.verified += 1;
        }
        summary.byStatus[profile.verificationStatus] =
          (summary.byStatus[profile.verificationStatus] ?? 0) + 1;
        summary.byTier[rune.tier] = (summary.byTier[rune.tier] ?? 0) + 1;
      }

      return summary;
    });
  }

  async importEquipmentFromUrl(rawInput: unknown, importedBy?: string) {
    const { url } = dofusBookUrlImportSchema.parse(rawInput);

    try {
      return this.importEquipmentPagesFromUrl(url, importedBy);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(502, 'DOFUSBOOK_UNAVAILABLE', 'La source DofusBook est indisponible.');
    }
  }

  async importEquipmentPagesFromUrl(
    initialUrl: string,
    importedBy?: string,
  ): Promise<EquipmentImportSummary> {
    let page = getPageFromUrl(initialUrl);
    let fullPageSize: number | null = null;
    const summary = createEquipmentSummary();

    while (true) {
      if ((summary.pagesFetched ?? 0) >= dofusBookMaxPages) {
        throw new ApiError(502, 'DOFUSBOOK_MAX_PAGES', 'Limite de pagination DofusBook atteinte.', {
          maxPages: dofusBookMaxPages,
        });
      }

      const pageUrl = setPageInUrl(initialUrl, page);
      const pageItems = await this.fetchDofusBookEquipmentPage(pageUrl);
      summary.pagesFetched = (summary.pagesFetched ?? 0) + 1;

      if (pageItems.length === 0) {
        break;
      }

      const pageSummary = await this.importEquipments(pageItems, importedBy, pageUrl);
      mergeEquipmentSummary(summary, pageSummary);

      if (fullPageSize === null) {
        fullPageSize = pageItems.length;
      }

      if (pageItems.length < fullPageSize) {
        break;
      }

      page += 1;
      await delay(dofusBookPageDelayMs);
    }

    return summary;
  }

  private async fetchDofusBookEquipmentPage(pageUrl: string) {
    const response = await httpsGetJson(pageUrl);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      await this.createFailedDofusBookBatch(pageUrl, response.statusCode, response.body);
      throw new ApiError(
        502,
        `DOFUSBOOK_HTTP_${response.statusCode}`,
        'La source DofusBook est indisponible.',
        { status: response.statusCode },
      );
    }

    const payload = parseJsonResponse(response.body);
    const pageItems = extractDofusBookItems(payload);

    if (!pageItems) {
      throw new ApiError(400, 'DOFUSBOOK_INVALID_PAYLOAD', 'Format DofusBook inattendu.');
    }

    return pageItems;
  }

  private async createFailedDofusBookBatch(pageUrl: string, statusCode: number, body: string) {
    await this.db.$transaction(async (tx) => {
      const source = await this.ensureSource(tx, {
        name: 'DofusBook Touch (API)',
        url: 'https://touch.dofusbook.net/api/items/touch/search/equipment',
        sourceType: 'api',
        reliabilityLevel: 'medium',
      });

      await tx.importBatch.create({
        data: {
          sourceId: source.id,
          status: 'failed',
          rawFileName: pageUrl,
          notes: 'Echec HTTP pendant la recuperation DofusBook Touch.',
          reportData: {
            statusCode,
            bodyPreview: body.slice(0, 500),
          },
        },
      });
    });
  }

  async importEquipments(
    rawEquipments: unknown[],
    importedBy?: string,
    rawFileName?: string,
  ): Promise<EquipmentImportSummary> {
    return this.db.$transaction(async (tx) => {
      const source = await this.ensureSource(tx, {
        name: 'DofusBook Touch (API)',
        url: 'https://touch.dofusbook.net/api/items/touch/search/equipment',
        sourceType: 'api',
        reliabilityLevel: 'medium',
      });
      const batch = await tx.importBatch.create({
        data: {
          sourceId: source.id,
          importedBy,
          status: 'completed',
          rawFileName,
          notes: 'Import equipements et recettes DofusBook Touch.',
        },
      });
      const summary = createEquipmentSummary();

      for (const rawEquipment of rawEquipments) {
        const parsed = dofusBookEquipmentSchema.safeParse(rawEquipment);
        const externalRef = extractExternalRef(rawEquipment);

        if (!parsed.success) {
          summary.failed += 1;
          summary.errors?.push({
            externalRef,
            message: 'Structure equipement DofusBook inattendue.',
          });
          await tx.importRecord.create({
            data: {
              importBatchId: batch.id,
              entityType: 'equipment',
              externalRef,
              rawDataJson: toInputJson(rawEquipment),
              proposedDataJson: { errors: parsed.error.flatten() },
              status: 'failed',
            },
          });
          continue;
        }

        const equipment = parsed.data;

        await tx.importRecord.create({
          data: {
            importBatchId: batch.id,
            entityType: 'equipment',
            externalRef: String(equipment.id),
            rawDataJson: equipment as Prisma.InputJsonValue,
            status: 'completed',
          },
        });

        const existing = await tx.item.findUnique({
          where: { externalId: `dofusbook:${equipment.id}` },
        });

        if (existing && manualStatuses.has(existing.verificationStatus as VerificationStatus)) {
          summary.skipped += 1;
          continue;
        }

        const itemType = await this.ensureItemType(tx, {
          name: equipment.category_name ?? 'Type inconnu',
          category: equipment.category_type ?? String(equipment.category_id ?? 'equipment'),
        });
        const itemData = {
          externalId: `dofusbook:${equipment.id}`,
          name: equipment.name,
          normalizedName: normalizeSearchText(equipment.name),
          level: equipment.level ?? null,
          itemTypeId: itemType.id,
          isCraftable: equipment.ingredients.length > 0,
          isRune: false,
          isResource: false,
          panoplyName: equipment.cloth_name ?? null,
          verificationStatus: 'imported',
          confidenceLevel: 'medium',
          sourceId: source.id,
        };
        const item = existing
          ? await tx.item.update({ where: { id: existing.id }, data: itemData })
          : await tx.item.create({ data: itemData });

        summary[existing ? 'updated' : 'imported'] += 1;

        await tx.itemEffect.deleteMany({ where: { itemId: item.id } });
        for (const effect of equipment.effects.filter((entry) => entry.type === 'E')) {
          const characteristic = await this.ensureCharacteristicFromEffect(tx, effect.name);
          await tx.itemEffect.create({
            data: {
              itemId: item.id,
              characteristicId: characteristic.id,
              minValue: effect.min ?? null,
              maxValue: effect.max ?? null,
              fixedValue: effect.min === effect.max ? (effect.min ?? null) : null,
              verificationStatus: 'imported',
              sourceId: source.id,
            },
          });
          summary.effectsCreated += 1;
        }

        if (equipment.ingredients.length > 0) {
          const recipe = await tx.recipe.upsert({
            where: { resultItemId_version: { resultItemId: item.id, version: 1 } },
            create: {
              resultItemId: item.id,
              version: 1,
              verificationStatus: 'imported',
              confidenceLevel: 'medium',
              sourceId: source.id,
            },
            update: {
              verificationStatus: 'imported',
              confidenceLevel: 'medium',
              sourceId: source.id,
            },
          });
          await tx.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } });

          for (const ingredient of mergeDuplicateIngredients(equipment.ingredients)) {
            const resource = await this.ensureDerivedResource(tx, ingredient, source.id);
            if (resource.created) {
              summary.resourcesCreated += 1;
            }
            await tx.recipeIngredient.create({
              data: {
                recipeId: recipe.id,
                ingredientItemId: resource.item.id,
                quantity: ingredient.count,
              },
            });
          }
          summary.recipesCreated += 1;
        }
      }

      return summary;
    });
  }

  stats() {
    return this.repository.stats();
  }

  private async ensureExists<T>(entity: T | null, code: string): Promise<T> {
    if (!entity) {
      throw new ApiError(404, code, 'Ressource introuvable.');
    }

    return entity;
  }

  private async ensureSource(tx: Prisma.TransactionClient, input: SourceInput) {
    return tx.dataSource.upsert({
      where: { name: input.name },
      create: {
        name: input.name,
        url: input.url,
        sourceType: input.sourceType,
        reliabilityLevel: input.reliabilityLevel,
      },
      update: {
        url: input.url,
        sourceType: input.sourceType,
        reliabilityLevel: input.reliabilityLevel,
        deletedAt: null,
      },
    });
  }

  private async ensureItemType(tx: Prisma.TransactionClient, input: { name: string; category: string }) {
    const existing = await tx.itemType.findFirst({
      where: { name: input.name, category: input.category, deletedAt: null },
    });

    if (existing) {
      return existing;
    }

    return tx.itemType.create({ data: input });
  }

  private async ensureCharacteristicFromEffect(tx: Prisma.TransactionClient, shortName: string) {
    const normalized = shortName.trim();
    const alias = characteristicAliases.get(normalized.toLowerCase());
    const code = alias?.code ?? normalized;
    const name = alias?.name ?? normalized;

    return tx.characteristic.upsert({
      where: { shortName: code },
      create: {
        code,
        name,
        shortName: code,
      },
      update: {},
    });
  }

  private async ensureDerivedResource(
    tx: Prisma.TransactionClient,
    ingredient: DofusBookEquipmentInput['ingredients'][number],
    sourceId: string,
  ) {
    const externalId = `dofusbook-resource:${normalizeSearchText(ingredient.name)}`;
    const existing = await tx.item.findUnique({ where: { externalId } });

    if (existing) {
      return { item: existing, created: false };
    }

    const item = await tx.item.create({
      data: {
        externalId,
        name: ingredient.name,
        normalizedName: normalizeSearchText(ingredient.name),
        isCraftable: false,
        isRune: false,
        isResource: true,
        verificationStatus: 'imported',
        confidenceLevel: 'low',
        sourceId,
      },
    });

    return { item, created: true };
  }
}

function runeProfile(runeName: string): SourceProfile {
  if (runeName === 'Rune Vi' || runeName === 'Rune Pa Vi') {
    return {
      verificationStatus: 'verified',
      confidenceLevel: 'high',
      sourceName: 'Encyclopedie officielle Dofus Touch',
    };
  }

  return {
    verificationStatus: 'imported',
    confidenceLevel: 'low',
    sourceName: 'Dofastuces - tableau communautaire',
  };
}

function sourceForProfile(profile: SourceProfile): SourceInput {
  if (profile.sourceName === 'Encyclopedie officielle Dofus Touch') {
    return {
      name: 'Encyclopedie officielle Dofus Touch',
      url: 'https://www.dofus-touch.com/fr/mmorpg/encyclopedie',
      sourceType: 'manual_reference',
      reliabilityLevel: 'high',
    };
  }

  return {
    name: 'Dofastuces - tableau communautaire',
    url: 'https://www.dofastuces.fr/pages/tuto-dofus-touch/tableau-poids-runes-dofus-touch.html',
    sourceType: 'community_table',
    reliabilityLevel: 'low',
  };
}

function extractDofusBookItems(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const candidate = payload as {
      data?: unknown;
      items?: unknown;
      results?: unknown;
    };

    if (Array.isArray(candidate.data)) {
      return candidate.data;
    }

    if (Array.isArray(candidate.items)) {
      return candidate.items;
    }

    if (
      candidate.items &&
      typeof candidate.items === 'object' &&
      Array.isArray((candidate.items as { data?: unknown }).data)
    ) {
      return (candidate.items as { data: unknown[] }).data;
    }

    if (Array.isArray(candidate.results)) {
      return candidate.results;
    }
  }

  return null;
}

function createEquipmentSummary(): EquipmentImportSummary {
  return {
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    resourcesCreated: 0,
    recipesCreated: 0,
    effectsCreated: 0,
    errors: [],
  };
}

function mergeEquipmentSummary(target: EquipmentImportSummary, source: EquipmentImportSummary) {
  target.imported += source.imported;
  target.updated += source.updated;
  target.skipped += source.skipped;
  target.failed += source.failed;
  target.resourcesCreated += source.resourcesCreated;
  target.recipesCreated += source.recipesCreated;
  target.effectsCreated += source.effectsCreated;
  target.errors?.push(...(source.errors ?? []));
}

function getPageFromUrl(url: string) {
  const parsed = new URL(url);
  return Number(parsed.searchParams.get('page') ?? 1);
}

function setPageInUrl(url: string, page: number) {
  const parsed = new URL(url);
  parsed.searchParams.set('page', String(page));
  return parsed.toString();
}

function extractExternalRef(rawValue: unknown) {
  if (rawValue && typeof rawValue === 'object' && 'id' in rawValue) {
    return String((rawValue as { id: unknown }).id);
  }

  return undefined;
}

function toInputJson(rawValue: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(rawValue ?? null)) as Prisma.InputJsonValue;
}

function mergeDuplicateIngredients(
  ingredients: DofusBookEquipmentInput['ingredients'],
): DofusBookEquipmentInput['ingredients'] {
  const merged = new Map<string, DofusBookEquipmentInput['ingredients'][number]>();

  for (const ingredient of ingredients) {
    const key = normalizeSearchText(ingredient.name);
    const existing = merged.get(key);

    if (existing) {
      existing.count += ingredient.count;
    } else {
      merged.set(key, { ...ingredient });
    }
  }

  return [...merged.values()];
}

function httpsGetJson(url: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: dofusBookHeaders,
        timeout: dofusBookRequestTimeoutMs,
      },
      (response) => {
        response.setEncoding('utf8');
        let body = '';

        response.on('data', (chunk: string) => {
          body += chunk;
        });
        response.on('end', () => {
          resolve({ statusCode: response.statusCode ?? 0, body });
        });
      },
    );

    request.on('timeout', () => {
      request.destroy(new Error('DofusBook request timeout.'));
    });
    request.on('error', reject);
  });
}

function parseJsonResponse(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new ApiError(400, 'DOFUSBOOK_INVALID_JSON', 'Reponse DofusBook non JSON.');
  }
}

function delay(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}
