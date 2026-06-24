import { z } from 'zod';

const overridePriceSchema = z.object({
  itemId: z.string().min(1),
  unitPrice: z.number().nonnegative(),
});

export const simulateCraftSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  priceOverrides: z.array(overridePriceSchema).default([]),
  save: z.boolean().default(false),
});

export const simulateBreakingSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  tauxBrisage: z.number().nonnegative(),
  save: z.boolean().default(false),
});

export const compareItemsSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1),
  quantity: z.number().int().positive().default(1),
  tauxBrisage: z.number().nonnegative(),
});

export type SimulateCraftInput = z.input<typeof simulateCraftSchema>;
export type SimulateBreakingInput = z.input<typeof simulateBreakingSchema>;
export type CompareItemsInput = z.input<typeof compareItemsSchema>;
