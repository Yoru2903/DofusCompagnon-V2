import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ItemAutocomplete } from '../components/ItemAutocomplete.js';
import type { CatalogItemSuggestion } from '../features/catalog/services/itemAutocompleteService.js';
import {
  addBreakingLine,
  addBreakingResults,
  createBreakingSession,
  listAvailableCraftLines,
  listBreakingSessions,
  previewBreakingRunes,
  type AvailableCraftLine,
  type BreakingSessionLine,
} from '../features/breaking/services/breakingService.js';
import { getCurrentUser, getDefaultSession, getStoredToken } from '../features/core/services/authService.js';

export function BreakingSessionsPage() {
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<CatalogItemSuggestion | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [tauxBrisage, setTauxBrisage] = useState(0);
  const sessionQuery = useQuery({ queryKey: ['session'], queryFn: ensureSession });
  const sessionsQuery = useQuery({
    queryKey: ['breaking-sessions'],
    queryFn: listBreakingSessions,
    enabled: sessionQuery.isSuccess,
  });
  const selectedSession = sessionsQuery.data?.[0];
  const craftLinesQuery = useQuery({
    queryKey: ['available-craft-lines'],
    queryFn: listAvailableCraftLines,
    enabled: sessionQuery.isSuccess,
  });
  const selectedSource = craftLinesQuery.data?.find((line) => line.id === selectedSourceId);
  const previewItemId = selectedSource?.itemId ?? selectedItem?.id;
  const previewQuery = useQuery({
    queryKey: ['breaking-preview', previewItemId, quantity, tauxBrisage],
    queryFn: () => previewBreakingRunes(previewItemId!, quantity, tauxBrisage),
    enabled: Boolean(previewItemId),
  });
  const createMutation = useMutation({
    mutationFn: createBreakingSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['breaking-sessions'] }),
  });
  const addLineMutation = useMutation({
    mutationFn: (payload: Parameters<typeof addBreakingLine>[1]) =>
      addBreakingLine(selectedSession!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['breaking-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['available-craft-lines'] });
    },
  });

  return (
    <section className="workspace-page">
      <header className="page-header">
        <p className="eyebrow">Brisage</p>
        <h1>Sessions de brisage</h1>
      </header>

      <div className="two-column">
        <section className="panel">
          <h2>Nouvelle session</h2>
          <form
            className="stacked-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              createMutation.mutate({
                name: String(form.get('name') ?? ''),
                notes: String(form.get('notes') ?? ''),
              });
              event.currentTarget.reset();
            }}
          >
            <input name="name" placeholder="Nom de session" required />
            <textarea name="notes" placeholder="Notes" />
            <button type="submit">Creer</button>
          </form>

          <h2>Historique</h2>
          <div className="session-list">
            {sessionsQuery.data?.map((session) => (
              <article key={session.id} className="session-row">
                <strong>{session.name}</strong>
                <small>{new Date(session.sessionDate).toLocaleDateString('fr-FR')}</small>
                <span>{session.lines.length} objet(s)</span>
              </article>
            ))}
            {sessionsQuery.data?.length === 0 && <p className="muted">Aucune session brisage.</p>}
          </div>
        </section>

        <section className="panel">
          <h2>Previsionnel</h2>
          {selectedSession ? (
            <form
              className="stacked-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                addLineMutation.mutate({
                  itemId: String(form.get('itemId') || selectedSource?.itemId || ''),
                  quantity: Number(form.get('quantity') ?? 1),
                  unitCost: Number(form.get('unitCost') ?? 0),
                  tauxBrisage: Number(form.get('tauxBrisage') ?? 0),
                  sourceCraftLineId: selectedSourceId || undefined,
                });
                event.currentTarget.reset();
              }}
            >
              <CraftSourceSelect
                craftLines={craftLinesQuery.data ?? []}
                value={selectedSourceId}
                onChange={setSelectedSourceId}
              />
              {!selectedSourceId && (
                <ItemAutocomplete
                  name="itemId"
                  label="Item brise (achat HDV)"
                  required
                  onSelect={setSelectedItem}
                />
              )}
              <input
                name="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
              />
              <input name="unitCost" type="number" min="0" placeholder="Cout unitaire" />
              <input
                name="tauxBrisage"
                type="number"
                min="0"
                step="0.01"
                placeholder="Taux brisage (ex: 60)"
                value={tauxBrisage}
                onChange={(event) => setTauxBrisage(Number(event.target.value))}
              />
              {previewQuery.data && <RunePreview rows={previewQuery.data} />}
              <button type="submit" disabled={!previewItemId}>
                Ajouter objet
              </button>
            </form>
          ) : (
            <p className="muted">Cree une session pour ajouter un objet brise.</p>
          )}

          <div className="cards-list">
            {selectedSession?.lines.map((line) => (
              <BreakingLineCard key={line.id} line={line} />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function BreakingLineCard({ line }: { line: BreakingSessionLine }) {
  const snapshot = line.economicSnapshot?.dataJson;
  const benefit = snapshot?.profitability?.benefit;
  const roi = snapshot?.profitability?.roi ?? 0;

  return (
    <article className="result-card">
      <div className="card-heading">
        <strong>{line.item.name}</strong>
        <span className={`badge ${snapshot?.type === 'realise' ? 'realized' : 'forecast'}`}>
          {snapshot?.type === 'realise' ? 'Realise' : 'Previsionnel'}
        </span>
      </div>
      <p>
        {line.quantity} objet(s), cout total {formatKamas(line.totalCost)}
      </p>
      {benefit !== undefined && (
        <p className={benefit >= 0 ? 'gain' : 'loss'}>
          Benefice realise : {formatKamas(benefit)} ({Math.round(roi)}%)
        </p>
      )}
      <div className="badge-row">
        {line.sourceCraftLineId && <span className="badge">lie craft</span>}
        {snapshot?.signals?.includes('UNVERIFIED_ITEM') && (
          <span className="badge warning">Donnee non verifiee</span>
        )}
      </div>
      <BreakingLineResultsForm line={line} />
    </article>
  );
}

function CraftSourceSelect({
  craftLines,
  value,
  onChange,
}: {
  craftLines: AvailableCraftLine[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>Source craft optionnelle</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Aucune - item achete HDV</option>
        {craftLines.map((line) => (
          <option key={line.id} value={line.id}>
            [{line.sessionName} - {new Date(line.sessionDate).toLocaleDateString('fr-FR')}] {line.itemName} x{' '}
            {line.quantity}
          </option>
        ))}
      </select>
    </label>
  );
}

function RunePreview({ rows }: { rows: Awaited<ReturnType<typeof previewBreakingRunes>> }) {
  return (
    <div className="cards-list compact-list">
      {rows.map((row) => (
        <article key={row.characteristicId} className="ingredient-row">
          <div>
            <strong>{row.characteristicName}</strong>
            <small>
              Jet {row.jetUtilise} - {row.runeName} - attendu {row.expectedQuantity.toFixed(2)}
            </small>
          </div>
          {row.warnings.includes('LOW_CONFIDENCE_PA_PM_PO') && (
            <span className="badge warning">Confiance basse PA/PM/PO</span>
          )}
          {row.warnings.includes('UNVERIFIED_DATA') && (
            <span className="badge warning">Donnee non verifiee</span>
          )}
          {!row.latestPrice && <span className="badge warning">Prix rune absent</span>}
        </article>
      ))}
    </div>
  );
}

function BreakingLineResultsForm({ line }: { line: BreakingSessionLine }) {
  const queryClient = useQueryClient();
  const tauxBrisage = Number(line.economicSnapshot?.dataJson?.tauxBrisage ?? 0);
  const previewQuery = useQuery({
    queryKey: ['breaking-line-preview', line.id, line.item.id, line.quantity, tauxBrisage],
    queryFn: () => previewBreakingRunes(line.item.id, line.quantity, tauxBrisage),
  });
  const addResultsMutation = useMutation({
    mutationFn: (payload: Parameters<typeof addBreakingResults>[1]) => addBreakingResults(line.id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['breaking-sessions'] }),
  });

  return (
    <form
      className="stacked-form"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        addResultsMutation.mutate({
          results: (previewQuery.data ?? []).map((row) => ({
            runeItemId: row.runeItemId,
            quantity: Number(form.get(`quantity:${row.runeItemId}`) ?? 0),
            unitPrice: Number(form.get(`unitPrice:${row.runeItemId}`) ?? 0),
          })),
        });
      }}
    >
      <h3>Runes reellement obtenues</h3>
      {previewQuery.data?.map((row) => (
        <div key={row.runeItemId} className="ingredient-row">
          <div>
            <strong>{row.runeName}</strong>
            <small>
              {row.characteristicName} - attendu {row.expectedQuantity.toFixed(2)}
            </small>
          </div>
          <input
            name={`quantity:${row.runeItemId}`}
            type="number"
            min="0"
            step="0.01"
            defaultValue={row.expectedQuantity.toFixed(2)}
          />
          <input
            name={`unitPrice:${row.runeItemId}`}
            type="number"
            min="0"
            defaultValue={row.latestPrice?.unitPrice ?? 0}
          />
        </div>
      ))}
      <button type="submit" disabled={!previewQuery.data?.length}>
        Valoriser cet item
      </button>
    </form>
  );
}

async function ensureSession() {
  const token = getStoredToken();

  if (token) {
    return getCurrentUser(token);
  }

  return getDefaultSession();
}

function formatKamas(value: number) {
  return `${Math.round(value).toLocaleString('fr-FR')} k`;
}
