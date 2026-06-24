import type {
  BreakingInput,
  BreakingRuneResult,
  BreakingResult,
  CalculationConfidence,
  CraftCostInput,
  CraftCostResult,
  ProfitabilityInput,
  ProfitabilityResult,
  RuneValuationInput,
  RuneValuationResult,
} from './economic-engine.types.js';

export class EconomicEngineError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

const specialRuneCodes = new Set(['pa', 'pm', 'po']);

export function calculateCraftCost(input: CraftCostInput): CraftCostResult {
  const craftedQuantity = input.craftedQuantity ?? 1;

  if (!Number.isFinite(craftedQuantity) || craftedQuantity <= 0) {
    throw new EconomicEngineError('INVALID_QUANTITY', 'La quantite fabriquee doit etre positive.');
  }

  const warnings: string[] = [];
  const lines = input.ingredients.map((ingredient) => {
    if (!Number.isInteger(ingredient.quantity) || ingredient.quantity <= 0) {
      throw new EconomicEngineError(
        'INVALID_QUANTITY',
        'La quantite ingredient doit etre positive.',
        {
          itemId: ingredient.itemId,
          quantity: ingredient.quantity,
        },
      );
    }

    const price = input.pricesByItemId[ingredient.itemId];

    if (!price) {
      throw new EconomicEngineError('MISSING_PRICE', 'Prix ingredient manquant.', {
        itemId: ingredient.itemId,
      });
    }

    if (price.verificationStatus && price.verificationStatus !== 'verified') {
      warnings.push(`UNVERIFIED_PRICE:${ingredient.itemId}`);
    }

    return {
      ...ingredient,
      unitPrice: price.unitPrice,
      totalPrice: ingredient.quantity * price.unitPrice,
      priceSnapshotId: price.priceSnapshotId,
    };
  });
  const totalCost = lines.reduce((sum, line) => sum + line.totalPrice, 0);

  return {
    unitCost: totalCost / craftedQuantity,
    totalCost,
    craftedQuantity,
    lines,
    priceSnapshotIds: lines.map((line) => line.priceSnapshotId),
    warnings,
  };
}

export function calculateBreaking(input: BreakingInput): BreakingResult {
  if (input.tauxBrisage === undefined || input.tauxBrisage === null) {
    throw new EconomicEngineError('MISSING_BREAKING_RATE', 'Le taux de brisage est obligatoire.');
  }

  if (!Number.isFinite(input.tauxBrisage) || input.tauxBrisage < 0) {
    throw new EconomicEngineError('INVALID_BREAKING_RATE', 'Le taux de brisage doit etre positif.');
  }

  const runes = input.effects.map((effect) => calculateBreakingEffect(input.tauxBrisage!, effect));
  const warnings = Array.from(new Set(runes.flatMap((rune) => rune.warnings)));

  return {
    tauxBrisage: input.tauxBrisage,
    runes,
    warnings,
  };
}

export function valuateRunes(input: RuneValuationInput): RuneValuationResult {
  const warnings: string[] = [];
  const lines = input.runes.map((rune) => {
    if (!Number.isFinite(rune.quantity) || rune.quantity < 0) {
      throw new EconomicEngineError('INVALID_QUANTITY', 'La quantite de rune doit etre positive.', {
        runeItemId: rune.runeItemId,
        quantity: rune.quantity,
      });
    }

    const price = input.pricesByRuneItemId[rune.runeItemId];

    if (!price) {
      throw new EconomicEngineError('MISSING_RUNE_PRICE', 'Prix rune manquant.', {
        runeItemId: rune.runeItemId,
      });
    }

    if (price.verificationStatus && price.verificationStatus !== 'verified') {
      warnings.push(`UNVERIFIED_PRICE:${rune.runeItemId}`);
    }

    return {
      ...rune,
      unitPrice: price.unitPrice,
      totalPrice: rune.quantity * price.unitPrice,
      priceSnapshotId: price.priceSnapshotId,
    };
  });

  return {
    totalValue: lines.reduce((sum, line) => sum + line.totalPrice, 0),
    lines,
    priceSnapshotIds: lines.map((line) => line.priceSnapshotId),
    warnings,
  };
}

export function calculateProfitability(input: ProfitabilityInput): ProfitabilityResult {
  if (
    !Number.isFinite(input.cost) ||
    input.cost < 0 ||
    !Number.isFinite(input.gain) ||
    input.gain < 0
  ) {
    throw new EconomicEngineError('INVALID_AMOUNT', 'Les montants doivent etre positifs.');
  }

  const benefit = input.gain - input.cost;
  const ratio = input.cost === 0 ? 0 : benefit / input.cost;

  return {
    ...input,
    benefit,
    margin: ratio,
    roi: ratio * 100,
  };
}

function calculateBreakingEffect(
  tauxBrisage: number,
  effect: BreakingInput['effects'][number],
): BreakingRuneResult {
  if (
    !Number.isFinite(effect.jetUtilise) ||
    !Number.isFinite(effect.poidsUnitaireCaracteristique) ||
    !Number.isFinite(effect.pwrRuneBase) ||
    effect.pwrRuneBase <= 0
  ) {
    throw new EconomicEngineError('INVALID_BREAKING_EFFECT', 'Effet de brisage invalide.', effect);
  }

  const poidsBrute = effect.jetUtilise * effect.poidsUnitaireCaracteristique;
  const runesObtenuesBrutes = (poidsBrute * tauxBrisage) / effect.pwrRuneBase;
  const runesEntieres = Math.floor(runesObtenuesBrutes);
  const probabiliteRuneSupplementaire = runesObtenuesBrutes - runesEntieres;
  const warnings = breakingWarnings(effect);

  return {
    characteristicId: effect.characteristicId,
    characteristicCode: effect.characteristicCode,
    runeItemId: effect.runeItemId,
    poidsBrute,
    runesObtenuesBrutes,
    runesEntieres,
    probabiliteRuneSupplementaire,
    runesMoyennes: runesEntieres + probabiliteRuneSupplementaire,
    confidence: breakingConfidence(effect),
    warnings,
  };
}

function breakingConfidence(effect: BreakingInput['effects'][number]): CalculationConfidence {
  if (effect.isSpecial) {
    return 'special';
  }

  if (isPaPmPo(effect.characteristicCode) || effect.verificationStatus !== 'verified') {
    return 'low';
  }

  return 'medium';
}

function breakingWarnings(effect: BreakingInput['effects'][number]) {
  const warnings: string[] = [];

  if (effect.verificationStatus !== 'verified') {
    warnings.push('UNVERIFIED_DATA');
  }

  if (effect.isSpecial) {
    warnings.push('SPECIAL_EFFECT');
  }

  if (isPaPmPo(effect.characteristicCode)) {
    warnings.push('LOW_CONFIDENCE_PA_PM_PO');
  }

  return warnings;
}

function isPaPmPo(code?: string) {
  return code ? specialRuneCodes.has(code.toLowerCase()) : false;
}
