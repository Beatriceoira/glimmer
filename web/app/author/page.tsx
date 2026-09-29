'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function Author() {
  const [list, setList] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [err, setErr] = useState('');
  const load = () => api('/author/stories').then(setList).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  async function create() {
    if (!title.trim()) return;
    try { await api('/author/stories', { body: { title } }); setTitle(''); load(); } catch (e: any) { setErr(e.message); }
  }
  return (
    <main>
      <h1>Your stories</h1>
      {err && <p className="err">{err}</p>}
      <div className="card row">
        <input type="text" maxLength={255} placeholder="Title of a new story" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="New story title" />
        <button className="btn" onClick={create}>Create</button>
      </div>
      {list.map((s) => (
        <div className="card" key={s.id}>
          <h2>{s.title}</h2>
          <p className="mute">{s.is_published ? 'Published' : 'Draft'}</p>
          <Link className="btn" href={`/author/${s.id}`} style={{ textDecoration: 'none', display: 'inline-block' }}>Edit story graph</Link>{' '}
          <Link href={`/read/${s.id}`}>Preview</Link>
        </div>
      ))}
    </main>
  );
}
