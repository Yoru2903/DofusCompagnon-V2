import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage.js';

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/api/health')) {
        return new Response(JSON.stringify({ status: 'ok', service: 'test-backend' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({
          token: 'test-token',
          user: {
            id: 'user-1',
            username: 'default',
            displayName: 'Utilisateur par defaut',
            email: 'default@example.test',
            groupId: 'group-1',
            role: 'admin',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }),
  );
});

describe('HomePage', () => {
  it('renders the technical foundation status', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <HomePage />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Socle technique actif' })).toBeInTheDocument();
    expect(await screen.findByText('ok')).toBeInTheDocument();
    expect(await screen.findByText('Utilisateur par defaut')).toBeInTheDocument();
  });
});
