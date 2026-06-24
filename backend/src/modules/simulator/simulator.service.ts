import type { Prisma } from '@prisma/client';
import { ApiError } from '../../shared/errors/api-error.js';
import type { AuthenticatedUser } from '../core/core.types.js';
import {
  calculateBreaking,
  calculateCraftCost,
  calculateProfitability,
  EconomicEngineError,
  valuateRunes,
} from '../economic-engine/economic-engine.service.js';
import type { BreakingResult, PriceTrace } from '../economic-engine/economic-engine.types.js';
import type { PricesService } from '../prices/prices.service.js';
import type { SimulatorRepository } from './simulator.repository.js';
import {
  compareItemsSchema,
  simulateBreakingSchema,
  simulateCraftSchema,
  type CompareItemsInput,
  type SimulateBreakingInput,
  type SimulateCraftInput,
} from './simulator.validator.js';

export class SimulatorService {
  constructor(
    private readonly repository: SimulatorRepository,
    private readonly pricesService: PricesService,
  ) {}

  async simulateCraft(rawInput: SimulateCraftInput, user: AuthenticatedUser) {
    const input = simulateCraftSchema.parse(rawInput);
    const recipe = await this.repository.findRecipeForItem(input.itemId);

    if (!recipe) {
      throw new ApiError(404, 'RECIPE_NOT_FOUND', 'Recette introuvable pour cet item.');
    }

    const overrides = new Map(input.priceOverrides.map((price) => [price.itemId, price.unitPrice]));
    const pricesByItemId: Record<string, PriceTrace | undefined> = {};
    const missingPrices: Array<{ itemId: string; itemName: string }> = [];
    const stalePrices: Array<{ itemId: string; itemName: string; ageDays: number }> = [];
    const unverifiedData: Array<{ itemId: string; itemName: string }> = [];

    for (const ingredient of recipe.ingredients) {
      const overridePrice = overrides.get(ingredient.ingredientItemId);

      if (ingredient.ingredientItem.verificationStatus !== 'verified') {
        unverifiedData.push({
          itemId: ingredient.ingredientItemId,
          itemName: ingredient.ingredientItem.name,
        });
      }

      if (overridePrice !== undefined) {
        pricesByItemId[ingredient.ingredientItemId] = {
          itemId: ingredient.ingredientItemId,
          unitPrice: overridePrice,
          priceSnapshotId: `manual:${ingredient.ingredientItemId}`,
        };
        continue;
      }

      const latestPrice = await this.pricesService.getLatestPriceForCalculation(
        ingredient.ingredientItemId,
        user,
        'resource',
      );

      if (!latestPrice) {
        missingPrices.push({
          itemId: ingredient.ingredientItemId,
          itemName: ingredient.ingredientItem.name,
        });
        continue;
      }

      pricesByItemId[ingredient.ingredientItemId] = {
        itemId: ingredient.ingredientItemId,
        unitPrice: latestPrice.unitPrice,
        priceSnapshotId: latestPrice.id,
        observedAt: latestPrice.observedAt,
      };

      if (latestPrice.freshness.isStale) {
        stalePrices.push({
          itemId: ingredient.ingredientItemId,
          itemName: ingredient.ingredientItem.name,
          ageDays: latestPrice.freshness.ageDays,
        });
      }
    }

    if (recipe.resultItem.verificationStatus !== 'verified') {
      unverifiedData.push({ itemId: recipe.resultItemId, itemName: recipe.resultItem.name });
    }

    if (missingPrices.length > 0) {
      return {
        type: 'craft' as const,
        item: recipe.resultItem,
        quantity: input.quantity,
        calculation: null,
        missingPrices,
        stalePrices,
        unverifiedData,
        savedSimulation: null,
      };
    }

    const calculation = this.safeCraftCalculation({
      ingredients: recipe.ingredients.map((ingredient) => ({
        itemId: ingredient.ingredientItemId,
        quantity: ingredient.quantity * input.quantity,
      })),
      pricesByItemId,
      craftedQuantity: input.quantity,
    });
    const result = {
      type: 'craft' as const,
      item: recipe.resultItem,
      quantity: input.quantity,
      calculation,
      missingPrices,
      stalePrices,
      unverifiedData,
    };

    return {
      ...result,
      savedSimulation: input.save ? await this.saveSimulation(result, user) : null,
    };
  }

  async simulateBreaking(rawInput: SimulateBreakingInput, user: AuthenticatedUser) {
    const input = simulateBreakingSchema.parse(rawInput);
    const item = await this.repository.findItemBreakingData(input.itemId);

    if (!item) {
      throw new ApiError(404, 'ITEM_NOT_FOUND', 'Item introuvable.');
    }

    const tauxBrisage = normalizeBreakingRate(input.tauxBrisage);
    const breaking = this.breakingForItem(item, input.quantity, tauxBrisage);
    const pricesByRuneItemId: Record<string, PriceTrace | undefined> = {};
    const missingRunePrices: Array<{ runeItemId: string }> = [];

    for (const rune of breaking.runes) {
      const latestPrice = await this.pricesService.getLatestPriceForCalculation(
        rune.runeItemId,
        user,
        'rune',
      );

      if (!latestPrice) {
        missingRunePrices.push({ runeItemId: rune.runeItemId });
        continue;
      }

      pricesByRuneItemId[rune.runeItemId] = {
        itemId: rune.runeItemId,
        unitPrice: latestPrice.unitPrice,
        priceSnapshotId: latestPrice.id,
        observedAt: latestPrice.observedAt,
      };
    }

    const pricedRunes = breaking.runes.filter((rune) => pricesByRuneItemId[rune.runeItemId]);
    const valuation =
      pricedRunes.length === 0
        ? { totalValue: 0, lines: [], priceSnapshotIds: [], warnings: ['MISSING_RUNE_PRICES'] }
        : this.safeRuneValuation({
            runes: pricedRunes.map((rune) => ({
              runeItemId: rune.runeItemId,
              quantity: rune.runesMoyennes,
            })),
            pricesByRuneItemId,
          });
    const result = {
      type: 'breaking' as const,
      item,
      quantity: input.quantity,
      tauxBrisage,
      breaking,
      valuation,
      missingRunePrices,
      unverifiedData: item.verificationStatus === 'verified' ? [] : [{ itemId: item.id, itemName: item.name }],
    };

    return {
      ...result,
      savedSimulation: input.save ? await this.saveSimulation(result, user) : null,
    };
  }

