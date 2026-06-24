import { useState, type Dispatch, type SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ItemAutocomplete } from '../components/ItemAutocomplete.js';
import {
  compareItems,
  listSimulations,
  simulateBreaking,
  simulateCraft,
  type ComparisonResult,
  type SimulationResult,
} from '../features/simulator/services/simulatorService.js';

export function SimulatorPage() {
  const queryClient = useQueryClient();
  const [craftResult, setCraftResult] = useState<SimulationResult | null>(null);
  const [breakingResult, setBreakingResult] = useState<SimulationResult | null>(null);
  const [comparison, setComparison] = useState<ComparisonResult[]>([]);
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const historyQuery = useQuery({ queryKey: ['simulations'], queryFn: listSimulations });
  const craftMutation = useMutation({
    mutationFn: simulateCraft,
    onSuccess: (result) => {
      setCraftResult(result);
      queryClient.invalidateQueries({ queryKey: ['simulations'] });
    },
  });
  const breakingMutation = useMutation({
    mutationFn: simulateBreaking,
    onSuccess: (result) => {
      setBreakingResult(result);
      queryClient.invalidateQueries({ queryKey: ['simulations'] });
    },
  });
  const compareMutation = useMutation({
    mutationFn: compareItems,
    onSuccess: setComparison,
  });

  return (
    <section className="workspace-page">
      <header className="page-header">
        <p className="eyebrow">Simulateur</p>
        <h1>Estimer avant d'agir</h1>
      </header>

      <div className="two-column">
        <section className="panel">
          <h2>Simulation craft</h2>
          <form
            className="stacked-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              craftMutation.mutate({
                itemId: String(form.get('itemId') ?? ''),
                quantity: Number(form.get('quantity') ?? 1),
                priceOverrides: Object.entries(priceOverrides).map(([itemId, unitPrice]) => ({
                  itemId,
                  unitPrice,
                })),
                save: form.get('save') === 'on',
              });
            }}
          >
            <ItemAutocomplete name="itemId" label="Item a crafter" required />
            <input name="quantity" type="number" min="1" defaultValue="1" />
            <label className="inline-check">
              <input name="save" type="checkbox" /> Sauvegarder la simulation
            </label>
            <button type="submit">Simuler le craft</button>
          </form>
          {craftResult && <CraftSimulationResult result={craftResult} onOverride={setPriceOverrides} />}

          <h2>Simulation brisage</h2>
          <form
            className="stacked-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              breakingMutation.mutate({
                itemId: String(form.get('itemId') ?? ''),
                quantity: Number(form.get('quantity') ?? 1),
                tauxBrisage: Number(form.get('tauxBrisage') ?? Number.NaN),
                save: form.get('save') === 'on',
              });
            }}
          >
            <ItemAutocomplete name="itemId" label="Item a briser" required />
            <input name="quantity" type="number" min="1" defaultValue="1" />
            <input name="tauxBrisage" type="number" min="0" step="0.01" placeholder="Taux brisage obligatoire" required />
            <label className="inline-check">
              <input name="save" type="checkbox" /> Sauvegarder la simulation
            </label>
            <button type="submit">Simuler le brisage</button>
          </form>
          {breakingResult && <BreakingSimulationResult result={breakingResult} />}
        </section>

        <section className="panel">
          <h2>Comparer des items</h2>
          <form
            className="stacked-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const itemIds = ['itemId1', 'itemId2', 'itemId3']
                .map((name) => String(form.get(name) ?? ''))
                .filter(Boolean);
              compareMutation.mutate({
                itemIds,
                quantity: Number(form.get('quantity') ?? 1),
                tauxBrisage: Number(form.get('tauxBrisage') ?? Number.NaN),
              });
            }}
          >
            <ItemAutocomplete name="itemId1" label="Item 1" required />
            <ItemAutocomplete name="itemId2" label="Item 2" />
            <ItemAutocomplete name="itemId3" label="Item 3" />
            <input name="quantity" type="number" min="1" defaultValue="1" />
            <input name="tauxBrisage" type="number" min="0" step="0.01" placeholder="Taux brisage" required />
            <button type="submit">Comparer</button>
          </form>
          <div className="cards-list">
            {comparison.map((entry) => (
              <article key={entry.itemId} className="result-card">
                <div className="card-heading">
                  <strong>{entry.itemName}</strong>
                  <span className={entry.profitability.benefit >= 0 ? 'gain' : 'loss'}>
                    {formatKamas(entry.profitability.benefit)}
                  </span>
                </div>
                <p>
                  Valeur estimee {formatKamas(entry.estimatedValue)} - ROI{' '}
                  {Math.round(entry.profitability.roi)}%
                </p>
              </article>
            ))}
          </div>

          <h2>Historique sauvegarde</h2>
          <div className="cards-list">
            {historyQuery.data?.map((simulation) => (
              <article key={simulation.id} className="result-card compact-card">
                <strong>{simulation.item.name}</strong>
                <small>
                  {simulation.simulationType} - {simulation.quantity}x -{' '}
                  {new Date(simulation.createdAt).toLocaleDateString('fr-FR')}
                </small>
              </article>
            ))}
            {historyQuery.data?.length === 0 && <p className="muted">Aucune simulation sauvegardee.</p>}
          </div>
        </section>
      </div>
    </section>
  );
}

