import type { Prisma, PrismaClient } from '@prisma/client';

export class CraftRepository {
  constructor(private readonly db: PrismaClient) {}

  createSession(data: Prisma.CraftSessionCreateInput) {
    return this.db.craftSession.create({ data, include: craftSessionInclude });
  }

  updateSession(id: string, data: Prisma.CraftSessionUpdateInput) {
    return this.db.craftSession.update({ where: { id }, data, include: craftSessionInclude });
  }

  softDeleteSession(id: string) {
    return this.db.craftSession.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: craftSessionInclude,
    });
  }

  findSessionById(id: string) {
    return this.db.craftSession.findFirst({
      where: { id, deletedAt: null },
      include: craftSessionInclude,
    });
  }

  listSessions(where: Prisma.CraftSessionWhereInput) {
    return this.db.craftSession.findMany({
      where: { ...where, deletedAt: null },
      include: craftSessionInclude,
      orderBy: { sessionDate: 'desc' },
    });
  }

  findRecipeForItem(recipeId: string, itemId: string) {
    return this.db.recipe.findFirst({
      where: { id: recipeId, resultItemId: itemId, deletedAt: null },
      include: {
        resultItem: true,
        ingredients: {
          include: {
            ingredientItem: true,
          },
        },
      },
    });
  }

  listRecipesForItem(itemId: string) {
    return this.db.recipe.findMany({
      where: { resultItemId: itemId, deletedAt: null },
      include: {
        resultItem: true,
        ingredients: {
          include: {
            ingredientItem: true,
          },
          orderBy: { ingredientItem: { name: 'asc' } },
        },
      },
      orderBy: { version: 'desc' },
    });
  }

  async createLineWithIngredients(params: {
    sessionId: string;
    itemId: string;
    recipeId: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    costSource: string;
    economicSnapshotId: string;
    ingredients: Array<{
      ingredientItemId: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      priceSnapshotId?: string | null;
    }>;
  }) {
    return this.db.craftSessionLine.create({
      data: {
        session: { connect: { id: params.sessionId } },
        item: { connect: { id: params.itemId } },
        recipe: { connect: { id: params.recipeId } },
        quantity: params.quantity,
        unitCost: params.unitCost,
        totalCost: params.totalCost,
        costSource: params.costSource,
        status: 'active',
        economicSnapshot: { connect: { id: params.economicSnapshotId } },
        ingredients: {
          create: params.ingredients.map((ingredient) => ({
            ingredientItem: { connect: { id: ingredient.ingredientItemId } },
            quantity: ingredient.quantity,
            unitPrice: ingredient.unitPrice,
            totalPrice: ingredient.totalPrice,
            priceSnapshot: ingredient.priceSnapshotId
              ? { connect: { id: ingredient.priceSnapshotId } }
              : undefined,
          })),
        },
      },
      include: craftLineInclude,
    });
  }

  stats() {
    return Promise.all([
      this.db.craftSessionLine.aggregate({
        _count: { id: true },
        _avg: { unitCost: true },
        _sum: { totalCost: true, quantity: true },
      }),
      this.db.craftSessionLine.findMany({
        select: {
          createdAt: true,
          totalCost: true,
          quantity: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
  }
}

const craftLineInclude = {
  item: true,
  recipe: true,
  ingredients: { include: { ingredientItem: true, priceSnapshot: true } },
  economicSnapshot: true,
} satisfies Prisma.CraftSessionLineInclude;

const craftSessionInclude = {
  lines: { include: craftLineInclude },
} satisfies Prisma.CraftSessionInclude;
