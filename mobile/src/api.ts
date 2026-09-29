import { useStore } from './store';

export const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
export const WEB = process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:3000';

export async function api<T = any>(path: string, opts: { method?: string; body?: any } = {}): Promise<T> {
  const token = useStore.getState().token;
  const res = await fetch(API + path, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) useStore.getState().signOut();
    throw new Error(data.error || 'Request failed');
  }
  return data;
}
