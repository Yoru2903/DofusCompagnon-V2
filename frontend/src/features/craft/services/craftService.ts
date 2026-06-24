import { apiRequest } from '../../../services/apiClient.js';
import { getStoredToken } from '../../core/services/authService.js';

export type CraftSession = {
  id: string;
  name: string;
  sessionDate: string;
  notes?: string | null;
  lines: CraftSessionLine[];
};

export type CraftSessionLine = {
  id: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  costSource: 'theoretical' | 'manual' | 'mixed';
  status?: 'active' | 'broken';
  item: { id: string; name: string; verificationStatus?: string };
  ingredients: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    ingredientItem: { id: string; name: string; verificationStatus?: string };
  }>;
  economicSnapshot?: {
    dataJson?: {
      type?: 'previsionnel' | 'realise';
      signals?: Array<{ type: string; itemId: string; message: string }>;
    };
  } | null;
};

export type CraftRecipeOption = {
  id: string;
  version: number;
  ingredients: Array<{
    id: string;
    ingredientItemId: string;
    ingredientItem: { id: string; name: string; verificationStatus?: string };
    quantity: number;
    latestPrice: {
      id: string;
      unitPrice: number;
      freshness: { isStale: boolean; ageDays: number; staleAfterDays: number };
    } | null;
  }>;
};

export type CraftStats = {
  craftCount: number;
  averageUnitCost: number;
  totalCost: number;
  totalQuantity: number;
  evolution: Array<{ date: string; craftCount: number; totalCost: number }>;
};

export type CreateCraftSessionPayload = {
  name: string;
  notes?: string;
};

export type AddCraftLinePayload = {
  itemId: string;
  recipeId: string;
  quantity: number;
  costSource: 'theoretical' | 'manual' | 'mixed';
  manualPrices?: Array<{ ingredientItemId: string; unitPrice: number }>;
};

export function listCraftSessions() {
  return apiRequest<CraftSession[]>('/api/craft/sessions', authenticated());
}

export function getCraftStats() {
  return apiRequest<CraftStats>('/api/craft/stats', authenticated());
}

export function createCraftSession(payload: CreateCraftSessionPayload) {
  return apiRequest<CraftSession>('/api/craft/sessions', {
    ...authenticated(),
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listRecipesForItem(itemId: string) {
  return apiRequest<CraftRecipeOption[]>(`/api/craft/items/${itemId}/recipes`, authenticated());
}

export function addCraftLine(sessionId: string, payload: AddCraftLinePayload) {
  return apiRequest<{ line: CraftSessionLine; signals: Array<{ type: string; message: string }> }>(
    `/api/craft/sessions/${sessionId}/lines`,
    {
      ...authenticated(),
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

function authenticated(): RequestInit {
  const token = getStoredToken();

  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}
