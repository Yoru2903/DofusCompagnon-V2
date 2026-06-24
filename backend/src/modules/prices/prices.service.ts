import type { Prisma } from '@prisma/client';
import { ApiError } from '../../shared/errors/api-error.js';
import type { AuthenticatedUser } from '../core/core.types.js';
import type { PriceFreshness } from './prices.types.js';
import type { PricesRepository } from './prices.repository.js';
import {
  createEconomicSnapshotSchema,
  createPriceSnapshotSchema,
  latestPriceQuerySchema,
  type CreateEconomicSnapshotInput,
  type CreatePriceSnapshotInput,
  type LatestPriceQuery,
} from './prices.validator.js';

export const defaultPriceStaleAfterDays = 7;

export class PricesService {
  constructor(
    private readonly repository: PricesRepository,
    private readonly staleAfterDays = defaultPriceStaleAfterDays,
  ) {}

  async createPriceSnapshot(rawInput: CreatePriceSnapshotInput, user: AuthenticatedUser) {
    const input = createPriceSnapshotSchema.parse(rawInput);
    const item = await this.repository.findItemById(input.itemId);

    if (!item) {
      throw new ApiError(404, 'ITEM_NOT_FOUND', 'Item introuvable.');
    }

    const groupId = this.resolveGroupId(input.scope, input.groupId, user);
    const totalPrice = input.totalPrice ?? input.unitPrice * input.lotSize;

    return this.repository.createPriceSnapshot({
      item: { connect: { id: input.itemId } },
      user: { connect: { id: user.id } },
      group: groupId ? { connect: { id: groupId } } : undefined,
      source: input.sourceId ? { connect: { id: input.sourceId } } : undefined,
      unitPrice: input.unitPrice,
      lotSize: input.lotSize,
      totalPrice,
      priceType: input.priceType,
      scope: input.scope,
      observedAt: input.observedAt ?? new Date(),
    });
  }

  async listPriceHistory(itemId: string) {
    const item = await this.repository.findItemById(itemId);

    if (!item) {
      throw new ApiError(404, 'ITEM_NOT_FOUND', 'Item introuvable.');
    }

    const history = await this.repository.listPriceHistory(itemId);

    return history.map((snapshot) => ({
      ...snapshot,
      freshness: this.priceFreshness(snapshot.observedAt),
    }));
  }

  async getLatestPrice(itemId: string, rawQuery: LatestPriceQuery = {}) {
    const item = await this.repository.findItemById(itemId);

    if (!item) {
      throw new ApiError(404, 'ITEM_NOT_FOUND', 'Item introuvable.');
    }

    const query = latestPriceQuerySchema.parse(rawQuery);
    const snapshot = await this.repository.findLatestPrice({
      itemId,
      priceType: query.priceType,
      scope: query.scope,
      groupId: query.groupId,
    });

    if (!snapshot) {
      return null;
    }

    return {
      ...snapshot,
      freshness: this.priceFreshness(snapshot.observedAt),
    };
  }

  async getLatestPriceForCalculation(
    itemId: string,
    user: AuthenticatedUser,
    priceType?: CreatePriceSnapshotInput['priceType'],
  ) {
    const snapshot = await this.repository.findLatestPriceForCalculation({
      itemId,
      priceType,
      OR: [
        { scope: 'personal', userId: user.id },
        { scope: 'group', groupId: user.groupId },
        { scope: 'global' },
      ],
    });

    if (!snapshot) {
      return null;
    }

    return {
      ...snapshot,
      freshness: this.priceFreshness(snapshot.observedAt),
    };
  }

  async createEconomicSnapshot(rawInput: CreateEconomicSnapshotInput, user: AuthenticatedUser) {
    const input = createEconomicSnapshotSchema.parse(rawInput);
    const groupId = input.groupId ?? user.groupId;

    return this.repository.createEconomicSnapshot({
      user: { connect: { id: user.id } },
      group: { connect: { id: groupId } },
      snapshotType: input.snapshotType,
      dataJson: input.dataJson as Prisma.InputJsonValue,
    });
  }

  priceFreshness(observedAt: Date): PriceFreshness {
    const ageMs = Date.now() - observedAt.getTime();
    const ageDays = Math.max(0, Math.floor(ageMs / 86_400_000));

    return {
      observedAt,
      ageDays,
      isStale: ageDays > this.staleAfterDays,
      staleAfterDays: this.staleAfterDays,
    };
  }

  private resolveGroupId(
    scope: CreatePriceSnapshotInput['scope'],
    requestedGroupId: string | undefined,
    user: AuthenticatedUser,
  ) {
    if (scope === 'personal') {
      return undefined;
    }

    if (scope === 'group') {
      return requestedGroupId ?? user.groupId;
    }

    return requestedGroupId;
  }
}
