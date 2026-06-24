import type { Prisma, PrismaClient } from '@prisma/client';

export class SimulatorRepository {
  constructor(private readonly db: PrismaClient) {}

  findItemById(id: string) {
    return this.db.item.findFirst({
      where: { id, deletedAt: null },
      include: { itemType: true },
    });
  }

  findRecipeForItem(itemId: string) {
    return this.db.recipe.findFirst({
      where: { resultItemId: itemId, deletedAt: null },
      include: {
        resultItem: true,
        ingredients: { include: { ingredientItem: true } },
      },
      orderBy: { version: 'desc' },
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

  createSimulation(data: Prisma.SimulationCreateInput) {
    return this.db.simulation.create({
      data,
      include: { item: true, economicSnapshot: true },
    });
  }

  listSimulations(userId: string) {
    return this.db.simulation.findMany({
      where: { userId },
      include: { item: true, economicSnapshot: true },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
  }
}
