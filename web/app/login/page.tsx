'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, session } from '../../lib/api';

export default function Login() {
  const r = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [f, setF] = useState({ email: '', password: '', terms: false, age: false, author: false });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(''); setBusy(true);
    try {
      const d = mode === 'login'
        ? await api('/auth/login', { body: { email: f.email, password: f.password } })
        : await api('/auth/register', { body: { email: f.email, password: f.password, acceptTerms: f.terms, confirmAge13: f.age, wantsToWrite: f.author } });
      session.set(d.token, d.role);
      r.push(d.role === 'author' ? '/author' : '/');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <main>
      <h1>{mode === 'login' ? 'Sign in' : 'Create your account'}</h1>
      <div className="card">
        <label htmlFor="e">Email</label>
        <input id="e" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <label htmlFor="p">Password (8 characters or more)</label>
        <input id="p" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        {mode === 'register' && (
          <>
            <label><input type="checkbox" checked={f.age} onChange={(e) => setF({ ...f, age: e.target.checked })} /> I am 13 or older</label>
            <label><input type="checkbox" checked={f.terms} onChange={(e) => setF({ ...f, terms: e.target.checked })} /> I agree to the <Link href="/terms">terms</Link> and <Link href="/privacy">privacy policy</Link></label>
            <label><input type="checkbox" checked={f.author} onChange={(e) => setF({ ...f, author: e.target.checked })} /> I want to write stories</label>
          </>
        )}
        {err && <p className="err" role="alert">{err}</p>}
        <p><button className="btn" disabled={busy} onClick={submit}>{mode === 'login' ? 'Sign in' : 'Create account'}</button></p>
        <button className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
      </div>
    </main>
  );
}
