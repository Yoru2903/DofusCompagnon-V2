import { z } from 'zod';

export const createBreakingSessionSchema = z.object({
  name: z.string().min(1),
  sessionDate: z.coerce.date().optional(),
  notes: z.string().optional(),
  groupId: z.string().min(1).optional(),
});

export const updateBreakingSessionSchema = createBreakingSessionSchema.partial();

export const addBreakingLineSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitCost: z.number().nonnegative(),
  sourceCraftLineId: z.string().min(1).optional(),
  tauxBrisage: z.number().nonnegative(),
});

export const addBreakingResultsSchema = z.object({
  results: z
    .array(
      z.object({
        runeItemId: z.string().min(1),
        quantity: z.number().nonnegative(),
        unitPrice: z.number().nonnegative(),
        priceSnapshotId: z.string().min(1).optional(),
      }),
    )
    .min(1),
});

export const listBreakingSessionsQuerySchema = z.object({
  q: z.string().optional(),
  itemId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type CreateBreakingSessionInput = z.input<typeof createBreakingSessionSchema>;
export type UpdateBreakingSessionInput = z.input<typeof updateBreakingSessionSchema>;
export type AddBreakingLineInput = z.input<typeof addBreakingLineSchema>;
export type AddBreakingResultsInput = z.input<typeof addBreakingResultsSchema>;
export type ListBreakingSessionsQuery = z.input<typeof listBreakingSessionsQuerySchema>;
