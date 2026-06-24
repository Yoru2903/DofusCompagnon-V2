import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ItemAutocomplete } from '../components/ItemAutocomplete.js';
import type { CatalogItemSuggestion } from '../features/catalog/services/itemAutocompleteService.js';
import { getCurrentUser, getDefaultSession, getStoredToken } from '../features/core/services/authService.js';
import {
  addCraftLine,
  createCraftSession,
  getCraftStats,
  listRecipesForItem,
  listCraftSessions,
  type CraftRecipeOption,
  type CraftSessionLine,
} from '../features/craft/services/craftService.js';

export function CraftSessionsPage() {
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<CatalogItemSuggestion | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const sessionQuery = useQuery({ queryKey: ['session'], queryFn: ensureSession });
  const sessionsQuery = useQuery({
    queryKey: ['craft-sessions'],
    queryFn: listCraftSessions,
    enabled: sessionQuery.isSuccess,
  });
  const statsQuery = useQuery({
    queryKey: ['craft-stats'],
    queryFn: getCraftStats,
    enabled: sessionQuery.isSuccess,
  });
  const selectedSession = sessionsQuery.data?.find((session) => session.id === selectedSessionId) ?? sessionsQuery.data?.[0];
  const recipesQuery = useQuery({
    queryKey: ['craft-recipes', selectedItem?.id],
    queryFn: () => listRecipesForItem(selectedItem!.id),
    enabled: Boolean(selectedItem),
  });
  const recipes = recipesQuery.data ?? [];
  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedRecipeId) ?? recipes[0];
  const createMutation = useMutation({
    mutationFn: createCraftSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['craft-sessions'] }),
  });
  const addLineMutation = useMutation({
    mutationFn: (payload: Parameters<typeof addCraftLine>[1]) => addCraftLine(selectedSession!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['craft-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['craft-stats'] });
    },
  });
  const lines = useMemo(() => selectedSession?.lines ?? [], [selectedSession]);

  useEffect(() => {
    if (recipes.length === 1) {
      setSelectedRecipeId(recipes[0].id);
    } else if (recipes.length === 0) {
      setSelectedRecipeId('');
    }
  }, [recipes]);

  return (
    <section className="workspace-page">
      <header className="page-header">
        <p className="eyebrow">Craft</p>
        <h1>Sessions de craft</h1>
      </header>

      <section className="summary-strip">
        <Metric label="Crafts" value={statsQuery.data?.craftCount ?? 0} />
        <Metric label="Cout moyen" value={formatKamas(statsQuery.data?.averageUnitCost ?? 0)} />
        <Metric label="Total" value={formatKamas(statsQuery.data?.totalCost ?? 0)} />
      </section>

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
              <button
                key={session.id}
                type="button"
                className={`session-row session-button ${selectedSession?.id === session.id ? 'selected' : ''}`}
                onClick={() => setSelectedSessionId(session.id)}
              >
                <strong>{session.name}</strong>
                <small>{new Date(session.sessionDate).toLocaleDateString('fr-FR')}</small>
                <span>{session.lines.length} ligne(s)</span>
              </button>
            ))}
            {sessionsQuery.data?.length === 0 && <p className="muted">Aucune session craft.</p>}
          </div>
        </section>

        <section className="panel">
          <h2>Detail et calcul</h2>
          {selectedSession ? (
            <>
              <p className="muted">Session active : {selectedSession.name}</p>
              <form
                className="stacked-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const recipeId = String(form.get('recipeId') ?? '');
                  const manualPrices = selectedRecipe
                    ? selectedRecipe.ingredients
                        .map((ingredient) => ({
                          ingredientItemId: ingredient.ingredientItemId,
                          unitPrice: Number(form.get(`manualPrice:${ingredient.ingredientItemId}`) ?? 0),
                        }))
                        .filter((entry) => entry.unitPrice > 0)
                    : [];
                  addLineMutation.mutate({
                    itemId: String(form.get('itemId') ?? ''),
                    recipeId,
                    quantity: Number(form.get('quantity') ?? 1),
                    costSource: String(form.get('costSource') ?? 'theoretical') as never,
                    manualPrices,
                  });
                  event.currentTarget.reset();
                }}
              >
                <ItemAutocomplete
                  name="itemId"
                  label="Item crafte"
                  required
                  onSelect={(item) => setSelectedItem(item)}
                />
                {recipes.length > 1 && (
                  <select
                    name="recipeId"
                    value={selectedRecipeId}
                    onChange={(event) => setSelectedRecipeId(event.target.value)}
                    required
                  >
                    {recipes.map((recipe) => (
                      <option key={recipe.id} value={recipe.id}>
                        Recette v{recipe.version}
                      </option>
                    ))}
                  </select>
                )}
                {recipes.length === 1 && <input type="hidden" name="recipeId" value={recipes[0].id} />}
                {recipes.length === 0 && selectedItem && (
                  <p className="muted">Aucune recette disponible pour cet item.</p>
                )}
                <input name="quantity" type="number" min="1" defaultValue="1" />
                <select name="costSource" defaultValue="theoretical">
                  <option value="theoretical">Prix theorique</option>
                  <option value="manual">Prix manuel</option>
                  <option value="mixed">Prix mixte</option>
                </select>
                {selectedRecipe && <RecipeIngredientsPreview recipe={selectedRecipe} />}
                <button type="submit" disabled={!selectedRecipe}>
                  Calculer
                </button>
              </form>
              <div className="cards-list">
                {lines.map((line) => (
                  <CraftLineCard key={line.id} line={line} />
                ))}
              </div>
            </>
          ) : (
            <p className="muted">Cree une session pour ajouter des crafts.</p>
          )}
        </section>
      </div>
    </section>
  );
}

