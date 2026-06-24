export type VerificationStatus =
  | 'draft'
  | 'imported'
  | 'verified'
  | 'corrected'
  | 'rejected'
  | 'obsolete';

export type CalculationConfidence = 'high' | 'medium' | 'low' | 'special';

export type PriceTrace = {
  priceSnapshotId: string;
  itemId: string;
  unitPrice: number;
  observedAt?: Date | string;
  verificationStatus?: VerificationStatus;
};

export type CraftIngredientInput = {
  itemId: string;
  quantity: number;
};

export type CraftCostInput = {
  ingredients: CraftIngredientInput[];
  pricesByItemId: Record<string, PriceTrace | undefined>;
  craftedQuantity?: number;
};

export type CraftCostLine = CraftIngredientInput & {
  unitPrice: number;
  totalPrice: number;
  priceSnapshotId: string;
};

export type CraftCostResult = {
  unitCost: number;
  totalCost: number;
  craftedQuantity: number;
  lines: CraftCostLine[];
  priceSnapshotIds: string[];
  warnings: string[];
};

export type BreakingEffectInput = {
  characteristicId: string;
  characteristicCode?: string;
  runeItemId: string;
  jetUtilise: number;
  poidsUnitaireCaracteristique: number;
  pwrRuneBase: number;
  verificationStatus: VerificationStatus;
  isSpecial?: boolean;
};

export type BreakingInput = {
  tauxBrisage?: number;
  effects: BreakingEffectInput[];
};

export type BreakingRuneResult = {
  characteristicId: string;
  characteristicCode?: string;
  runeItemId: string;
  poidsBrute: number;
  runesObtenuesBrutes: number;
  runesEntieres: number;
  probabiliteRuneSupplementaire: number;
  runesMoyennes: number;
  confidence: CalculationConfidence;
  warnings: string[];
};

export type BreakingResult = {
  tauxBrisage: number;
  runes: BreakingRuneResult[];
  warnings: string[];
};

export type RuneQuantityInput = {
  runeItemId: string;
  quantity: number;
};

export type RuneValuationInput = {
  runes: RuneQuantityInput[];
  pricesByRuneItemId: Record<string, PriceTrace | undefined>;
};

export type RuneValuationLine = RuneQuantityInput & {
  unitPrice: number;
  totalPrice: number;
  priceSnapshotId: string;
};

export type RuneValuationResult = {
  totalValue: number;
  lines: RuneValuationLine[];
  priceSnapshotIds: string[];
  warnings: string[];
};

export type ProfitabilityType = 'previsionnel' | 'realise';

export type ProfitabilityInput = {
  type: ProfitabilityType;
  cost: number;
  gain: number;
};

export type ProfitabilityResult = ProfitabilityInput & {
  benefit: number;
  margin: number;
  roi: number;
};
