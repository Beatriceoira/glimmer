'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, session } from '../../lib/api';

export default function Account() {
  const r = useRouter();
  const [me, setMe] = useState<any>(null);
  const [turns, setTurns] = useState<any>(null);
  useEffect(() => { api('/auth/me').then(setMe).catch(() => r.push('/login')); api('/me/turns').then(setTurns).catch(() => {}); }, [r]);
  return (
    <main>
      <h1>Account</h1>
      <div className="card">
        <p>{me?.email}</p>
        {turns && <p className="mute">{turns.free} of {turns.max} free turns{turns.purchased ? `, plus ${turns.purchased} purchased` : ''}.</p>}
        <button className="btn" onClick={() => { session.clear(); r.push('/'); }}>Sign out</button>
      </div>
      <div className="card">
        <h2>Delete account</h2>
        <p className="mute">Removes your account, reading progress and any stories you wrote. This cannot be undone.</p>
        <button className="btn ghost" onClick={async () => {
          if (!confirm('Delete your account and all your data permanently?')) return;
          await api('/auth/me', { method: 'DELETE' }); session.clear(); r.push('/');
        }}>Delete my account</button>
      </div>
    </main>
  );
}