function CraftLineCard({ line }: { line: CraftSessionLine }) {
  const signals = line.economicSnapshot?.dataJson?.signals ?? [];

  return (
    <article className="result-card">
      <div className="card-heading">
        <strong>{line.item.name}</strong>
        <span className="badge forecast">Previsionnel</span>
      </div>
      <p>
        {line.quantity} craft(s), cout total {formatKamas(line.totalCost)}
      </p>
      <div className="badge-row">
        <span className="badge">{line.costSource}</span>
        <span className="badge">{line.status ?? 'active'}</span>
        {signals.some((signal) => signal.type === 'stale_price') && (
          <span className="badge warning">Prix stale</span>
        )}
        {signals.some((signal) => signal.type === 'unverified_data') && (
          <span className="badge warning">Donnee non verifiee</span>
        )}
      </div>
      <div className="cards-list compact-list">
        {line.ingredients.map((ingredient) => (
          <div key={ingredient.id} className="ingredient-row">
            <span>{ingredient.ingredientItem.name}</span>
            <small>
              {ingredient.quantity} x {formatKamas(ingredient.unitPrice)} ={' '}
              {formatKamas(ingredient.totalPrice)}
            </small>
          </div>
        ))}
      </div>
    </article>
  );
}

function RecipeIngredientsPreview({ recipe }: { recipe: CraftRecipeOption }) {
  const total = recipe.ingredients.reduce(
    (sum, ingredient) => sum + ingredient.quantity * (ingredient.latestPrice?.unitPrice ?? 0),
    0,
  );

  return (
    <div className="cards-list compact-list">
      {recipe.ingredients.map((ingredient) => {
        const unitPrice = ingredient.latestPrice?.unitPrice ?? 0;

        return (
          <article key={ingredient.id} className="ingredient-row">
            <div>
              <strong>{ingredient.ingredientItem.name}</strong>
              <small>
                {ingredient.quantity} x {formatKamas(unitPrice)} ={' '}
                {formatKamas(ingredient.quantity * unitPrice)}
              </small>
            </div>
            <input
              name={`manualPrice:${ingredient.ingredientItemId}`}
              type="number"
              min="0"
              placeholder="Prix manuel"
            />
            {!ingredient.latestPrice && <span className="badge warning">Prix absent</span>}
            {ingredient.latestPrice?.freshness.isStale && (
              <span className="badge warning">Prix stale</span>
            )}
          </article>
        );
      })}
      <strong>Total estime : {formatKamas(total)}</strong>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
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
