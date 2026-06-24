import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ItemAutocomplete } from '../components/ItemAutocomplete.js';
import { getCurrentUser, getDefaultSession, getStoredToken } from '../features/core/services/authService.js';
import {
  addStockMovement,
  createStockLocation,
  getStockInventory,
  listStockLocations,
} from '../features/stock/services/stockService.js';

export function StockPage() {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({ queryKey: ['session'], queryFn: ensureSession });
  const locationsQuery = useQuery({
    queryKey: ['stock-locations'],
    queryFn: listStockLocations,
    enabled: sessionQuery.isSuccess,
  });
  const selectedLocation = locationsQuery.data?.[0];
  const inventoryQuery = useQuery({
    queryKey: ['stock-inventory', selectedLocation?.id],
    queryFn: () => getStockInventory(selectedLocation!.id),
    enabled: Boolean(selectedLocation),
  });
  const createLocationMutation = useMutation({
    mutationFn: createStockLocation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stock-locations'] }),
  });
  const addMovementMutation = useMutation({
    mutationFn: addStockMovement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-locations'] });
      queryClient.invalidateQueries({ queryKey: ['stock-inventory'] });
    },
  });

  return (
    <section className="workspace-page">
      <header className="page-header">
        <p className="eyebrow">Stock</p>
        <h1>Stock et mouvements</h1>
      </header>

      <section className="summary-strip">
        <article>
          <span>Valorisation</span>
          <strong>{formatKamas(inventoryQuery.data?.totalValue ?? 0)}</strong>
        </article>
        <article>
          <span>Emplacement actif</span>
          <strong>{selectedLocation?.name ?? 'Aucun'}</strong>
        </article>
      </section>

      <div className="two-column">
        <section className="panel">
          <h2>Emplacement</h2>
          <form
            className="stacked-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              createLocationMutation.mutate({
                name: String(form.get('name') ?? ''),
                scope: String(form.get('scope') ?? 'group') as never,
              });
              event.currentTarget.reset();
            }}
          >
            <input name="name" placeholder="Nom emplacement" required />
            <select name="scope" defaultValue="group">
              <option value="group">Groupe</option>
              <option value="personal">Personnel</option>
            </select>
            <button type="submit">Creer</button>
          </form>

          <h2>Mouvement manuel</h2>
          {selectedLocation ? (
            <form
              className="stacked-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                addMovementMutation.mutate({
                  stockLocationId: selectedLocation.id,
                  itemId: String(form.get('itemId') ?? ''),
                  movementType: String(form.get('movementType') ?? 'in') as never,
                  quantity: Number(form.get('quantity') ?? 1),
                  unitValue: Number(form.get('unitValue') ?? 0),
                  notes: String(form.get('notes') ?? ''),
                });
                event.currentTarget.reset();
              }}
            >
              <ItemAutocomplete name="itemId" label="Item" required />
              <select name="movementType" defaultValue="in">
                <option value="in">Entree</option>
                <option value="out">Sortie</option>
              </select>
              <input name="quantity" type="number" min="1" defaultValue="1" />
              <input name="unitValue" type="number" min="0" placeholder="Valeur unitaire" />
              <textarea name="notes" placeholder="Notes" />
              <button type="submit">Ajouter mouvement</button>
            </form>
          ) : (
            <p className="muted">Cree un emplacement pour saisir un mouvement.</p>
          )}
        </section>

        <section className="panel">
          <h2>Inventaire</h2>
          <div className="cards-list">
            {inventoryQuery.data?.items.map((item) => (
              <article key={item.itemId} className="result-card">
                <div className="card-heading">
                  <strong>{item.itemName}</strong>
                  <span className="badge">{item.quantity}</span>
                </div>
                <p>
                  Valeur unitaire : {item.unitValue === null ? 'prix manquant' : formatKamas(item.unitValue)}
                </p>
                <p>Total : {item.totalValue === null ? 'non valorise' : formatKamas(item.totalValue)}</p>
              </article>
            ))}
            {inventoryQuery.data?.items.length === 0 && <p className="muted">Stock vide.</p>}
          </div>
        </section>
      </div>
    </section>
  );
}

async function ensureSession() {
  const token = getStoredToken();
  return token ? getCurrentUser(token) : getDefaultSession();
}

function formatKamas(value: number) {
  return `${Math.round(value).toLocaleString('fr-FR')} k`;
}
