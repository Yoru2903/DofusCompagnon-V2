import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  autocompleteItems,
  type CatalogItemSuggestion,
} from '../features/catalog/services/itemAutocompleteService.js';

type ItemAutocompleteProps = {
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  onSelect?: (item: CatalogItemSuggestion) => void;
};

export function ItemAutocomplete({
  name,
  label,
  required,
  placeholder = 'Rechercher un item',
  onSelect,
}: ItemAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CatalogItemSuggestion | null>(null);
  const suggestionsQuery = useQuery({
    queryKey: ['item-autocomplete', query],
    queryFn: () => autocompleteItems(query),
    enabled: query.trim().length > 0 && selected?.name !== query,
  });

  return (
    <label className="autocomplete-field">
      <span>{label}</span>
      <input
        value={query}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelected(null);
        }}
        required={required}
        autoComplete="off"
      />
      <input type="hidden" name={name} value={selected?.id ?? ''} />
      {suggestionsQuery.data && suggestionsQuery.data.length > 0 && !selected && (
        <div className="autocomplete-list">
          {suggestionsQuery.data.map((item) => (
            <button
              key={item.id}
              type="button"
              className="autocomplete-option"
              onClick={() => {
                setSelected(item);
                setQuery(item.name);
                onSelect?.(item);
              }}
            >
              <strong>{item.name}</strong>
              <small>
                niv. {item.level ?? '-'} - {item.itemType?.name ?? 'type inconnu'}
              </small>
              {item.verificationStatus !== 'verified' && (
                <span className="badge warning">Donnee non verifiee</span>
              )}
            </button>
          ))}
        </div>
      )}
    </label>
  );
}
