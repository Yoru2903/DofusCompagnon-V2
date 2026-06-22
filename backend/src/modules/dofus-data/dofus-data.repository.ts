import type { Prisma, PrismaClient } from '@prisma/client';

export class DofusDataRepository {
  constructor(private readonly db: PrismaClient) {}

  transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.$transaction(callback);
  }

  source = {
    list: () => this.db.dataSource.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
    findById: (id: string) => this.db.dataSource.findFirst({ where: { id, deletedAt: null } }),
    findByName: (name: string) => this.db.dataSource.findUnique({ where: { name } }),
    create: (data: Prisma.DataSourceCreateInput) => this.db.dataSource.create({ data }),
    update: (id: string, data: Prisma.DataSourceUpdateInput) =>
      this.db.dataSource.update({ where: { id }, data }),
    softDelete: (id: string) =>
      this.db.dataSource.update({ where: { id }, data: { deletedAt: new Date() } }),
  };

  itemType = {
    list: () => this.db.itemType.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
    findById: (id: string) => this.db.itemType.findFirst({ where: { id, deletedAt: null } }),
    findByNameCategory: (name: string, category: string | null) =>
      this.db.itemType.findFirst({ where: { name, category, deletedAt: null } }),
    create: (data: Prisma.ItemTypeCreateInput) => this.db.itemType.create({ data }),
    update: (id: string, data: Prisma.ItemTypeUpdateInput) =>
      this.db.itemType.update({ where: { id }, data }),
    softDelete: (id: string) =>
      this.db.itemType.update({ where: { id }, data: { deletedAt: new Date() } }),
  };

  job = {
    list: () => this.db.job.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
    findById: (id: string) => this.db.job.findFirst({ where: { id, deletedAt: null } }),
    create: (data: Prisma.JobCreateInput) => this.db.job.create({ data }),
    update: (id: string, data: Prisma.JobUpdateInput) => this.db.job.update({ where: { id }, data }),
    softDelete: (id: string) => this.db.job.update({ where: { id }, data: { deletedAt: new Date() } }),
  };

  item = {
    list: () =>
      this.db.item.findMany({
        where: { deletedAt: null },
        include: { itemType: true, job: true, source: true },
        orderBy: { name: 'asc' },
      }),
    findById: (id: string) =>
      this.db.item.findFirst({
        where: { id, deletedAt: null },
        include: { itemType: true, job: true, source: true },
      }),
    findByExternalId: (externalId: string) => this.db.item.findUnique({ where: { externalId } }),
    search: (normalizedQuery: string) =>
      this.db.item.findMany({
        where: {
          deletedAt: null,
          normalizedName: { contains: normalizedQuery },
        },
        orderBy: { name: 'asc' },
      }),
    create: (data: Prisma.ItemCreateInput) => this.db.item.create({ data }),
    update: (id: string, data: Prisma.ItemUpdateInput) => this.db.item.update({ where: { id }, data }),
    softDelete: (id: string) =>
      this.db.item.update({ where: { id }, data: { deletedAt: new Date() } }),
  };

  recipe = {
    list: () =>
      this.db.recipe.findMany({
        where: { deletedAt: null },
        include: { resultItem: true, ingredients: { include: { ingredientItem: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    findById: (id: string) =>
      this.db.recipe.findFirst({
        where: { id, deletedAt: null },
        include: { ingredients: { include: { ingredientItem: true } } },
      }),
    create: (data: Prisma.RecipeCreateInput) => this.db.recipe.create({ data }),
    update: (id: string, data: Prisma.RecipeUpdateInput) =>
      this.db.recipe.update({ where: { id }, data }),
    softDelete: (id: string) =>
      this.db.recipe.update({ where: { id }, data: { deletedAt: new Date() } }),
  };

  stats() {
    return Promise.all([
      this.db.item.count({ where: { deletedAt: null } }),
      this.db.item.count({ where: { isRune: true, deletedAt: null } }),
      this.db.item.count({ where: { isResource: true, deletedAt: null } }),
      this.db.item.count({ where: { isRune: false, isResource: false, deletedAt: null } }),
    ]).then(([items, runes, resources, equipments]) => ({ items, runes, resources, equipments }));
  }
}
