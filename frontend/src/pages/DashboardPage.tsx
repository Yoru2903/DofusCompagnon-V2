import { useQuery } from '@tanstack/react-query';
import {
  getDashboardEvolution,
  getDashboardOperations,
  getDashboardSummary,
  type DashboardOperation,
} from '../features/dashboard/services/dashboardService.js';

export function DashboardPage() {
  const summaryQuery = useQuery({ queryKey: ['dashboard-summary'], queryFn: getDashboardSummary });
  const operationsQuery = useQuery({
    queryKey: ['dashboard-operations'],
    queryFn: getDashboardOperations,
  });
  const evolutionQuery = useQuery({
    queryKey: ['dashboard-evolution', 'month'],
    queryFn: () => getDashboardEvolution('month'),
  });
  const maxAbs = Math.max(
    1,
    ...(evolutionQuery.data?.points.map((point) => Math.abs(point.cumulativeBenefit)) ?? [1]),
  );

  return (
    <section className="workspace-page">
      <header className="page-header">
        <p className="eyebrow">Dashboard</p>
        <h1>Synthese economique</h1>
        <span className="badge realized">Realise uniquement</span>
      </header>

      <section className="summary-strip">
        <Metric label="Benefice total" value={formatKamas(summaryQuery.data?.benefitTotal ?? 0)} />
        <Metric label="Depenses" value={formatKamas(summaryQuery.data?.expensesTotal ?? 0)} />
        <Metric label="Gains" value={formatKamas(summaryQuery.data?.gainsTotal ?? 0)} />
        <Metric label="ROI moyen" value={`${Math.round(summaryQuery.data?.averageRoi ?? 0)}%`} />
      </section>

      <div className="two-column">
        <section className="panel">
          <h2>Evolution cumulee</h2>
          <div className="chart-panel">
            {evolutionQuery.data?.points.map((point) => (
              <article key={point.period} className="chart-row">
                <span>{point.period}</span>
                <div className="chart-track">
                  <div
                    className={point.cumulativeBenefit >= 0 ? 'chart-bar gain-bar' : 'chart-bar loss-bar'}
                    style={{ width: `${Math.max(6, (Math.abs(point.cumulativeBenefit) / maxAbs) * 100)}%` }}
                  />
                </div>
                <strong>{formatKamas(point.cumulativeBenefit)}</strong>
              </article>
            ))}
            {evolutionQuery.data?.points.length === 0 && <p className="muted">Aucune operation realisee.</p>}
          </div>
        </section>

        <section className="panel">
          <h2>Meilleures operations</h2>
          <OperationList title="Craft" operations={operationsQuery.data?.best.craft ?? []} />
          <OperationList title="Brisage" operations={operationsQuery.data?.best.breaking ?? []} />
          <OperationList title="Trade" operations={operationsQuery.data?.best.trade ?? []} />
          <h2>Pires operations</h2>
          <OperationList title="Pertes" operations={operationsQuery.data?.worst ?? []} />
        </section>
      </div>
    </section>
  );
}

function OperationList({ title, operations }: { title: string; operations: DashboardOperation[] }) {
  return (
    <div className="cards-list compact-list">
      <h3>{title}</h3>
      {operations.map((operation) => (
        <article key={operation.id} className="result-card compact-card">
          <div className="card-heading">
            <strong>{operation.itemName}</strong>
            <span className={`badge ${operation.benefit >= 0 ? 'realized' : 'warning'}`}>
              {formatKamas(operation.benefit)}
            </span>
          </div>
          <small>
            {operation.label} - {operation.quantity}x - ROI {Math.round(operation.roi)}%
          </small>
        </article>
      ))}
      {operations.length === 0 && <p className="muted">Aucune donnee.</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function formatKamas(value: number) {
  return `${Math.round(value).toLocaleString('fr-FR')} k`;
}
