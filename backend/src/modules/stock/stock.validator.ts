import { z } from 'zod';

export const stockScopeSchema = z.enum(['personal', 'group']);
export const movementTypeSchema = z.enum(['in', 'out']);

export const createStockLocationSchema = z.object({
  name: z.string().min(1),
  scope: stockScopeSchema,
  groupId: z.string().min(1).optional(),
});

export const updateStockLocationSchema = createStockLocationSchema.partial();

export const createStockMovementSchema = z.object({
  stockLocationId: z.string().min(1),
  itemId: z.string().min(1),
  movementType: movementTypeSchema,
  quantity: z.number().int().positive(),
  unitValue: z.number().nonnegative(),
  totalValue: z.number().nonnegative().optional(),
  relatedEntityType: z.string().min(1).optional(),
  relatedEntityId: z.string().min(1).optional(),
  notes: z.string().optional(),
});

export type CreateStockLocationInput = z.input<typeof createStockLocationSchema>;
export type UpdateStockLocationInput = z.input<typeof updateStockLocationSchema>;
export type CreateStockMovementInput = z.input<typeof createStockMovementSchema>;
