import type { Prisma, PrismaClient } from '@prisma/client';

export class PricesRepository {
  constructor(private readonly db: PrismaClient) {}

  findItemById(id: string) {
    return this.db.item.findFirst({ where: { id, deletedAt: null } });
  }

  findGroupById(id: string) {
    return this.db.group.findUnique({ where: { id } });
  }

  createPriceSnapshot(data: Prisma.PriceSnapshotCreateInput) {
    return this.db.priceSnapshot.create({ data, include: { item: true, source: true } });
  }

  listPriceHistory(itemId: string) {
    return this.db.priceSnapshot.findMany({
      where: { itemId },
      include: { item: true, source: true },
      orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  findLatestPrice(where: Prisma.PriceSnapshotWhereInput) {
    return this.db.priceSnapshot.findFirst({
      where,
      include: { item: true, source: true },
      orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  findLatestPriceForCalculation(where: Prisma.PriceSnapshotWhereInput) {
    return this.db.priceSnapshot.findFirst({
      where,
      include: { item: true, source: true },
      orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  createEconomicSnapshot(data: Prisma.EconomicSnapshotCreateInput) {
    return this.db.economicSnapshot.create({ data });
  }
}
