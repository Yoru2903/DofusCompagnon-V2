import { apiRequest } from '../../../services/apiClient.js';
import { getStoredToken } from '../../core/services/authService.js';

export type StockLocation = {
  id: string;
  name: string;
  scope: 'personal' | 'group';
  movements: StockMovement[];
};

export type StockMovement = {
  id: string;
  itemId: string;
  movementType: 'in' | 'out';
  quantity: number;
  unitValue: number;
  totalValue: number;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  item: { id: string; name: string };
};

export type StockInventory = {
  locationId: string;
  totalValue: number;
  items: Array<{
    itemId: string;
    itemName: string;
    quantity: number;
    unitValue: number | null;
    totalValue: number | null;
  }>;
};

export function listStockLocations() {
  return apiRequest<StockLocation[]>('/api/stock/locations', authenticated());
}

export function createStockLocation(payload: { name: string; scope: 'personal' | 'group' }) {
  return apiRequest<StockLocation>('/api/stock/locations', {
    ...authenticated(),
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function addStockMovement(payload: {
  stockLocationId: string;
  itemId: string;
  movementType: 'in' | 'out';
  quantity: number;
  unitValue: number;
  relatedEntityType?: string;
  relatedEntityId?: string;
  notes?: string;
}) {
  return apiRequest<StockMovement>('/api/stock/movements', {
    ...authenticated(),
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getStockInventory(locationId: string) {
  return apiRequest<StockInventory>(`/api/stock/locations/${locationId}/inventory`, authenticated());
}

function authenticated(): RequestInit {
  const token = getStoredToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}
