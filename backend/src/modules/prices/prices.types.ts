export type PriceType = 'resource' | 'rune' | 'item' | 'resale';
export type PriceScope = 'personal' | 'group' | 'global';

export type PriceFreshness = {
  observedAt: Date;
  ageDays: number;
  isStale: boolean;
  staleAfterDays: number;
};

export type SnapshotType =
  | 'craft_calculation'
  | 'breaking_calculation'
  | 'resale_calculation'
  | 'simulation';
