import type { Prisma, PrismaClient } from '@prisma/client';

export class TradeRepository {
  constructor(private readonly db: PrismaClient) {}

  createSession(data: Prisma.TradeSessionCreateInput) {
    return this.db.tradeSession.create({ data, include: tradeSessionInclude });
  }

  updateSession(id: string, data: Prisma.TradeSessionUpdateInput) {
    return this.db.tradeSession.update({ where: { id }, data, include: tradeSessionInclude });
  }

  softDeleteSession(id: string) {
    return this.db.tradeSession.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: tradeSessionInclude,
    });
  }

  findSessionById(id: string) {
    return this.db.tradeSession.findFirst({
      where: { id, deletedAt: null },
      include: tradeSessionInclude,
    });
  }

  listSessions() {
    return this.db.tradeSession.findMany({
      where: { deletedAt: null },
      include: tradeSessionInclude,
      orderBy: { sessionDate: 'desc' },
    });
  }

  findItemById(id: string) {
    return this.db.item.findFirst({ where: { id, deletedAt: null } });
  }

  createLine(data: Prisma.TradeLineCreateInput) {
    return this.db.tradeLine.create({ data, include: tradeLineInclude });
  }

  findLineById(id: string) {
    return this.db.tradeLine.findUnique({ where: { id }, include: tradeLineInclude });
  }

  updateLine(id: string, data: Prisma.TradeLineUpdateInput) {
    return this.db.tradeLine.update({ where: { id }, data, include: tradeLineInclude });
  }
}

const tradeLineInclude = {
  item: true,
  economicSnapshot: true,
} satisfies Prisma.TradeLineInclude;

const tradeSessionInclude = {
  lines: { include: tradeLineInclude },
} satisfies Prisma.TradeSessionInclude;
