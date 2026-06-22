import { z } from 'zod';
import { confidenceLevels, runeTiers, verificationStatuses } from './dofus-data.types.js';

export const sourceInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  url: z.string().trim().url().optional().nullable(),
  sourceType: z.string().trim().min(1).max(100),
  reliabilityLevel: z.string().trim().min(1).max(100),
});

export const itemTypeInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(120).optional().nullable(),
});

export const jobInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const itemInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  level: z.number().int().nonnegative().optional().nullable(),
  itemTypeId: z.string().optional().nullable(),
  jobId: z.string().optional().nullable(),
  isCraftable: z.boolean().default(false),
  isRune: z.boolean().default(false),
  isResource: z.boolean().default(false),
  runeTier: z.enum(runeTiers).optional().nullable(),
  panoplyName: z.string().trim().max(200).optional().nullable(),
  verificationStatus: z.enum(verificationStatuses).default('draft'),
  confidenceLevel: z.enum(confidenceLevels).default('low'),
  sourceId: z.string().optional().nullable(),
});

export const recipeInputSchema = z.object({
  resultItemId: z.string(),
  jobId: z.string().optional().nullable(),
  version: z.number().int().positive().default(1),
  verificationStatus: z.enum(verificationStatuses).default('draft'),
  confidenceLevel: z.enum(confidenceLevels).default('low'),
  sourceId: z.string().optional().nullable(),
  ingredients: z
    .array(
      z.object({
        ingredientItemId: z.string(),
        quantity: z.number().int().positive(),
      }),
    )
    .default([]),
});

export const runesFileSchema = z.object({
  meta: z.record(z.unknown()),
  runes: z.array(
    z.object({
      code: z.string().trim().min(1),
      nom: z.string().trim().min(1),
      caracteristique: z.string().trim().min(1),
      rune: z.string().trim().min(1),
      pwr: z.number().positive(),
      bonus: z.number(),
      tier: z.enum(runeTiers),
      special: z.boolean().default(false),
      source_status: z.string().trim().min(1),
    }),
  ),
});

export const dofusBookEquipmentSchema = z.object({
  id: z.union([z.string(), z.number()]),
  official: z.unknown().optional(),
  level: z.number().int().optional().nullable(),
  category_id: z.union([z.string(), z.number()]).optional().nullable(),
  category_name: z.string().optional().nullable(),
  category_type: z.string().optional().nullable(),
  name: z.string().trim().min(1),
  slug: z.string().optional().nullable(),
  cloth_id: z.union([z.string(), z.number()]).optional().nullable(),
  cloth_name: z.string().optional().nullable(),
  effects: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]).optional(),
        name: z.string().trim().min(1),
        type: z.string(),
        min: z.number().int().optional().nullable(),
        max: z.number().int().optional().nullable(),
        spell: z.unknown().optional(),
        spellDesc: z.unknown().optional(),
      }),
    )
    .default([]),
  ingredients: z
    .array(
      z.object({
        item_id: z.union([z.string(), z.number()]),
        name: z.string().trim().min(1),
        count: z.number().int().positive(),
      }),
    )
    .default([]),
  constraints: z.unknown().optional(),
  weapon: z.unknown().optional(),
  skin: z.unknown().optional(),
});

export const equipmentImportBodySchema = z.object({
  equipments: z.array(dofusBookEquipmentSchema),
});

export const dofusBookUrlImportSchema = z.object({
  url: z.string().url(),
});

export type SourceInput = z.infer<typeof sourceInputSchema>;
export type ItemTypeInput = z.infer<typeof itemTypeInputSchema>;
export type JobInput = z.infer<typeof jobInputSchema>;
export type ItemInput = z.infer<typeof itemInputSchema>;
export type RecipeInput = z.infer<typeof recipeInputSchema>;
export type RunesFileInput = z.infer<typeof runesFileSchema>;
export type DofusBookEquipmentInput = z.infer<typeof dofusBookEquipmentSchema>;
