import { apiRequest } from '../../../services/apiClient.js';
import { getStoredToken } from '../../core/services/authService.js';

export type TradeSession = {
  id: string;
  name: string;
  sessionDate: string;
  lines: TradeLine[];
};

export type TradeLine = {
  id: string;
  quantity: number;
  unitBuyPrice: number;
  totalBuyPrice: number;
  expectedUnitSellPrice: number;
  expectedTotalSellPrice: number;
  actualUnitSellPrice?: number | null;
  actualTotalSellPrice?: number | null;
  fees: number;
  status: 'pending' | 'sold' | 'cancelled';
  item: { id: string; name: string };
  economicSnapshot?: {
    dataJson?: {
      type?: 'previsionnel' | 'realise';
      grossProfitability?: { benefit: number; roi: number };
      netProfitability?: { benefit: number; roi: number };
    };
  } | null;
};

export function listTradeSessions() {
  return apiRequest<TradeSession[]>('/api/trade/sessions', authenticated());
}

export function createTradeSession(payload: { name: string; notes?: string }) {
  return apiRequest<TradeSession>('/api/trade/sessions', {
    ...authenticated(),
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function addTradeLine(
  sessionId: string,
  payload: {
    itemId: string;
    quantity: number;
    unitBuyPrice: number;
    expectedUnitSellPrice: number;
    feeRate?: number;
  },
) {
  return apiRequest<TradeLine>(`/api/trade/sessions/${sessionId}/lines`, {
    ...authenticated(),
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function sellTradeLine(lineId: string, payload: { actualUnitSellPrice: number; feeRate?: number }) {
  return apiRequest<{ line: TradeLine; netProfitability: { benefit: number; roi: number } }>(
    `/api/trade/lines/${lineId}/sell`,
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
