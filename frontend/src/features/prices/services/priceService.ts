import { apiRequest } from '../../../services/apiClient.js';
import { getStoredToken } from '../../core/services/authService.js';

export function createPriceSnapshot(payload: {
  itemId: string;
  unitPrice: number;
  lotSize: number;
  priceType: 'resource' | 'rune' | 'item' | 'resale';
  scope: 'personal' | 'group' | 'global';
}) {
  const token = getStoredToken();

  return apiRequest('/api/prices', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: JSON.stringify(payload),
  });
}