function CraftSimulationResult({
  result,
  onOverride,
}: {
  result: SimulationResult;
  onOverride: Dispatch<SetStateAction<Record<string, number>>>;
}) {
  return (
    <article className="result-card">
      <div className="card-heading">
        <strong>{result.item.name}</strong>
        <span className="badge forecast">Estimation</span>
      </div>
      {result.calculation ? (
        <p>
          Cout total estime : {formatKamas(result.calculation.totalCost)} - par unite{' '}
          {formatKamas(result.calculation.unitCost)}
        </p>
      ) : (
        <p className="muted">Prix manquants : complete-les ici puis relance la simulation.</p>
      )}
      {result.missingPrices?.map((price) => (
        <label key={price.itemId}>
          <span>Prix unitaire - {price.itemName}</span>
          <input
            type="number"
            min="0"
            onChange={(event) =>
              onOverride((current) => ({ ...current, [price.itemId]: Number(event.target.value) }))
            }
          />
        </label>
      ))}
      {Boolean(result.unverifiedData?.length) && (
        <span className="badge warning">Donnee non verifiee dans le calcul</span>
      )}
    </article>
  );
}

function BreakingSimulationResult({ result }: { result: SimulationResult }) {
  return (
    <article className="result-card">
      <div className="card-heading">
        <strong>{result.item.name}</strong>
        <span className="badge forecast">Estimation</span>
      </div>
      <p>Valeur estimee : {formatKamas(result.valuation?.totalValue ?? 0)}</p>
      <div className="cards-list compact-list">
        {result.breaking?.runes.map((rune) => (
          <div key={`${rune.runeItemId}-${rune.confidence}`} className="rune-result">
            <span>
              {rune.runeName ?? 'Rune inconnue'} : {rune.runesMoyennes.toFixed(2)} attendue(s)
            </span>
            <span className="badge">{Math.round(rune.probabiliteRuneSupplementaire * 100)}% rune bonus</span>
            {rune.warnings.includes('LOW_CONFIDENCE_PA_PM_PO') && (
              <span className="badge warning">Confiance basse PA/PM/PO</span>
            )}
            {rune.warnings.includes('UNVERIFIED_DATA') && (
              <span className="badge warning">Donnee non verifiee</span>
            )}
            {rune.confidence === 'special' && <span className="badge warning">Effet special</span>}
          </div>
        ))}
      </div>
      {Boolean(result.unverifiedData?.length) && (
        <span className="badge warning">Donnee non verifiee dans le calcul</span>
      )}
    </article>
  );
}

function formatKamas(value: number) {
  return `${Math.round(value).toLocaleString('fr-FR')} k`;
}
