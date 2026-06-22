export const verificationStatuses = [
  'imported',
  'draft',
  'verified',
  'corrected',
  'rejected',
  'obsolete',
] as const;

export const runeTiers = ['base', 'pa', 'ra'] as const;
export const confidenceLevels = ['low', 'medium', 'high'] as const;
export const importStatuses = ['pending', 'completed', 'failed', 'partial'] as const;

export type VerificationStatus = (typeof verificationStatuses)[number];
export type RuneTier = (typeof runeTiers)[number];
export type ConfidenceLevel = (typeof confidenceLevels)[number];
export type ImportStatus = (typeof importStatuses)[number];

export type ImportSummary = {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
};

export type RuneImportSummary = ImportSummary & {
  characteristics: number;
  verified: number;
  byStatus: Record<string, number>;
  byTier: Record<string, number>;
};

export type EquipmentImportSummary = ImportSummary & {
  resourcesCreated: number;
  recipesCreated: number;
  effectsCreated: number;
  pagesFetched?: number;
  errors?: Array<{
    externalRef?: string;
    message: string;
  }>;
};
