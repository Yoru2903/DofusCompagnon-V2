import type { Prisma } from '@prisma/client';
import { ApiError } from '../../shared/errors/api-error.js';
import type { AuthenticatedUser } from '../core/core.types.js';
import {
  calculateBreaking,
  calculateProfitability,
  EconomicEngineError,
  valuateRunes,
} from '../economic-engine/economic-engine.service.js';
import type { PricesService } from '../prices/prices.service.js';
import type { StockService } from '../stock/stock.service.js';
import type { BreakingRepository } from './breaking.repository.js';
import {
  addBreakingLineSchema,
  addBreakingResultsSchema,
  createBreakingSessionSchema,
  listBreakingSessionsQuerySchema,
  updateBreakingSessionSchema,
  type AddBreakingLineInput,
  type AddBreakingResultsInput,
  type CreateBreakingSessionInput,
  type ListBreakingSessionsQuery,
  type UpdateBreakingSessionInput,
} from './breaking.validator.js';

export class BreakingService {
  constructor(
    private readonly repository: BreakingRepository,
    private readonly pricesService: PricesService,
    private readonly stockService?: StockService,
  ) {}

  async createSession(rawInput: CreateBreakingSessionInput, user: AuthenticatedUser) {
    const input = createBreakingSessionSchema.parse(rawInput);

    return this.repository.createSession({
      user: { connect: { id: user.id } },
      group: { connect: { id: input.groupId ?? user.groupId } },
      name: input.name,
      sessionDate: input.sessionDate ?? new Date(),
      notes: input.notes,
    });
  }

