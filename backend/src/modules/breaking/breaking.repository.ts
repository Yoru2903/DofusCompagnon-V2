import type { Prisma, PrismaClient } from '@prisma/client';

export class BreakingRepository {
  constructor(private readonly db: PrismaClient) {}

  createSession(data: Prisma.BreakingSessionCreateInput) {
    return this.db.breakingSession.create({ data, include: breakingSessionInclude });
  }

  updateSession(id: string, data: Prisma.BreakingSessionUpdateInput) {
    return this.db.breakingSession.update({ where: { id }, data, include: breakingSessionInclude });
  }

  softDeleteSession(id: string) {
    return this.db.breakingSession.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: breakingSessionInclude,
    });
  }

  findSessionById(id: string) {
    return this.db.breakingSession.findFirst({
      where: { id, deletedAt: null },
      include: breakingSessionInclude,
    });
  }

  listSessions(where: Prisma.BreakingSessionWhereInput) {
    return this.db.breakingSession.findMany({
      where: { ...where, deletedAt: null },
      include: breakingSessionInclude,
      orderBy: { sessionDate: 'desc' },
    });
  }

  findCraftLineById(id: string) {
    return this.db.craftSessionLine.findUnique({ where: { id } });
  }

  listAvailableCraftLines() {
    return this.db.craftSessionLine.findMany({
      where: {
        status: 'active',
        session: { deletedAt: null },
      },
      include: {
        item: true,
        session: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  markCraftLineBroken(id: string) {
    return this.db.craftSessionLine.update({
      where: { id },
      data: { status: 'broken' },
    });
  }

  findItemBreakingData(itemId: string) {
    return this.db.item.findFirst({
      where: { id: itemId, deletedAt: null },
      include: {
        effects: {
          include: {
            characteristic: {
              include: {
                runeCharacteristics: {
                  where: { runeItem: { runeTier: 'base', deletedAt: null } },
                  include: { runeItem: true },
                },
              },
            },
          },
        },
      },
    });
  }

  createLine(data: Prisma.BreakingSessionLineCreateInput) {
    return this.db.breakingSessionLine.create({ data, include: breakingLineInclude });
  }

  findLineById(id: string) {
    return this.db.breakingSessionLine.findUnique({ where: { id }, include: breakingLineInclude });
  }

  async addResults(params: {
    lineId: string;
    economicSnapshotId: string;
    results: Array<{
      runeItemId: string;
      quantity: number;
      unitPrice: number;
      totalValue: number;
      priceSnapshotId?: string | null;
    }>;
  }) {
    await this.db.breakingResult.createMany({
      data: params.results.map((result) => ({
        breakingSessionLineId: params.lineId,
        runeItemId: result.runeItemId,
        quantity: result.quantity,
        unitPrice: result.unitPrice,
        totalValue: result.totalValue,
        priceSnapshotId: result.priceSnapshotId,
      })),
    });

    return this.db.breakingSessionLine.update({
      where: { id: params.lineId },
      data: { economicSnapshotId: params.economicSnapshotId },
      include: breakingLineInclude,
    });
  }
}

const breakingLineInclude = {
  item: true,
  sourceCraftLine: { include: { session: true, item: true } },
  economicSnapshot: true,
  results: { include: { runeItem: true, priceSnapshot: true } },
} satisfies Prisma.BreakingSessionLineInclude;

const breakingSessionInclude = {
  lines: { include: breakingLineInclude },
} satisfies Prisma.BreakingSessionInclude;
