import { describe, expect, it } from 'vitest';
import {
  calculateBreaking,
  calculateCraftCost,
  calculateProfitability,
  EconomicEngineError,
  valuateRunes,
} from '../modules/economic-engine/economic-engine.service.js';

describe('Economic engine', () => {
  it('calculates craft cost with price traceability', () => {
    const result = calculateCraftCost({
      craftedQuantity: 2,
      ingredients: [
        { itemId: 'res-1', quantity: 3 },
        { itemId: 'res-2', quantity: 4 },
      ],
      pricesByItemId: {
        'res-1': { itemId: 'res-1', unitPrice: 10, priceSnapshotId: 'price-1' },
        'res-2': { itemId: 'res-2', unitPrice: 5, priceSnapshotId: 'price-2' },
      },
    });

    expect(result.totalCost).toBe(50);
    expect(result.unitCost).toBe(25);
    expect(result.priceSnapshotIds).toEqual(['price-1', 'price-2']);
  });

  it('rejects craft cost when an ingredient has no price', () => {
    expect(() =>
      calculateCraftCost({
        ingredients: [{ itemId: 'res-1', quantity: 1 }],
        pricesByItemId: {},
      }),
    ).toThrowError(expect.objectContaining({ code: 'MISSING_PRICE' }));
  });

  it('rejects zero craft quantities', () => {
    expect(() =>
      calculateCraftCost({
        ingredients: [{ itemId: 'res-1', quantity: 0 }],
        pricesByItemId: {
          'res-1': { itemId: 'res-1', unitPrice: 10, priceSnapshotId: 'price-1' },
        },
      }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_QUANTITY' }));
  });

  it('calculates breaking formula and preserves rounding probability identity', () => {
    const result = calculateBreaking({
      tauxBrisage: 0.75,
      effects: [
        {
          characteristicId: 'cha-vi',
          characteristicCode: 'vi',
          runeItemId: 'rune-vi',
          jetUtilise: 40,
          poidsUnitaireCaracteristique: 0.25,
          pwrRuneBase: 1,
          verificationStatus: 'verified',
        },
      ],
    });
    const rune = result.runes[0]!;

    expect(rune.poidsBrute).toBe(10);
    expect(rune.runesObtenuesBrutes).toBe(7.5);
    expect(rune.runesEntieres).toBe(7);
    expect(rune.probabiliteRuneSupplementaire).toBe(0.5);
    expect(rune.runesEntieres + rune.probabiliteRuneSupplementaire).toBe(rune.runesObtenuesBrutes);
  });

  it('supports breaking rate at 0 and 100 percent', () => {
    const baseEffect = {
      characteristicId: 'cha-vi',
      characteristicCode: 'vi',
      runeItemId: 'rune-vi',
      jetUtilise: 40,
      poidsUnitaireCaracteristique: 0.25,
      pwrRuneBase: 1,
      verificationStatus: 'verified' as const,
    };

    expect(
      calculateBreaking({ tauxBrisage: 0, effects: [baseEffect] }).runes[0]?.runesMoyennes,
    ).toBe(0);
    expect(
      calculateBreaking({ tauxBrisage: 1, effects: [baseEffect] }).runes[0]?.runesMoyennes,
    ).toBe(10);
  });

  it('rejects missing breaking rate instead of using a default', () => {
    expect(() => calculateBreaking({ effects: [] })).toThrowError(
      expect.objectContaining({ code: 'MISSING_BREAKING_RATE' }),
    );
  });

  it('signals unverified, special, and PA/PM/PO breaking data without blocking calculation', () => {
    const result = calculateBreaking({
      tauxBrisage: 1,
      effects: [
        {
          characteristicId: 'cha-imported',
          characteristicCode: 'vi',
          runeItemId: 'rune-vi',
          jetUtilise: 20,
          poidsUnitaireCaracteristique: 0.25,
          pwrRuneBase: 1,
          verificationStatus: 'imported',
        },
        {
          characteristicId: 'cha-special',
          characteristicCode: 'special',
          runeItemId: 'rune-special',
          jetUtilise: 1,
          poidsUnitaireCaracteristique: 1,
          pwrRuneBase: 1,
          verificationStatus: 'verified',
          isSpecial: true,
        },
        {
          characteristicId: 'cha-pa',
          characteristicCode: 'pa',
          runeItemId: 'rune-pa',
          jetUtilise: 1,
          poidsUnitaireCaracteristique: 100,
          pwrRuneBase: 100,
          verificationStatus: 'verified',
        },
      ],
    });

    expect(result.runes[0]?.confidence).toBe('low');
    expect(result.runes[0]?.warnings).toContain('UNVERIFIED_DATA');
    expect(result.runes[1]?.confidence).toBe('special');
    expect(result.runes[2]?.confidence).toBe('low');
    expect(result.runes[2]?.warnings).toContain('LOW_CONFIDENCE_PA_PM_PO');
  });

  it('valuates obtained runes with price traceability', () => {
    const result = valuateRunes({
      runes: [{ runeItemId: 'rune-vi', quantity: 7.5 }],
      pricesByRuneItemId: {
        'rune-vi': { itemId: 'rune-vi', unitPrice: 100, priceSnapshotId: 'price-rune-vi' },
      },
    });

    expect(result.totalValue).toBe(750);
    expect(result.priceSnapshotIds).toEqual(['price-rune-vi']);
  });

  it('rejects rune valuation when a rune has no price', () => {
    expect(() =>
      valuateRunes({
        runes: [{ runeItemId: 'rune-vi', quantity: 1 }],
        pricesByRuneItemId: {},
      }),
    ).toThrowError(expect.objectContaining({ code: 'MISSING_RUNE_PRICE' }));
  });

  it('calculates profitability for gain, loss, and zero cost ROI', () => {
    expect(calculateProfitability({ type: 'previsionnel', cost: 100, gain: 140 })).toMatchObject({
      benefit: 40,
      margin: 0.4,
      roi: 40,
    });
    expect(calculateProfitability({ type: 'realise', cost: 100, gain: 75 })).toMatchObject({
      benefit: -25,
      margin: -0.25,
      roi: -25,
    });
    expect(calculateProfitability({ type: 'previsionnel', cost: 0, gain: 0 })).toMatchObject({
      benefit: 0,
      margin: 0,
      roi: 0,
    });
  });

  it('uses a domain error type for invalid amounts', () => {
    expect(() => calculateProfitability({ type: 'realise', cost: -1, gain: 0 })).toThrow(
      EconomicEngineError,
    );
  });
});
