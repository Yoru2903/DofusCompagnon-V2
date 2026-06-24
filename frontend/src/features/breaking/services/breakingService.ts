import { apiRequest } from '../../../services/apiClient.js';
import { getStoredToken } from '../../core/services/authService.js';

export type BreakingSession = {
  id: string;
  name: string;
  sessionDate: string;
  notes?: string | null;
  lines: BreakingSessionLine[];
};

export type BreakingSessionLine = {
  id: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  sourceCraftLineId?: string | null;
  item: { id: string; name: string; verificationStatus?: string };
  results: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    totalValue: number;
    runeItem: { id: string; name: string; verificationStatus?: string };
  }>;
  economicSnapshot?: {
    dataJson?: {
      type?: 'previsionnel' | 'realise';
      tauxBrisage?: number;
      signals?: string[];
      profitability?: { benefit: number; roi: number; type: 'realise' | 'previsionnel' };
    };
  } | null;
};

export type CreateBreakingSessionPayload = {
  name: string;
  notes?: string;
};

export type AddBreakingLinePayload = {
  itemId: string;
  quantity: number;
  unitCost: number;
  tauxBrisage: number;
  sourceCraftLineId?: string;
};

export type AddBreakingResultsPayload = {
  results: Array<{ runeItemId: string; quantity: number; unitPrice: number }>;
};

export type AvailableCraftLine = {
  id: string;
  itemId: string;
  itemName: string;
  sessionName: string;
  sessionDate: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
};

export type BreakingRunePreview = {
  characteristicId: string;
  characteristicName: string;
  characteristicCode: string;
  runeItemId: string;
  runeName: string;
  jetUtilise: number;
  expectedQuantity: number;
  confidence?: 'high' | 'medium' | 'low' | 'special';
  warnings: string[];
  latestPrice: {
    id: string;
    unitPrice: number;
    freshness: { isStale: boolean; ageDays: number; staleAfterDays: number };
  } | null;
};

export function listBreakingSessions() {
  return apiRequest<BreakingSession[]>('/api/breaking/sessions', authenticated());
}

export function createBreakingSession(payload: CreateBreakingSessionPayload) {
  return apiRequest<BreakingSession>('/api/breaking/sessions', {
    ...authenticated(),
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listAvailableCraftLines() {
  return apiRequest<AvailableCraftLine[]>('/api/breaking/craft-lines/available', authenticated());
}

export function previewBreakingRunes(itemId: string, quantity: number, tauxBrisage: number) {
  const params = new URLSearchParams({
    quantity: String(quantity),
    tauxBrisage: String(tauxBrisage),
  });

  return apiRequest<BreakingRunePreview[]>(
    `/api/breaking/items/${itemId}/runes?${params.toString()}`,
    authenticated(),
  );
}

export function addBreakingLine(sessionId: string, payload: AddBreakingLinePayload) {
  return apiRequest<{ line: BreakingSessionLine; signals: string[] }>(
    `/api/breaking/sessions/${sessionId}/lines`,
    {
      ...authenticated(),
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function addBreakingResults(lineId: string, payload: AddBreakingResultsPayload) {
  return apiRequest<{
    line: BreakingSessionLine;
    profitability: { benefit: number; roi: number; type: 'realise' | 'previsionnel' };
  }>(`/api/breaking/lines/${lineId}/results`, {
    ...authenticated(),
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function authenticated(): RequestInit {
  const token = getStoredToken();

  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}
