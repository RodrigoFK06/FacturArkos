import { Page, request as pwRequest, expect } from '@playwright/test';

export const API = 'http://localhost:3001/api';
export const DEMO = { email: 'demo@facturarkos.pe', password: 'password123' };

/** Login directo por API (rápido, sin pasar por la UI). */
export async function apiLogin(creds = DEMO): Promise<{ token: string; user: Record<string, unknown> }> {
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${API}/auth/login`, { data: creds });
  expect(res.ok(), `login API debe responder ok (${res.status()})`).toBeTruthy();
  const body = await res.json();
  await ctx.dispose();
  return { token: body.access_token, user: body.user };
}

/**
 * Inyecta la sesión en localStorage antes de cargar la página, así el guard del
 * panel pasa sin recorrer el formulario de login en cada test.
 */
export async function loginAs(page: Page, creds = DEMO): Promise<{ token: string; user: Record<string, unknown> }> {
  const session = await apiLogin(creds);
  await page.addInitScript(
    (s) => {
      localStorage.setItem('fa_token', s.token);
      localStorage.setItem('fa_user', s.user);
    },
    { token: session.token, user: JSON.stringify(session.user) },
  );
  return session;
}

/** Etiqueta única para no chocar con datos previos del demo. */
export function uniq(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
}
