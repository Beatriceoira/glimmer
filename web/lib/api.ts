export const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const session = {
  token: () => (typeof window === 'undefined' ? null : localStorage.getItem('gl_token')),
  role: () => (typeof window === 'undefined' ? null : localStorage.getItem('gl_role')),
  set: (t: string, r: string) => { localStorage.setItem('gl_token', t); localStorage.setItem('gl_role', r); window.dispatchEvent(new Event('gl-auth')); },
  clear: () => { localStorage.removeItem('gl_token'); localStorage.removeItem('gl_role'); window.dispatchEvent(new Event('gl-auth')); },
};

export async function api<T = any>(path: string, opts: { method?: string; body?: any } = {}): Promise<T> {
  const t = session.token();
  const res = await fetch(API + path, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && t) session.clear();
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

/** POST + Server-Sent Events over fetch (EventSource cannot send bodies or auth headers). */
export async function streamAct(storyId: string, text: string, on: { token: (t: string) => void; done: (v: any) => void; error: (m: string) => void }) {
  const res = await fetch(`${API}/play/${storyId}/act`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token()}` },
    body: JSON.stringify({ text }),
  });
  if (!res.ok || !res.body) {
    const d = await res.json().catch(() => ({}));
    return on.error(d.error || 'Request failed');
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      const ev = /^event: (.+)$/m.exec(block)?.[1];
      const data = /^data: (.+)$/m.exec(block)?.[1];
      if (!ev || !data) continue;
      const j = JSON.parse(data);
      if (ev === 'token') on.token(j.t);
      else if (ev === 'done') on.done(j);
      else if (ev === 'fail') on.error(j.error);
    }
  }
}
