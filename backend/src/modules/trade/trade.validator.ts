import { z } from 'zod';

export const tradeLineStatusSchema = z.enum(['pending', 'sold', 'cancelled']);

export const createTradeSessionSchema = z.object({
  name: z.string().min(1),
  sessionDate: z.coerce.date().optional(),
  notes: z.string().optional(),
  groupId: z.string().min(1).optional(),
});

export const updateTradeSessionSchema = createTradeSessionSchema.partial();

export const addTradeLineSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitBuyPrice: z.number().nonnegative(),
  expectedUnitSellPrice: z.number().nonnegative(),
  feeRate: z.number().min(0).max(1).default(0.02),
});

export const sellTradeLineSchema = z.object({
  actualUnitSellPrice: z.number().nonnegative(),
  feeRate: z.number().min(0).max(1).default(0.02),
});

export type CreateTradeSessionInput = z.input<typeof createTradeSessionSchema>;
export type UpdateTradeSessionInput = z.input<typeof updateTradeSessionSchema>;
export type AddTradeLineInput = z.input<typeof addTradeLineSchema>;
export type SellTradeLineInput = z.input<typeof sellTradeLineSchema>;
