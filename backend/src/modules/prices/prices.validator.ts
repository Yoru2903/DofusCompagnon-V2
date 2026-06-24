import { z } from 'zod';

export const priceTypeSchema = z.enum(['resource', 'rune', 'item', 'resale']);
export const priceScopeSchema = z.enum(['personal', 'group', 'global']);
export const snapshotTypeSchema = z.enum([
  'craft_calculation',
  'breaking_calculation',
  'resale_calculation',
  'simulation',
]);

export const createPriceSnapshotSchema = z.object({
  itemId: z.string().min(1),
  unitPrice: z.number().positive(),
  lotSize: z.number().int().positive().default(1),
  totalPrice: z.number().positive().optional(),
  priceType: priceTypeSchema,
  scope: priceScopeSchema,
  groupId: z.string().min(1).optional(),
  sourceId: z.string().min(1).optional(),
  observedAt: z.coerce.date().optional(),
});

export const latestPriceQuerySchema = z.object({
  priceType: priceTypeSchema.optional(),
  scope: priceScopeSchema.optional(),
  groupId: z.string().min(1).optional(),
});

export const createEconomicSnapshotSchema = z.object({
  snapshotType: snapshotTypeSchema,
  dataJson: z.record(z.unknown()),
  groupId: z.string().min(1).optional(),
});

export type CreatePriceSnapshotInput = z.infer<typeof createPriceSnapshotSchema>;
export type LatestPriceQuery = z.infer<typeof latestPriceQuerySchema>;
export type CreateEconomicSnapshotInput = z.infer<typeof createEconomicSnapshotSchema>;
