import type { Prisma, PrismaClient } from '@prisma/client';

export class DashboardRepository {
  constructor(private readonly db: PrismaClient) {}

  listCraftLines(where: Prisma.CraftSessionWhereInput) {
    return this.db.craftSessionLine.findMany({
      where: { session: where },
      include: {
        item: true,
        session: true,
        economicSnapshot: true,
      },
    });
  }

  listBreakingLines(where: Prisma.BreakingSessionWhereInput) {
    return this.db.breakingSessionLine.findMany({
      where: { session: where },
      include: {
        item: true,
        session: true,
        results: true,
        economicSnapshot: true,
      },
    });
  }

  listTradeLines(where: Prisma.TradeSessionWhereInput) {
    return this.db.tradeLine.findMany({
      where: { session: where },
      include: {
        item: true,
        session: true,
        economicSnapshot: true,
      },
    });
  }
}
