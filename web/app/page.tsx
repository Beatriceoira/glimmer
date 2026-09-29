'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Library() {
  const [stories, setStories] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api('/stories').then(setStories).catch((e) => setErr(e.message)); }, []);
  return (
    <main>
      <h1>Glimmer</h1>
      <p className="mute">Interactive fanfiction where your choices, and your own words, steer the story.</p>
      {err && <p className="err">{err}</p>}
      {stories?.length === 0 && <p className="card">No stories yet. Authors can publish the first one from the Write tab.</p>}
      {stories?.map((s) => (
        <div className="card" key={s.id}>
          <h2>{s.title}</h2>
          <p className="mute">{s.blurb}</p>
          {(s.tags ?? []).map((t: string) => <span className="chip" key={t}>{t}</span>)}
          <div><Link className="btn" href={`/read/${s.id}`} style={{ display: 'inline-block', textDecoration: 'none' }}>Read</Link></div>
        </div>
      ))}
    </main>
  );
}
