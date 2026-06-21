import { getToken } from './auth';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(msg || `Error ${res.status}`);
  }
  return res.status === 204 ? (null as T) : ((await res.json()) as T);
}

export const apiGet = <T = any>(path: string) => api<T>(path);
export const apiPost = <T = any>(path: string, body: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const apiPut = <T = any>(path: string, body: unknown) =>
  api<T>(path, { method: 'PUT', body: JSON.stringify(body) });
export const apiPatch = <T = any>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
