import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ItemAutocomplete } from '../components/ItemAutocomplete.js';
import { getCurrentUser, getDefaultSession, getStoredToken } from '../features/core/services/authService.js';
import {
  addTradeLine,
  createTradeSession,
  listTradeSessions,
  sellTradeLine,
  type TradeLine,
} from '../features/trade/services/tradeService.js';

export function TradeSessionsPage() {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({ queryKey: ['session'], queryFn: ensureSession });
  const sessionsQuery = useQuery({
    queryKey: ['trade-sessions'],
    queryFn: listTradeSessions,
    enabled: sessionQuery.isSuccess,
  });
  const selectedSession = sessionsQuery.data?.[0];
  const selectedLine = selectedSession?.lines.find((line) => line.status === 'pending');
  const createMutation = useMutation({
    mutationFn: createTradeSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trade-sessions'] }),
  });
  const addLineMutation = useMutation({
    mutationFn: (payload: Parameters<typeof addTradeLine>[1]) => addTradeLine(selectedSession!.id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trade-sessions'] }),
  });
  const sellMutation = useMutation({
    mutationFn: (payload: Parameters<typeof sellTradeLine>[1]) => sellTradeLine(selectedLine!.id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trade-sessions'] }),
  });

  return (
    <section className="workspace-page">
      <header className="page-header">
        <p className="eyebrow">Achat-Revente</p>
        <h1>Sessions de trade</h1>
      </header>

      <div className="two-column">
        <section className="panel">
          <h2>Nouvelle session</h2>
          <form
            className="stacked-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              createMutation.mutate({ name: String(form.get('name') ?? ''), notes: String(form.get('notes') ?? '') });
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
                <span>{session.lines.length} ligne(s)</span>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Ajouter un achat</h2>
          {selectedSession ? (
            <form
              className="stacked-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                addLineMutation.mutate({
                  itemId: String(form.get('itemId') ?? ''),
                  quantity: Number(form.get('quantity') ?? 1),
                  unitBuyPrice: Number(form.get('unitBuyPrice') ?? 0),
                  expectedUnitSellPrice: Number(form.get('expectedUnitSellPrice') ?? 0),
                  feeRate: Number(form.get('feeRate') ?? 0.02),
                });
                event.currentTarget.reset();
              }}
            >
              <ItemAutocomplete name="itemId" label="Item achete" required />
              <input name="quantity" type="number" min="1" defaultValue="1" />
              <input name="unitBuyPrice" type="number" min="0" placeholder="Prix achat unitaire" />
              <input name="expectedUnitSellPrice" type="number" min="0" placeholder="Prix vente attendu" />
              <input name="feeRate" type="number" min="0" max="1" step="0.01" defaultValue="0.02" />
              <button type="submit">Calculer previsionnel</button>
            </form>
          ) : (
            <p className="muted">Cree une session pour ajouter une ligne.</p>
          )}

          <h2>Vente realisee</h2>
          {selectedLine ? (
            <form
              className="stacked-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                sellMutation.mutate({
                  actualUnitSellPrice: Number(form.get('actualUnitSellPrice') ?? 0),
                  feeRate: Number(form.get('feeRate') ?? 0.02),
                });
                event.currentTarget.reset();
              }}
            >
              <input name="actualUnitSellPrice" type="number" min="0" placeholder="Prix vente reel" />
              <input name="feeRate" type="number" min="0" max="1" step="0.01" defaultValue="0.02" />
              <button type="submit">Marquer vendu</button>
            </form>
          ) : (
            <p className="muted">Aucune ligne en attente dans la session active.</p>
          )}

          <div className="cards-list">
            {selectedSession?.lines.map((line) => (
              <TradeLineCard key={line.id} line={line} />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function TradeLineCard({ line }: { line: TradeLine }) {
  const snapshot = line.economicSnapshot?.dataJson;
  const net = snapshot?.netProfitability;

  return (
    <article className="result-card">
      <div className="card-heading">
        <strong>{line.item.name}</strong>
        <span className={`badge ${snapshot?.type === 'realise' ? 'realized' : 'forecast'}`}>
          {snapshot?.type === 'realise' ? 'Realise' : 'Previsionnel'}
        </span>
      </div>
      <p>
        {line.quantity} item(s), achat {formatKamas(line.totalBuyPrice)}, frais {formatKamas(line.fees)}
      </p>
      {net && (
        <p className={net.benefit >= 0 ? 'gain' : 'loss'}>
          Marge nette : {formatKamas(net.benefit)} ({Math.round(net.roi)}%)
        </p>
      )}
      <span className="badge">{line.status}</span>
    </article>
  );
}

async function ensureSession() {
  const token = getStoredToken();
  return token ? getCurrentUser(token) : getDefaultSession();
}

function formatKamas(value: number) {
  return `${Math.round(value).toLocaleString('fr-FR')} k`;
}
