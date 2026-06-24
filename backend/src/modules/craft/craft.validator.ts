import { z } from 'zod';

export const craftCostSourceSchema = z.enum(['theoretical', 'manual', 'mixed']);

export const createCraftSessionSchema = z.object({
  name: z.string().min(1),
  sessionDate: z.coerce.date().optional(),
  notes: z.string().optional(),
  groupId: z.string().min(1).optional(),
});

export const updateCraftSessionSchema = createCraftSessionSchema.partial();

export const addCraftLineSchema = z.object({
  itemId: z.string().min(1),
  recipeId: z.string().min(1),
  quantity: z.number().int().positive(),
  costSource: craftCostSourceSchema.default('theoretical'),
  manualPrices: z
    .array(
      z.object({
        ingredientItemId: z.string().min(1),
        unitPrice: z.number().positive(),
      }),
    )
    .default([]),
});

export const listCraftSessionsQuerySchema = z.object({
  q: z.string().optional(),
  itemId: z.string().optional(),
  jobId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type CreateCraftSessionInput = z.input<typeof createCraftSessionSchema>;
export type UpdateCraftSessionInput = z.input<typeof updateCraftSessionSchema>;
export type AddCraftLineInput = z.input<typeof addCraftLineSchema>;
export type ListCraftSessionsQuery = z.input<typeof listCraftSessionsQuerySchema>;
