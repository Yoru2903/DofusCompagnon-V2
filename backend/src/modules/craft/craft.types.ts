export type CraftCostSource = 'theoretical' | 'manual' | 'mixed';

export type ManualIngredientPrice = {
  ingredientItemId: string;
  unitPrice: number;
};

export type CalculationSignal = {
  type: 'stale_price' | 'unverified_data';
  itemId: string;
  message: string;
};
