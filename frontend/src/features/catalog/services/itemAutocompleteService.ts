import { apiRequest } from '../../../services/apiClient.js';

export type CatalogItemSuggestion = {
  id: string;
  name: string;
  level: number | null;
  itemType: { id: string; name: string } | null;
  verificationStatus: string;
  isRune: boolean;
  isResource: boolean;
  isCraftable: boolean;
};

export function autocompleteItems(query: string) {
  const params = new URLSearchParams({ q: query, limit: '20' });
  return apiRequest<CatalogItemSuggestion[]>(`/api/items/autocomplete?${params.toString()}`);
}
