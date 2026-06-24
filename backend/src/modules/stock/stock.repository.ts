import type { Prisma, PrismaClient } from '@prisma/client';

export class StockRepository {
  constructor(private readonly db: PrismaClient) {}

  createLocation(data: Prisma.StockLocationCreateInput) {
    return this.db.stockLocation.create({ data, include: stockLocationInclude });
  }

  updateLocation(id: string, data: Prisma.StockLocationUpdateInput) {
    return this.db.stockLocation.update({ where: { id }, data, include: stockLocationInclude });
  }

  softDeleteLocation(id: string) {
    return this.db.stockLocation.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: stockLocationInclude,
    });
  }

  findLocationById(id: string) {
    return this.db.stockLocation.findFirst({
      where: { id, deletedAt: null },
      include: stockLocationInclude,
    });
  }

  listLocations() {
    return this.db.stockLocation.findMany({
      where: { deletedAt: null },
      include: stockLocationInclude,
      orderBy: { name: 'asc' },
    });
  }

  findDefaultLocation(scope: string, userId: string, groupId: string) {
    return this.db.stockLocation.findFirst({
      where: {
        scope,
        userId: scope === 'personal' ? userId : undefined,
        groupId: scope === 'group' ? groupId : undefined,
        deletedAt: null,
      },
    });
  }

  createMovement(data: Prisma.StockMovementCreateInput) {
    return this.db.stockMovement.create({ data, include: stockMovementInclude });
  }

  listMovements(locationId: string) {
    return this.db.stockMovement.findMany({
      where: { stockLocationId: locationId },
      include: stockMovementInclude,
      orderBy: { createdAt: 'desc' },
    });
  }
}

const stockMovementInclude = {
  item: true,
} satisfies Prisma.StockMovementInclude;

const stockLocationInclude = {
  movements: { include: stockMovementInclude },
} satisfies Prisma.StockLocationInclude;
