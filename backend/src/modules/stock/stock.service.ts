import { ApiError } from '../../shared/errors/api-error.js';
import type { AuthenticatedUser } from '../core/core.types.js';
import type { PricesService } from '../prices/prices.service.js';
import type { StockRepository } from './stock.repository.js';
import {
  createStockLocationSchema,
  createStockMovementSchema,
  updateStockLocationSchema,
  type CreateStockLocationInput,
  type CreateStockMovementInput,
  type UpdateStockLocationInput,
} from './stock.validator.js';

export class StockService {
  constructor(
    private readonly repository: StockRepository,
    private readonly pricesService: PricesService,
  ) {}

  async createLocation(rawInput: CreateStockLocationInput, user: AuthenticatedUser) {
    const input = createStockLocationSchema.parse(rawInput);

    return this.repository.createLocation({
      name: input.name,
      scope: input.scope,
      user: input.scope === 'personal' ? { connect: { id: user.id } } : undefined,
      group:
        input.scope === 'group' ? { connect: { id: input.groupId ?? user.groupId } } : undefined,
    });
  }

  async updateLocation(id: string, rawInput: UpdateStockLocationInput, user: AuthenticatedUser) {
    const input = updateStockLocationSchema.parse(rawInput);
    await this.ensureLocation(id);

    return this.repository.updateLocation(id, {
      name: input.name,
      scope: input.scope,
      user: input.scope === 'personal' ? { connect: { id: user.id } } : undefined,
      group:
        input.scope === 'group' ? { connect: { id: input.groupId ?? user.groupId } } : undefined,
    });
  }

  async deleteLocation(id: string) {
    await this.ensureLocation(id);
    return this.repository.softDeleteLocation(id);
  }

  listLocations() {
    return this.repository.listLocations();
  }

  async addMovement(rawInput: CreateStockMovementInput, user: AuthenticatedUser) {
    const input = createStockMovementSchema.parse(rawInput);
    await this.ensureLocation(input.stockLocationId);
    const totalValue = input.totalValue ?? input.quantity * input.unitValue;

    return this.repository.createMovement({
      stockLocation: { connect: { id: input.stockLocationId } },
      item: { connect: { id: input.itemId } },
      movementType: input.movementType,
      quantity: input.quantity,
      unitValue: input.unitValue,
      totalValue,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      notes: input.notes,
      creator: { connect: { id: user.id } },
    });
  }

  async inventory(locationId: string, user: AuthenticatedUser) {
    await this.ensureLocation(locationId);
    const movements = await this.repository.listMovements(locationId);
    const byItem = new Map<
      string,
      {
        itemId: string;
        itemName: string;
        quantity: number;
        unitValue: number | null;
        totalValue: number | null;
      }
    >();

    for (const movement of movements) {
      const current =
        byItem.get(movement.itemId) ??
        ({
          itemId: movement.itemId,
          itemName: movement.item.name,
          quantity: 0,
          unitValue: null,
          totalValue: null,
        } satisfies {
          itemId: string;
          itemName: string;
          quantity: number;
          unitValue: number | null;
          totalValue: number | null;
        });
      current.quantity += movement.movementType === 'in' ? movement.quantity : -movement.quantity;
      byItem.set(movement.itemId, current);
    }

    const items = [];

    for (const entry of byItem.values()) {
      if (entry.quantity <= 0) {
        continue;
      }

      const latestPrice = await this.pricesService.getLatestPriceForCalculation(entry.itemId, user);
      entry.unitValue = latestPrice?.unitPrice ?? null;
      entry.totalValue = latestPrice ? latestPrice.unitPrice * entry.quantity : null;
      items.push(entry);
    }

    return {
      locationId,
      items,
      totalValue: items.reduce((sum, item) => sum + (item.totalValue ?? 0), 0),
    };
  }

  async recordCraftOutput(
    line: { id: string; itemId: string; quantity: number; unitCost: number; totalCost: number },
    user: AuthenticatedUser,
  ) {
    const location = await this.ensureDefaultLocation(user);
    return this.addMovement(
      {
        stockLocationId: location.id,
        itemId: line.itemId,
        movementType: 'in',
        quantity: line.quantity,
        unitValue: line.unitCost,
        totalValue: line.totalCost,
        relatedEntityType: 'craft_session_line',
        relatedEntityId: line.id,
        notes: 'Production craft.',
      },
      user,
    );
  }

  async recordBreakingConsumption(
    line: { id: string; itemId: string; quantity: number; unitCost: number; totalCost: number },
    user: AuthenticatedUser,
  ) {
    const location = await this.ensureDefaultLocation(user);
    return this.addMovement(
      {
        stockLocationId: location.id,
        itemId: line.itemId,
        movementType: 'out',
        quantity: line.quantity,
        unitValue: line.unitCost,
        totalValue: line.totalCost,
        relatedEntityType: 'breaking_session_line',
        relatedEntityId: line.id,
        notes: 'Objet consomme en brisage.',
      },
      user,
    );
  }

  async recordBreakingResult(
    result: {
      id: string;
      runeItemId: string;
      quantity: number;
      unitPrice: number;
      totalValue: number;
    },
    user: AuthenticatedUser,
  ) {
    const location = await this.ensureDefaultLocation(user);
    return this.addMovement(
      {
        stockLocationId: location.id,
        itemId: result.runeItemId,
        movementType: 'in',
        quantity: Math.floor(result.quantity),
        unitValue: result.unitPrice,
        totalValue: result.totalValue,
        relatedEntityType: 'breaking_result',
        relatedEntityId: result.id,
        notes: 'Rune obtenue au brisage.',
      },
      user,
    );
  }

  async recordTradeSale(
    line: {
      id: string;
      itemId: string;
      quantity: number;
      actualUnitSellPrice: number | null;
      actualTotalSellPrice: number | null;
    },
    user: AuthenticatedUser,
  ) {
    const location = await this.ensureDefaultLocation(user);
    return this.addMovement(
      {
        stockLocationId: location.id,
        itemId: line.itemId,
        movementType: 'out',
        quantity: line.quantity,
        unitValue: line.actualUnitSellPrice ?? 0,
        totalValue: line.actualTotalSellPrice ?? 0,
        relatedEntityType: 'trade_line',
        relatedEntityId: line.id,
        notes: 'Vente achat-revente.',
      },
      user,
    );
  }

  private async ensureLocation(id: string) {
    const location = await this.repository.findLocationById(id);

    if (!location) {
      throw new ApiError(404, 'STOCK_LOCATION_NOT_FOUND', 'Emplacement de stock introuvable.');
    }

    return location;
  }

  private async ensureDefaultLocation(user: AuthenticatedUser) {
    const existing = await this.repository.findDefaultLocation('group', user.id, user.groupId);

    if (existing) {
      return existing;
    }

    return this.createLocation({ name: 'Stock groupe', scope: 'group' }, user);
  }
}
