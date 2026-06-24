import { apiRequest } from '../../../services/apiClient.js';
import { getStoredToken } from '../../core/services/authService.js';

export type DashboardSummary = {
  resultType: 'realise';
  benefitTotal: number;
  expensesTotal: number;
  gainsTotal: number;
  averageRoi: number;
  operationCount: number;
};

export type DashboardOperation = {
  id: string;
  type: 'craft' | 'breaking' | 'trade';
  label: string;
  itemName: string;
  quantity: number;
  date: string;
  cost: number;
  gain: number;
  benefit: number;
  roi: number;
  resultType: 'realise';
};

export type DashboardOperations = {
  resultType: 'realise';
  best: {
    craft: DashboardOperation[];
    breaking: DashboardOperation[];
    trade: DashboardOperation[];
  };
  worst: DashboardOperation[];
};

export type DashboardEvolution = {
  resultType: 'realise';
  period: 'week' | 'month';
  points: Array<{ period: string; benefit: number; cumulativeBenefit: number }>;
};

export function getDashboardSummary() {
  return apiRequest<DashboardSummary>('/api/dashboard/summary', withAuth());
}

export function getDashboardOperations() {
  return apiRequest<DashboardOperations>('/api/dashboard/operations', withAuth());
}

export function getDashboardEvolution(period: 'week' | 'month' = 'month') {
  return apiRequest<DashboardEvolution>(`/api/dashboard/evolution?period=${period}`, withAuth());
}

function withAuth(): RequestInit {
  const token = getStoredToken();

  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}
