import { useRouter } from 'vue-router';

const TOKEN_KEY = 'edustack_token';
const USER_KEY = 'edustack_user';

export interface AuthUser {
  id: number;
  login: string;
  isAdmin: boolean;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function saveSession(token: string, user: AuthUser, remember: boolean) {
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(TOKEN_KEY, token);
  storage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export function useAuth() {
  const router = useRouter();

  function logout() {
    clearSession();
    router.push('/');
  }

  return { logout, getUser, getToken };
}
