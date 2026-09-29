'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, session, streamAct } from '../../../lib/api';

export default function Read({ params }: { params: { id: string } }) {
  const id = params.id;
  const [v, setV] = useState<any>(null);
  const [needsName, setNeedsName] = useState(false);
  const [name, setName] = useState('Iris');
  const [text, setText] = useState('');
  const [stream, setStream] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [now, setNow] = useState(Date.now());
  const [signed, setSigned] = useState(true);

  useEffect(() => {
    if (!session.token()) { setSigned(false); return; }
    api(`/play/${id}/state`).then(setV).catch(() => setNeedsName(true));
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [id]);

  async function begin(restart = false) {
    setErr('');
    try { setV(await api(`/play/${id}/start`, { body: { name, restart } })); setNeedsName(false); } catch (e: any) { setErr(e.message); }
  }
  async function choose(choiceId: string) {
    setErr('');
    try { setV(await api(`/play/${id}/choose`, { body: { choiceId } })); } catch (e: any) { setErr(e.message); }
  }
  async function act() {
    const t = text.trim();
    if (!t || stream !== null) return;
    setErr(''); setStream('');
    await streamAct(id, t, {
      token: (x) => setStream((s) => (s ?? '') + x),
      done: (d) => { setV(d); setStream(null); setText(''); },
      error: (m) => { setErr(m); setStream(null); },
    });
  }
  async function report() {
    const reason = prompt('What is wrong with this story?');
    if (reason && reason.length >= 3) { await api(`/stories/${id}/report`, { body: { reason } }).catch(() => {}); alert('Thanks. We will review it.'); }
  }

  if (!signed) return <main><h1>Sign in to read</h1><p>Your progress and turns are saved to your account.</p><Link className="btn" href="/login" style={{ textDecoration: 'none' }}>Sign in</Link></main>;
  if (needsName) return (
    <main>
      <h1>Who are you in this story?</h1>
      <label htmlFor="n">Your character's name</label>
      <input id="n" type="text" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
      <p><button className="btn" onClick={() => begin()}>Begin</button></p>
      {err && <p className="err">{err}</p>}
    </main>
  );
  if (!v) return <main><p className="mute">Loading…</p></main>;

  const t = v.turns;
  const secs = t.nextRefillAt ? Math.max(0, Math.ceil((t.nextRefillAt - now) / 1000)) : 0;
  return (
    <main>
      <div className="bar">
        <Link href="/">Library</Link>
        <div title={`${t.free} of ${t.max} free turns`} style={{ textAlign: 'right' }}>
          <div className="pips" aria-label={`${t.free} free turns`}>{Array.from({ length: t.max }, (_, i) => <span key={i} className={`pip${i < t.free ? ' on' : ''}`} />)}</div>
          {t.nextRefillAt && <span className="mute">Next turn in {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}{t.purchased ? ` · ${t.purchased} extra` : ''}</span>}
        </div>
      </div>
      <div>{Object.entries(v.state.vars).map(([k, n]) => <span className="chip" key={k}>{k} {String(n)}</span>)}{v.state.flags.map((f: string) => <span className="chip" key={f}>{f.replace(/_/g, ' ')}</span>)}</div>
      <div className="prose">{v.node.content.split('\n\n').map((p: string, i: number) => <p key={i}>{p}</p>)}</div>
      {v.beats.map((b: string, i: number) => <p className="beat" key={i}>{b}</p>)}
      {stream !== null && <p className="beat">{stream || '…'}</p>}

      {v.node.isEnding ? (
        <div className="card"><h2>The end</h2><button className="btn" onClick={() => begin(true)}>Read again</button></div>
      ) : (
        <>
          {v.choices.map((c: any) => (
            <button key={c.id} className="choice" disabled={c.locked || stream !== null} onClick={() => choose(c.id)}>
              {c.text}{c.locked && <small>Locked: {c.lockReason}</small>}
            </button>
          ))}
          {v.node.allowCustom && (
            <>
              <p className="mute" style={{ marginTop: 18 }}>Or do something else (uses one turn)</p>
              <div className="row">
                <input type="text" maxLength={255} value={text} placeholder="Type your own action" aria-label="Custom action"
                  onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && act()} />
                <button className="btn" disabled={stream !== null} onClick={act}>Act</button>
              </div>
            </>
          )}
        </>
      )}
      {err && <p className="err" role="alert">{err}</p>}
      <p><button className="link" onClick={report}>Report this story</button></p>
    </main>
  );
}
