import { apiRequest } from '../../../services/apiClient.js';
import { getStoredToken } from '../../core/services/authService.js';

export function simulateCraft(payload: {
  itemId: string;
  quantity: number;
  priceOverrides?: Array<{ itemId: string; unitPrice: number }>;
  save?: boolean;
}) {
  return apiRequest<SimulationResult>('/api/simulator/craft', post(payload));
}

export function simulateBreaking(payload: {
  itemId: string;
  quantity: number;
  tauxBrisage: number;
  save?: boolean;
}) {
  return apiRequest<SimulationResult>('/api/simulator/breaking', post(payload));
}

export function compareItems(payload: { itemIds: string[]; quantity: number; tauxBrisage: number }) {
  return apiRequest<ComparisonResult[]>('/api/simulator/compare', post(payload));
}

export function listSimulations() {
  return apiRequest<SavedSimulation[]>('/api/simulator/simulations', withAuth());
}

export type SimulationResult = {
  type: 'craft' | 'breaking';
  item: { id: string; name: string };
  quantity: number;
  calculation?: { unitCost: number; totalCost: number } | null;
  breaking?: {
    runes: Array<{
      runeItemId: string;
      runeName?: string | null;
      runesMoyennes: number;
      probabiliteRuneSupplementaire: number;
      confidence: 'high' | 'medium' | 'low' | 'special';
      warnings: string[];
    }>;
    warnings: string[];
  };
  valuation?: { totalValue: number };
  missingPrices?: Array<{ itemId: string; itemName: string }>;
  missingRunePrices?: Array<{ runeItemId: string }>;
  unverifiedData?: Array<{ itemId: string; itemName: string }>;
  savedSimulation?: SavedSimulation | null;
};

export type ComparisonResult = {
  itemId: string;
  itemName: string;
  estimatedCost: number;
  estimatedValue: number;
  profitability: { benefit: number; roi: number };
  warnings: string[];
};

export type SavedSimulation = {
  id: string;
  simulationType: string;
  quantity: number;
  createdAt: string;
  item: { name: string };
};

function post(payload: unknown): RequestInit {
  return {
    ...withAuth(),
    method: 'POST',
    body: JSON.stringify(payload),
  };
}

function withAuth(): RequestInit {
  const token = getStoredToken();

  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}