  async updateSession(id: string, rawInput: UpdateBreakingSessionInput) {
    const input = updateBreakingSessionSchema.parse(rawInput);
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

  listAvailableCraftLines() {
    return this.repository.listAvailableCraftLines().then((lines) =>
      lines.map((line) => ({
        id: line.id,
        itemId: line.itemId,
        itemName: line.item.name,
        sessionName: line.session.name,
        sessionDate: line.session.sessionDate,
        quantity: line.quantity,
        unitCost: line.unitCost,
        totalCost: line.totalCost,
      })),
    );
  }

  async previewItemRunes(
    rawInput: { itemId: string; quantity?: number; tauxBrisage?: number },
    user: AuthenticatedUser,
  ) {
    const item = await this.repository.findItemBreakingData(rawInput.itemId);

    if (!item) {
      throw new ApiError(404, 'ITEM_NOT_FOUND', 'Item introuvable.');
    }

    const quantity = rawInput.quantity ?? 1;
    const tauxBrisage = normalizeBreakingRate(rawInput.tauxBrisage ?? 0);
    const effectInputs = item.effects
      .map((effect) => {
        const runeCharacteristic = effect.characteristic.runeCharacteristics[0];

        if (!runeCharacteristic) {
          return null;
        }

        const jetUtilise = effect.maxValue ?? effect.fixedValue ?? average(effect.minValue, effect.maxValue);

        return {
          characteristicId: effect.characteristicId,
          characteristicName: effect.characteristic.name,
          characteristicCode: effect.characteristic.code,
          runeItemId: runeCharacteristic.runeItemId,
          runeName: runeCharacteristic.runeItem.name,
          jetUtilise,
          poidsUnitaireCaracteristique: runeCharacteristic.weight,
          pwrRuneBase: runeCharacteristic.weight,
          verificationStatus: effect.verificationStatus as never,
          isSpecial: runeCharacteristic.isSpecial,
        };
      })
      .filter((effect) => effect !== null);
    const calculation = this.safeBreakingCalculation({
      tauxBrisage,
      effects: effectInputs.map((effect) => ({
        characteristicId: effect.characteristicId,
        characteristicCode: effect.characteristicCode,
        runeItemId: effect.runeItemId,
        jetUtilise: effect.jetUtilise * quantity,
        poidsUnitaireCaracteristique: effect.poidsUnitaireCaracteristique,
        pwrRuneBase: effect.pwrRuneBase,
        verificationStatus: effect.verificationStatus,
        isSpecial: effect.isSpecial,
      })),
    });

    return Promise.all(
      effectInputs.map(async (effect) => {
        const rune = calculation.runes.find(
          (entry) => entry.characteristicId === effect.characteristicId,
        );
        const latestPrice = await this.pricesService.getLatestPriceForCalculation(
          effect.runeItemId,
          user,
          'rune',
        );

        return {
          ...effect,
          expectedQuantity: rune?.runesMoyennes ?? 0,
          confidence: rune?.confidence,
          warnings: rune?.warnings ?? [],
          latestPrice: latestPrice
            ? {
                id: latestPrice.id,
                unitPrice: latestPrice.unitPrice,
                freshness: latestPrice.freshness,
              }
            : null,
        };
      }),
    );
  }

  async listSessions(rawQuery: ListBreakingSessionsQuery = {}) {
    const query = listBreakingSessionsQuerySchema.parse(rawQuery);
    const where: Prisma.BreakingSessionWhereInput = {};

    if (query.q) {
      where.name = { contains: query.q };
    }

    if (query.dateFrom || query.dateTo) {
      where.sessionDate = { gte: query.dateFrom, lte: query.dateTo };
    }

    if (query.itemId) {
      where.lines = { some: { itemId: query.itemId } };
    }

    return this.repository.listSessions(where);
  }

  async addLine(sessionId: string, rawInput: AddBreakingLineInput, user: AuthenticatedUser) {
    const input = addBreakingLineSchema.parse(rawInput);
    await this.ensureSession(sessionId);

    if (input.sourceCraftLineId) {
      const craftLine = await this.repository.findCraftLineById(input.sourceCraftLineId);

      if (!craftLine) {
        throw new ApiError(
          404,
          'SOURCE_CRAFT_LINE_NOT_FOUND',
          'Ligne de craft source introuvable.',
        );
      }
    }

    const item = await this.repository.findItemBreakingData(input.itemId);

    if (!item) {
      throw new ApiError(404, 'ITEM_NOT_FOUND', 'Item introuvable.');
    }

    const breakingInput = item.effects
      .map((effect) => {
        const runeCharacteristic = effect.characteristic.runeCharacteristics[0];

        if (!runeCharacteristic) {
          return null;
        }

        return {
          characteristicId: effect.characteristicId,
          characteristicCode: effect.characteristic.code,
          runeItemId: runeCharacteristic.runeItemId,
          jetUtilise: effect.maxValue ?? effect.fixedValue ?? average(effect.minValue, effect.maxValue),
          poidsUnitaireCaracteristique: runeCharacteristic.weight,
          pwrRuneBase: runeCharacteristic.weight,
          verificationStatus: effect.verificationStatus as never,
          isSpecial: runeCharacteristic.isSpecial,
        };
      })
      .filter((effect) => effect !== null);

    const tauxBrisage = normalizeBreakingRate(input.tauxBrisage);
    const expectedRunes = this.safeBreakingCalculation({
      tauxBrisage,
      effects: breakingInput,
    });
    const totalCost = input.quantity * input.unitCost;
    const snapshot = await this.pricesService.createEconomicSnapshot(
      {
        snapshotType: 'breaking_calculation',
        dataJson: {
          type: 'previsionnel',
          sessionId,
          itemId: input.itemId,
          quantity: input.quantity,
          unitCost: input.unitCost,
          totalCost,
          sourceCraftLineId: input.sourceCraftLineId,
          tauxBrisage,
          itemVerificationStatus: item.verificationStatus,
          result: expectedRunes,
          calculatedAt: new Date().toISOString(),
        },
      },
      user,
    );

    const line = await this.repository.createLine({
      session: { connect: { id: sessionId } },
      item: { connect: { id: input.itemId } },
      quantity: input.quantity,
      unitCost: input.unitCost,
      totalCost,
      sourceCraftLine: input.sourceCraftLineId
        ? { connect: { id: input.sourceCraftLineId } }
        : undefined,
      economicSnapshot: { connect: { id: snapshot.id } },
    });

    await this.stockService?.recordBreakingConsumption(line, user);

    if (input.sourceCraftLineId) {
      await this.repository.markCraftLineBroken(input.sourceCraftLineId);
    }

    return {
      line,
      expectedRunes,
      signals:
        item.verificationStatus === 'verified'
          ? expectedRunes.warnings
          : [...expectedRunes.warnings, 'UNVERIFIED_ITEM'],
    };
  }

  async addResults(lineId: string, rawInput: AddBreakingResultsInput, user: AuthenticatedUser) {
    const input = addBreakingResultsSchema.parse(rawInput);
    const line = await this.repository.findLineById(lineId);

    if (!line) {
      throw new ApiError(404, 'BREAKING_LINE_NOT_FOUND', 'Ligne de brisage introuvable.');
    }

    const valuation = this.safeRuneValuation({
      runes: input.results.map((result) => ({
        runeItemId: result.runeItemId,
        quantity: result.quantity,
      })),
      pricesByRuneItemId: Object.fromEntries(
        input.results.map((result) => [
          result.runeItemId,
          {
            itemId: result.runeItemId,
            unitPrice: result.unitPrice,
            priceSnapshotId: result.priceSnapshotId ?? `manual:${result.runeItemId}`,
          },
        ]),
      ),
    });
    const profitability = this.safeProfitability({
      type: 'realise',
      cost: line.totalCost,
      gain: valuation.totalValue,
    });
    const persistedResults = input.results.map((result) => ({
      runeItemId: result.runeItemId,
      quantity: result.quantity,
      unitPrice: result.unitPrice,
      totalValue: result.quantity * result.unitPrice,
      priceSnapshotId: result.priceSnapshotId ?? null,
    }));
    const snapshot = await this.pricesService.createEconomicSnapshot(
      {
        snapshotType: 'breaking_calculation',
        dataJson: {
          type: 'realise',
          lineId,
          itemId: line.itemId,
          quantity: line.quantity,
          cost: line.totalCost,
          results: persistedResults,
          valuation,
          profitability,
          calculatedAt: new Date().toISOString(),
        },
      },
      user,
    );
    const updatedLine = await this.repository.addResults({
      lineId,
      economicSnapshotId: snapshot.id,
      results: persistedResults,
    });

    for (const result of updatedLine.results) {
      await this.stockService?.recordBreakingResult(result, user);
    }

    return { line: updatedLine, valuation, profitability };
  }

  private async ensureSession(id: string) {
    const session = await this.repository.findSessionById(id);

    if (!session) {
      throw new ApiError(404, 'BREAKING_SESSION_NOT_FOUND', 'Session de brisage introuvable.');
    }

    return session;
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

  private safeProfitability(input: Parameters<typeof calculateProfitability>[0]) {
    try {
      return calculateProfitability(input);
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
