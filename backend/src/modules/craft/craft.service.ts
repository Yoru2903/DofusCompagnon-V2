import type { Prisma } from '@prisma/client';
import { ApiError } from '../../shared/errors/api-error.js';
import {
  calculateCraftCost,
  EconomicEngineError,
} from '../economic-engine/economic-engine.service.js';
import type { AuthenticatedUser } from '../core/core.types.js';
import type { PricesService } from '../prices/prices.service.js';
import type { StockService } from '../stock/stock.service.js';
import type { CalculationSignal, CraftCostSource } from './craft.types.js';
import type { CraftRepository } from './craft.repository.js';
import {
  addCraftLineSchema,
  createCraftSessionSchema,
  listCraftSessionsQuerySchema,
  updateCraftSessionSchema,
  type AddCraftLineInput,
  type CreateCraftSessionInput,
  type ListCraftSessionsQuery,
  type UpdateCraftSessionInput,
} from './craft.validator.js';

export class CraftService {
  constructor(
    private readonly repository: CraftRepository,
    private readonly pricesService: PricesService,
    private readonly stockService?: StockService,
  ) {}

  async createSession(rawInput: CreateCraftSessionInput, user: AuthenticatedUser) {
    const input = createCraftSessionSchema.parse(rawInput);

    return this.repository.createSession({
      user: { connect: { id: user.id } },
      group: { connect: { id: input.groupId ?? user.groupId } },
      name: input.name,
      sessionDate: input.sessionDate ?? new Date(),
      notes: input.notes,
    });
  }

  async updateSession(id: string, rawInput: UpdateCraftSessionInput) {
    const input = updateCraftSessionSchema.parse(rawInput);
    await this.ensureSession(id);

    return this.repository.updateSession(id, {
      name: input.name,
      sessionDate: input.sessionDate,
      notes: input.notes,
      group: input.groupId ? { connect: { id: input.groupId } } : undefined,
    });
  }

  async deleteSession(id: string) {
    await this.ensureSession(id);
    return this.repository.softDeleteSession(id);
  }

  async getSession(id: string) {
    return this.ensureSession(id);
  }

  async listRecipesForItem(itemId: string, user: AuthenticatedUser) {
    const recipes = await this.repository.listRecipesForItem(itemId);

    return Promise.all(
      recipes.map(async (recipe) => ({
        id: recipe.id,
        version: recipe.version,
        resultItem: recipe.resultItem,
        ingredients: await Promise.all(
          recipe.ingredients.map(async (ingredient) => {
            const latestPrice = await this.pricesService.getLatestPriceForCalculation(
              ingredient.ingredientItemId,
              user,
              'resource',
            );

            return {
              id: ingredient.id,
              ingredientItemId: ingredient.ingredientItemId,
              ingredientItem: ingredient.ingredientItem,
              quantity: ingredient.quantity,
              latestPrice: latestPrice
                ? {
                    id: latestPrice.id,
                    unitPrice: latestPrice.unitPrice,
                    observedAt: latestPrice.observedAt,
                    freshness: latestPrice.freshness,
                  }
                : null,
            };
          }),
        ),
      })),
    );
  }

  async listSessions(rawQuery: ListCraftSessionsQuery = {}) {
    const query = listCraftSessionsQuerySchema.parse(rawQuery);
    const where: Prisma.CraftSessionWhereInput = {};

    if (query.q) {
      where.name = { contains: query.q };
    }

    if (query.dateFrom || query.dateTo) {
      where.sessionDate = {
        gte: query.dateFrom,
        lte: query.dateTo,
      };
    }

    if (query.itemId || query.jobId) {
      where.lines = {
        some: {
          itemId: query.itemId,
          recipe: query.jobId ? { jobId: query.jobId } : undefined,
        },
      };
    }

    return this.repository.listSessions(where);
  }

