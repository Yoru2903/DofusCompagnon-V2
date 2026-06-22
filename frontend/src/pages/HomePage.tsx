import { useQuery } from '@tanstack/react-query';
import { getCurrentUser, getDefaultSession, getStoredToken } from '../features/core/services/authService.js';
import { apiRequest } from '../services/apiClient.js';

type HealthResponse = {
  status: string;
  service: string;
};

export function HomePage() {
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: () => apiRequest<HealthResponse>('/api/health'),
  });
  const sessionQuery = useQuery({
    queryKey: ['default-session'],
    queryFn: async () => {
      const storedToken = getStoredToken();

      if (storedToken) {
        const current = await getCurrentUser(storedToken);
        return { user: current.user, token: storedToken };
      }

      return getDefaultSession();
    },
  });

  return (
    <section className="status-panel">
      <p className="eyebrow">DofusCompagnon</p>
      <h1>Socle technique actif</h1>
      <div className="status-grid">
        <article>
          <span>Backend</span>
          <strong>{healthQuery.data?.status ?? 'verification...'}</strong>
          <small>{healthQuery.data?.service ?? 'API Fastify'}</small>
        </article>
        <article>
          <span>Session</span>
          <strong>{sessionQuery.data?.user.displayName ?? 'connexion...'}</strong>
          <small>{sessionQuery.data?.user.role ?? 'role en attente'}</small>
        </article>
      </div>
    </section>
  );
}
