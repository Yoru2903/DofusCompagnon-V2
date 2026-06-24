import { ApiError } from '../../shared/errors/api-error.js';
import type { AuthenticatedUser } from '../core/core.types.js';
import {
  calculateProfitability,
  EconomicEngineError,
} from '../economic-engine/economic-engine.service.js';
import type { PricesService } from '../prices/prices.service.js';
import type { StockService } from '../stock/stock.service.js';
import type { TradeRepository } from './trade.repository.js';
import {
  addTradeLineSchema,
  createTradeSessionSchema,
  sellTradeLineSchema,
  updateTradeSessionSchema,
  type AddTradeLineInput,
  type CreateTradeSessionInput,
  type SellTradeLineInput,
  type UpdateTradeSessionInput,
} from './trade.validator.js';

export const defaultHdvFeeRate = 0.02;

export class TradeService {
  constructor(
    private readonly repository: TradeRepository,
    private readonly pricesService: PricesService,
    private readonly stockService: StockService,
  ) {}

  async createSession(rawInput: CreateTradeSessionInput, user: AuthenticatedUser) {
    const input = createTradeSessionSchema.parse(rawInput);

    return this.repository.createSession({
      user: { connect: { id: user.id } },
      group: { connect: { id: input.groupId ?? user.groupId } },
      name: input.name,
      sessionDate: input.sessionDate ?? new Date(),
      notes: input.notes,
    });
  }

  async updateSession(id: string, rawInput: UpdateTradeSessionInput) {
    const input = updateTradeSessionSchema.parse(rawInput);
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

  listSessions() {
    return this.repository.listSessions();
  }

  async addLine(sessionId: string, rawInput: AddTradeLineInput, user: AuthenticatedUser) {
    const input = addTradeLineSchema.parse(rawInput);
    await this.ensureSession(sessionId);
    const item = await this.repository.findItemById(input.itemId);

    if (!item) {
      throw new ApiError(404, 'ITEM_NOT_FOUND', 'Item introuvable.');
    }

    const totalBuyPrice = input.quantity * input.unitBuyPrice;
    const expectedTotalSellPrice = input.quantity * input.expectedUnitSellPrice;
    const fees = expectedTotalSellPrice * input.feeRate;
    const grossProfitability = this.safeProfitability({
      type: 'previsionnel',
      cost: totalBuyPrice,
      gain: expectedTotalSellPrice,
    });
    const netProfitability = this.safeProfitability({
      type: 'previsionnel',
      cost: totalBuyPrice,
      gain: expectedTotalSellPrice - fees,
    });
    const snapshot = await this.pricesService.createEconomicSnapshot(
      {
        snapshotType: 'resale_calculation',
        dataJson: {
          type: 'previsionnel',
          sessionId,
          itemId: input.itemId,
          quantity: input.quantity,
          unitBuyPrice: input.unitBuyPrice,
          expectedUnitSellPrice: input.expectedUnitSellPrice,
          feeRate: input.feeRate,
          fees,
          grossProfitability,
          netProfitability,
          calculatedAt: new Date().toISOString(),
        },
      },
      user,
    );

    return this.repository.createLine({
      session: { connect: { id: sessionId } },
      item: { connect: { id: input.itemId } },
      quantity: input.quantity,
      unitBuyPrice: input.unitBuyPrice,
      totalBuyPrice,
      expectedUnitSellPrice: input.expectedUnitSellPrice,
      expectedTotalSellPrice,
      feeRate: input.feeRate,
      fees,
      status: 'pending',
      economicSnapshot: { connect: { id: snapshot.id } },
    });
  }

  async sellLine(lineId: string, rawInput: SellTradeLineInput, user: AuthenticatedUser) {
    const input = sellTradeLineSchema.parse(rawInput);
    const line = await this.ensureLine(lineId);

    if (line.status === 'cancelled') {
      throw new ApiError(400, 'TRADE_LINE_CANCELLED', 'Ligne de trade annulee.');
    }

    const actualTotalSellPrice = input.actualUnitSellPrice * line.quantity;
    const fees = actualTotalSellPrice * input.feeRate;
    const grossProfitability = this.safeProfitability({
      type: 'realise',
      cost: line.totalBuyPrice,
      gain: actualTotalSellPrice,
    });
    const netProfitability = this.safeProfitability({
      type: 'realise',
      cost: line.totalBuyPrice,
      gain: actualTotalSellPrice - fees,
    });
    const snapshot = await this.pricesService.createEconomicSnapshot(
      {
        snapshotType: 'resale_calculation',
        dataJson: {
          type: 'realise',
          lineId,
          itemId: line.itemId,
          quantity: line.quantity,
          actualUnitSellPrice: input.actualUnitSellPrice,
          actualTotalSellPrice,
          feeRate: input.feeRate,
          fees,
          grossProfitability,
          netProfitability,
          calculatedAt: new Date().toISOString(),
        },
      },
      user,
    );
    const updated = await this.repository.updateLine(lineId, {
      actualUnitSellPrice: input.actualUnitSellPrice,
      actualTotalSellPrice,
      feeRate: input.feeRate,
      fees,
      status: 'sold',
      economicSnapshot: { connect: { id: snapshot.id } },
    });

    await this.stockService.recordTradeSale(updated, user);

    return { line: updated, grossProfitability, netProfitability };
  }

  async cancelLine(lineId: string) {
    await this.ensureLine(lineId);
    return this.repository.updateLine(lineId, { status: 'cancelled' });
  }

  private async ensureSession(id: string) {
    const session = await this.repository.findSessionById(id);

    if (!session) {
      throw new ApiError(404, 'TRADE_SESSION_NOT_FOUND', 'Session achat-revente introuvable.');
    }

    return session;
  }

  private async ensureLine(id: string) {
    const line = await this.repository.findLineById(id);

    if (!line) {
      throw new ApiError(404, 'TRADE_LINE_NOT_FOUND', 'Ligne achat-revente introuvable.');
    }

    return line;
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