  async compareItems(rawInput: CompareItemsInput, user: AuthenticatedUser) {
    const input = compareItemsSchema.parse(rawInput);
    const results = [];

    for (const itemId of input.itemIds) {
      const simulation = await this.simulateBreaking(
        {
          itemId,
          quantity: input.quantity,
          tauxBrisage: normalizeBreakingRate(input.tauxBrisage),
          save: false,
        },
        user,
      );
      const latestItemPrice = await this.pricesService.getLatestPriceForCalculation(
        itemId,
        user,
        'item',
      );
      const cost = (latestItemPrice?.unitPrice ?? 0) * input.quantity;
      const profitability = calculateProfitability({
        type: 'previsionnel',
        cost,
        gain: simulation.valuation.totalValue,
      });

      results.push({
        itemId,
        itemName: simulation.item.name,
        estimatedCost: cost,
        estimatedValue: simulation.valuation.totalValue,
        profitability,
        warnings: simulation.breaking.warnings,
      });
    }

    return results.sort((a, b) => b.profitability.benefit - a.profitability.benefit);
  }

  listSimulations(user: AuthenticatedUser) {
    return this.repository.listSimulations(user.id);
  }

  private breakingForItem(
    item: NonNullable<Awaited<ReturnType<SimulatorRepository['findItemBreakingData']>>>,
    quantity: number,
    tauxBrisage: number,
  ): BreakingResult {
    const effects = item.effects
      .map((effect) => {
        const runeCharacteristic = effect.characteristic.runeCharacteristics[0];

        if (!runeCharacteristic) {
          return null;
        }

        return {
          characteristicId: effect.characteristicId,
          characteristicCode: effect.characteristic.code,
          runeItemId: runeCharacteristic.runeItemId,
          jetUtilise:
            (effect.maxValue ?? effect.fixedValue ?? average(effect.minValue, effect.maxValue)) * quantity,
          poidsUnitaireCaracteristique: runeCharacteristic.weight,
          pwrRuneBase: runeCharacteristic.weight,
          verificationStatus: effect.verificationStatus as never,
          isSpecial: runeCharacteristic.isSpecial,
        };
      })
      .filter((effect) => effect !== null);

    const calculation = this.safeBreakingCalculation({ tauxBrisage, effects });
    const runeNames = new Map(
      item.effects.flatMap((effect) =>
        effect.characteristic.runeCharacteristics.map((runeCharacteristic) => [
          runeCharacteristic.runeItemId,
          runeCharacteristic.runeItem.name,
        ]),
      ),
    );

    return {
      ...calculation,
      runes: calculation.runes.map((rune) => ({
        ...rune,
        runeName: runeNames.get(rune.runeItemId) ?? null,
      })),
    } as BreakingResult;
  }

  private async saveSimulation(
    result: Record<string, unknown>,
    user: AuthenticatedUser,
  ) {
    const serializableResult = JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
    const item = result.item as { id: string };
    const quantity = result.quantity as number;
    const type = result.type as string;
    const snapshot = await this.pricesService.createEconomicSnapshot(
      {
        snapshotType: 'simulation',
        dataJson: {
          type: 'previsionnel',
          result: serializableResult,
          calculatedAt: new Date().toISOString(),
        },
      },
      user,
    );

    return this.repository.createSimulation({
      user: { connect: { id: user.id } },
      group: { connect: { id: user.groupId } },
      item: { connect: { id: item.id } },
      simulationType: type,
      quantity,
      resultJson: serializableResult,
      economicSnapshot: { connect: { id: snapshot.id } },
    });
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

  private safeBreakingCalculation(input: Parameters<typeof calculateBreaking>[0]) {
    try {
      return calculateBreaking(input);
    } catch (error) {
      if (error instanceof EconomicEngineError) {
        throw new ApiError(400, error.code, error.message, error.details);
      }

      throw error;
    }
  }

  private safeRuneValuation(input: Parameters<typeof valuateRunes>[0]) {
    try {
      return valuateRunes(input);
    } catch (error) {
      if (error instanceof EconomicEngineError) {
        throw new ApiError(400, error.code, error.message, error.details);
      }

      throw error;
    }
  }
}

function average(minValue: number | null, maxValue: number | null) {
  if (minValue !== null && maxValue !== null) {
    return (minValue + maxValue) / 2;
  }

  return minValue ?? maxValue ?? 0;
}

function normalizeBreakingRate(rate: number) {
  return rate > 1 ? rate / 100 : rate;
}
