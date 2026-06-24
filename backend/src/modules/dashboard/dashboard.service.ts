import type { Prisma } from '@prisma/client';
import { calculateProfitability } from '../economic-engine/economic-engine.service.js';
import type { DashboardRepository } from './dashboard.repository.js';
import {
  dashboardEvolutionQuerySchema,
  dashboardQuerySchema,
  type DashboardEvolutionQuery,
  type DashboardQuery,
} from './dashboard.validator.js';

type OperationType = 'craft' | 'breaking' | 'trade';

type DashboardOperation = {
  id: string;
  type: OperationType;
  label: string;
  itemName: string;
  quantity: number;
  date: Date;
  cost: number;
  gain: number;
  benefit: number;
  margin: number;
  roi: number;
  resultType: 'realise';
};

export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}

  async summary(rawQuery: DashboardQuery = {}) {
    const operations = await this.operationsForQuery(rawQuery);
    const expenses = operations.reduce((sum, operation) => sum + operation.cost, 0);
    const gains = operations.reduce((sum, operation) => sum + operation.gain, 0);
    const benefit = gains - expenses;

    return {
      resultType: 'realise' as const,
      benefitTotal: benefit,
      expensesTotal: expenses,
      gainsTotal: gains,
      averageRoi:
        operations.length === 0
          ? 0
          : operations.reduce((sum, operation) => sum + operation.roi, 0) / operations.length,
      operationCount: operations.length,
    };
  }

  async operations(rawQuery: DashboardQuery = {}) {
    const operations = await this.operationsForQuery(rawQuery);

    return {
      resultType: 'realise' as const,
      best: {
        craft: topByBenefit(operations, 'craft', 'desc'),
        breaking: topByBenefit(operations, 'breaking', 'desc'),
        trade: topByBenefit(operations, 'trade', 'desc'),
      },
      worst: [...operations].sort((a, b) => a.benefit - b.benefit).slice(0, 5),
    };
  }

  async evolution(rawQuery: DashboardEvolutionQuery = {}) {
    const query = dashboardEvolutionQuerySchema.parse(rawQuery);
    const operations = await this.operationsForQuery(query);
    const sorted = [...operations].sort((a, b) => a.date.getTime() - b.date.getTime());
    const buckets = new Map<string, { period: string; benefit: number; cumulativeBenefit: number }>();
    let cumulativeBenefit = 0;

    for (const operation of sorted) {
      const key = periodKey(operation.date, query.period);
      const current = buckets.get(key) ?? {
        period: key,
        benefit: 0,
        cumulativeBenefit,
      };
      current.benefit += operation.benefit;
      cumulativeBenefit += operation.benefit;
      current.cumulativeBenefit = cumulativeBenefit;
      buckets.set(key, current);
    }

    return {
      resultType: 'realise' as const,
      period: query.period,
      points: Array.from(buckets.values()),
    };
  }

  private async operationsForQuery(rawQuery: DashboardQuery) {
    const query = dashboardQuerySchema.parse(rawQuery);
    const dateFilter = sessionDateFilter(query.dateFrom, query.dateTo);
    const operations: DashboardOperation[] = [];

    if (query.operationType === 'all' || query.operationType === 'craft') {
      const lines = await this.repository.listCraftLines({
        deletedAt: null,
        sessionDate: dateFilter,
      });
      operations.push(
        ...lines.map((line) =>
          operationFromAmounts({
            id: line.id,
            type: 'craft',
            label: `Craft - ${line.session.name}`,
            itemName: line.item.name,
            quantity: line.quantity,
            date: line.session.sessionDate,
            cost: line.totalCost,
            gain: 0,
          }),
        ),
      );
    }

    if (query.operationType === 'all' || query.operationType === 'breaking') {
      const lines = await this.repository.listBreakingLines({
        deletedAt: null,
        sessionDate: dateFilter,
      });
      operations.push(
        ...lines
          .filter((line) => line.results.length > 0)
          .map((line) =>
            operationFromAmounts({
              id: line.id,
              type: 'breaking',
              label: `Brisage - ${line.session.name}`,
              itemName: line.item.name,
              quantity: line.quantity,
              date: line.session.sessionDate,
              cost: line.totalCost,
              gain: line.results.reduce((sum, result) => sum + result.totalValue, 0),
            }),
          ),
      );
    }

    if (query.operationType === 'all' || query.operationType === 'trade') {
      const lines = await this.repository.listTradeLines({
        deletedAt: null,
        sessionDate: dateFilter,
      });
      operations.push(
        ...lines
          .filter((line) => line.status === 'sold' && line.actualTotalSellPrice !== null)
          .map((line) =>
            operationFromAmounts({
              id: line.id,
              type: 'trade',
              label: `Trade - ${line.session.name}`,
              itemName: line.item.name,
              quantity: line.quantity,
              date: line.session.sessionDate,
              cost: line.totalBuyPrice,
              gain: (line.actualTotalSellPrice ?? 0) - line.fees,
            }),
          ),
      );
    }

    return operations;
  }
}

function operationFromAmounts(input: Omit<DashboardOperation, 'benefit' | 'margin' | 'roi' | 'resultType'>) {
  const profitability = calculateProfitability({
    type: 'realise',
    cost: input.cost,
    gain: input.gain,
  });

  return {
    ...input,
    benefit: profitability.benefit,
    margin: profitability.margin,
    roi: profitability.roi,
    resultType: 'realise' as const,
  };
}

function topByBenefit(
  operations: DashboardOperation[],
  type: OperationType,
  order: 'asc' | 'desc',
) {
  return operations
    .filter((operation) => operation.type === type)
    .sort((a, b) => (order === 'desc' ? b.benefit - a.benefit : a.benefit - b.benefit))
    .slice(0, 5);
}

function sessionDateFilter(dateFrom?: Date, dateTo?: Date): Prisma.DateTimeFilter | undefined {
  if (!dateFrom && !dateTo) {
    return undefined;
  }

  return {
    gte: dateFrom,
    lte: dateTo,
  };
}

function periodKey(date: Date, period: 'week' | 'month') {
  if (period === 'month') {
    return date.toISOString().slice(0, 7);
  }

  const firstDayOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  const currentDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const week = Math.ceil(((currentDay - firstDayOfYear) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
