import { z } from 'zod';

export const dashboardQuerySchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  operationType: z.enum(['all', 'craft', 'breaking', 'trade']).default('all'),
});

export const dashboardEvolutionQuerySchema = dashboardQuerySchema.extend({
  period: z.enum(['week', 'month']).default('month'),
});

export type DashboardQuery = z.input<typeof dashboardQuerySchema>;
export type DashboardEvolutionQuery = z.input<typeof dashboardEvolutionQuerySchema>;
