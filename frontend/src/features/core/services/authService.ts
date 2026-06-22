import { apiRequest } from '../../../services/apiClient.js';
import type { AuthenticatedUser, AuthSession } from '../../../types/auth.js';

const tokenStorageKey = 'dofuscompagnon.authToken';

export function getStoredToken() {
  return window.localStorage.getItem(tokenStorageKey);
}

export function storeToken(token: string) {
  window.localStorage.setItem(tokenStorageKey, token);
}

export async function getDefaultSession() {
  const session = await apiRequest<AuthSession>('/api/dev/default-session');
  storeToken(session.token);
  return session;
}

export async function getCurrentUser(token: string) {
  return apiRequest<{ user: AuthenticatedUser }>('/api/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