  async addLine(sessionId: string, rawInput: AddCraftLineInput, user: AuthenticatedUser) {
    const input = addCraftLineSchema.parse(rawInput);
    await this.ensureSession(sessionId);
    const recipe = await this.repository.findRecipeForItem(input.recipeId, input.itemId);

    if (!recipe) {
      throw new ApiError(404, 'RECIPE_NOT_FOUND', 'Recette introuvable pour cet item.');
    }

    const manualPrices = new Map(
      input.manualPrices.map((price) => [price.ingredientItemId, price.unitPrice]),
    );
    const signals: CalculationSignal[] = [];

    if (recipe.resultItem.verificationStatus !== 'verified') {
      signals.push({
        type: 'unverified_data',
        itemId: recipe.resultItemId,
        message: 'Item crafte non verifie utilise dans le calcul.',
      });
    }
    const priceTraces: Record<
      string,
      { itemId: string; unitPrice: number; priceSnapshotId: string } | undefined
    > = {};
    const persistedIngredients: Array<{
      ingredientItemId: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      priceSnapshotId?: string | null;
    }> = [];

    for (const ingredient of recipe.ingredients) {
      const manualUnitPrice = manualPrices.get(ingredient.ingredientItemId);
      const shouldUseManual = this.shouldUseManual(input.costSource, manualUnitPrice);
      const unitPriceData = shouldUseManual
        ? {
            unitPrice: manualUnitPrice!,
            priceSnapshotId: `manual:${ingredient.ingredientItemId}`,
            persistedPriceSnapshotId: null,
            isStale: false,
          }
        : await this.findTheoreticalIngredientPrice(ingredient.ingredientItemId, user);

      const totalPrice = ingredient.quantity * input.quantity * unitPriceData.unitPrice;

      priceTraces[ingredient.ingredientItemId] = {
        itemId: ingredient.ingredientItemId,
        unitPrice: unitPriceData.unitPrice,
        priceSnapshotId: unitPriceData.priceSnapshotId,
      };
      persistedIngredients.push({
        ingredientItemId: ingredient.ingredientItemId,
        quantity: ingredient.quantity * input.quantity,
        unitPrice: unitPriceData.unitPrice,
        totalPrice,
        priceSnapshotId: unitPriceData.persistedPriceSnapshotId,
      });

      if (ingredient.ingredientItem.verificationStatus !== 'verified') {
        signals.push({
          type: 'unverified_data',
          itemId: ingredient.ingredientItemId,
          message: 'Ingredient non verifie utilise dans le calcul.',
        });
      }

      if (!shouldUseManual && unitPriceData.isStale) {
        signals.push({
          type: 'stale_price',
          itemId: ingredient.ingredientItemId,
          message: 'Prix ingredient plus ancien que 7 jours.',
        });
      }
    }

    const calculation = this.safeCraftCalculation({
      ingredients: recipe.ingredients.map((ingredient) => ({
        itemId: ingredient.ingredientItemId,
        quantity: ingredient.quantity * input.quantity,
      })),
      pricesByItemId: priceTraces,
      craftedQuantity: input.quantity,
    });

    const snapshot = await this.pricesService.createEconomicSnapshot(
      {
        snapshotType: 'craft_calculation',
        dataJson: {
          type: 'previsionnel',
          sessionId,
          itemId: input.itemId,
          recipeId: input.recipeId,
          quantity: input.quantity,
          costSource: input.costSource,
          assumptions: persistedIngredients,
          signals,
          result: calculation,
          calculatedAt: new Date().toISOString(),
        },
      },
      user,
    );

    const line = await this.repository.createLineWithIngredients({
      sessionId,
      itemId: input.itemId,
      recipeId: input.recipeId,
      quantity: input.quantity,
      unitCost: calculation.unitCost,
      totalCost: calculation.totalCost,
      costSource: input.costSource,
      economicSnapshotId: snapshot.id,
      ingredients: persistedIngredients,
    });

    await this.stockService?.recordCraftOutput(line, user);

    return { line, calculation, signals };
  }

  async stats() {
    const [aggregate, lines] = await this.repository.stats();
    const evolution = new Map<string, { date: string; craftCount: number; totalCost: number }>();

    for (const line of lines) {
      const date = line.createdAt.toISOString().slice(0, 10);
      const current = evolution.get(date) ?? { date, craftCount: 0, totalCost: 0 };
      current.craftCount += line.quantity;
      current.totalCost += line.totalCost;
      evolution.set(date, current);
    }

    return {
      craftCount: aggregate._count.id,
      averageUnitCost: aggregate._avg.unitCost ?? 0,
      totalCost: aggregate._sum.totalCost ?? 0,
      totalQuantity: aggregate._sum.quantity ?? 0,
      evolution: Array.from(evolution.values()),
    };
  }

  private async ensureSession(id: string) {
    const session = await this.repository.findSessionById(id);

    if (!session) {
      throw new ApiError(404, 'CRAFT_SESSION_NOT_FOUND', 'Session de craft introuvable.');
    }

    return session;
  }

  private shouldUseManual(costSource: CraftCostSource, manualUnitPrice: number | undefined) {
    if (costSource === 'manual' && manualUnitPrice === undefined) {
      throw new ApiError(400, 'MANUAL_PRICE_MISSING', 'Prix manuel ingredient manquant.');
    }

    return costSource === 'manual' || (costSource === 'mixed' && manualUnitPrice !== undefined);
  }

  private async findTheoreticalIngredientPrice(ingredientItemId: string, user: AuthenticatedUser) {
    const price = await this.pricesService.getLatestPriceForCalculation(
      ingredientItemId,
      user,
      'resource',
    );

    if (!price) {
      throw new ApiError(400, 'PRICE_MISSING', 'Prix HDV manquant pour cette ressource.', {
        itemId: ingredientItemId,
      });
    }

    return {
      unitPrice: price.unitPrice,
      priceSnapshotId: price.id,
      persistedPriceSnapshotId: price.id,
      isStale: price.freshness.isStale,
    };
  }

  private safeCraftCalculation(input: Parameters<typeof calculateCraftCost>[0]) {
    try {
      return calculateCraftCost(input);
    } catch (error) {
      if (error instanceof EconomicEngineError) {
        throw new ApiError(400, error.code, error.message, error.details);
      }

      throw error;
    }
  }
}
