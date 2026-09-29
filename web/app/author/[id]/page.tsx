'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import ReactFlow, { addEdge, Background, Connection, Controls, Edge, Node, useEdgesState, useNodesState } from 'reactflow';
import 'reactflow/dist/style.css';
import { api } from '../../../lib/api';

type ND = { title: string; content: string; isEnding: boolean; allowCustom: boolean; metadata: string };
type ED = { text: string; requiredState: string; effects: string };
const json = (v: any) => JSON.stringify(v ?? {});
function parse(s: string, what: string) {
  try { const v = JSON.parse(s || '{}'); if (!v || typeof v !== 'object' || Array.isArray(v)) throw 0; return v; }
  catch { throw new Error(`${what} must be JSON like {"courage": 1}`); }
}

export default function Editor({ params }: { params: { id: string } }) {
  const id = params.id;
  const [nodes, setNodes, onNodesChange] = useNodesState<ND>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<ED>([]);
  const [meta, setMeta] = useState<any>(null);
  const [start, setStart] = useState<string | null>(null);
  const [sel, setSel] = useState<{ type: 'node' | 'edge'; id: string } | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api(`/author/stories/${id}`).then((d) => {
      const s = d.story;
      setMeta({ title: s.title, blurb: s.blurb ?? '', fandom: s.fandom ?? '', tags: (s.tags ?? []).join(', '), variables: (s.variables ?? []).join(', '), authorRules: s.author_rules ?? '', published: s.is_published });
      setStart(s.start_node_id);
      setNodes(d.nodes.map((n: any): Node<ND> => ({ id: n.id, position: { x: n.pos_x, y: n.pos_y }, data: { title: n.title, content: n.content, isEnding: n.is_ending, allowCustom: n.allow_custom, metadata: json(n.node_metadata) } })));
      setEdges(d.choices.map((c: any): Edge<ED> => ({ id: c.id, source: c.parent_node_id, target: c.next_node_id, data: { text: c.choice_text, requiredState: json(c.required_state), effects: json(c.effects) } })));
    }).catch((e) => setMsg(e.message));
  }, [id, setNodes, setEdges]);

  const shownNodes = useMemo(() => nodes.map((n) => ({ ...n, data: { ...n.data, label: `${n.id === start ? '★ ' : ''}${n.data.title || n.data.content.slice(0, 28) || 'New scene'}${n.data.isEnding ? ' (end)' : ''}` } })), [nodes, start]);
  const shownEdges = useMemo(() => edges.map((e) => ({ ...e, label: e.data?.text })), [edges]);
  const selNode = sel?.type === 'node' ? nodes.find((n) => n.id === sel.id) : null;
  const selEdge = sel?.type === 'edge' ? edges.find((e) => e.id === sel.id) : null;

  const patchNode = (p: Partial<ND>) => setNodes((ns) => ns.map((n) => (n.id === sel?.id ? { ...n, data: { ...n.data, ...p } } : n)));
  const patchEdge = (p: Partial<ED>) => setEdges((es) => es.map((e) => (e.id === sel?.id ? { ...e, data: { ...(e.data as ED), ...p } } : e)));
  const onConnect = (c: Connection) => setEdges((es) => addEdge({ ...c, id: crypto.randomUUID(), data: { text: 'New choice', requiredState: '{}', effects: '{}' } }, es));
  function addScene() {
    const nid = crypto.randomUUID();
    setNodes((ns) => [...ns, { id: nid, position: { x: 60 + ns.length * 30, y: 60 + ns.length * 30 }, data: { title: '', content: '', isEnding: false, allowCustom: true, metadata: '{}' } }]);
    if (!start) setStart(nid);
  }

  async function save() {
    try {
      setMsg('Saving…');
      await api(`/author/stories/${id}/graph`, { method: 'PUT', body: {
        startNodeId: start,
        nodes: nodes.map((n) => ({ id: n.id, title: n.data.title, content: n.data.content, isEnding: n.data.isEnding, allowCustom: n.data.allowCustom, metadata: parse(n.data.metadata, `Effects on scene "${n.data.title || 'untitled'}"`), x: n.position.x, y: n.position.y })),
        choices: edges.map((e) => ({ id: e.id, parentNodeId: e.source, nextNodeId: e.target, text: e.data!.text, requiredState: parse(e.data!.requiredState, `Requirements on "${e.data!.text}"`), effects: parse(e.data!.effects, `Effects on "${e.data!.text}"`) })),
      } });
      const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
      await api(`/author/stories/${id}`, { method: 'PATCH', body: { title: meta.title, blurb: meta.blurb, fandom: meta.fandom || undefined, tags: list(meta.tags), variables: list(meta.variables), authorRules: meta.authorRules } });
      setMsg('Saved.'); return true;
    } catch (e: any) { setMsg(e.message); return false; }
  }
  async function publish() {
    if (!(await save())) return;
    try { await api(`/author/stories/${id}/${meta.published ? 'unpublish' : 'publish'}`, { method: 'POST', body: {} }); setMeta({ ...meta, published: !meta.published }); setMsg(meta.published ? 'Unpublished.' : 'Published.'); }
    catch (e: any) { setMsg(e.message); }
  }
  if (!meta) return <main><p className="mute">{msg || 'Loading…'}</p></main>;

  return (
    <main className="wide">
      <div className="bar">
        <Link href="/author">Your stories</Link>
        <span className={msg === 'Saved.' || msg === 'Published.' ? 'ok' : 'err'} role="status">{msg}</span>
        <span className="row">
          <button className="btn ghost" onClick={addScene}>Add scene</button>
          <button className="btn ghost" onClick={save}>Save</button>
          <button className="btn" onClick={publish}>{meta.published ? 'Unpublish' : 'Save and publish'}</button>
        </span>
      </div>
      <div className="editor">
        <div className="canvas">
          <ReactFlow nodes={shownNodes} edges={shownEdges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            onNodeClick={(_, n) => setSel({ type: 'node', id: n.id })} onEdgeClick={(_, e) => setSel({ type: 'edge', id: e.id })} onPaneClick={() => setSel(null)} fitView deleteKeyCode={['Backspace', 'Delete']}>
            <Background /><Controls />
          </ReactFlow>
        </div>
        <div className="side">
          {selNode && (
            <div className="card">
              <h2>Scene</h2>
              <label htmlFor="t">Title</label><input id="t" type="text" maxLength={120} value={selNode.data.title} onChange={(e) => patchNode({ title: e.target.value })} />
              <label htmlFor="c">Prose (use {'{MC_Name}'} for the reader's character)</label><textarea id="c" value={selNode.data.content} onChange={(e) => patchNode({ content: e.target.value })} />
              <label><input type="checkbox" checked={selNode.data.isEnding} onChange={(e) => patchNode({ isEnding: e.target.checked })} /> Ending</label>
              <label><input type="checkbox" checked={selNode.data.allowCustom} onChange={(e) => patchNode({ allowCustom: e.target.checked })} /> Let readers type their own action here</label>
              <label htmlFor="m">Effects on entry (JSON)</label><input id="m" type="text" value={selNode.data.metadata} onChange={(e) => patchNode({ metadata: e.target.value })} />
              <p><button className="btn ghost" onClick={() => setStart(selNode.id)}>{start === selNode.id ? 'This is the start scene' : 'Make start scene'}</button></p>
              <button className="link" onClick={() => { setNodes((ns) => ns.filter((n) => n.id !== selNode.id)); setEdges((es) => es.filter((e) => e.source !== selNode.id && e.target !== selNode.id)); if (start === selNode.id) setStart(null); setSel(null); }}>Delete scene</button>
            </div>
          )}
          {selEdge && (
            <div className="card">
              <h2>Choice</h2>
              <label htmlFor="ct">Button text</label><input id="ct" type="text" maxLength={255} value={selEdge.data!.text} onChange={(e) => patchEdge({ text: e.target.value })} />
              <label htmlFor="rq">Requires (JSON, e.g. {'{"courage": ">= 2", "flags": ["lantern"]}'})</label><input id="rq" type="text" value={selEdge.data!.requiredState} onChange={(e) => patchEdge({ requiredState: e.target.value })} />
              <label htmlFor="ef">Effects (JSON, e.g. {'{"trust": 1, "flags_add": ["met_wren"]}'})</label><input id="ef" type="text" value={selEdge.data!.effects} onChange={(e) => patchEdge({ effects: e.target.value })} />
            </div>
          )}
          {!sel && <div className="card"><p className="mute">Select a scene or a choice to edit it. Drag from a scene's bottom dot to another scene to add a choice. Press Delete to remove the selection.</p></div>}
          <div className="card">
            <h2>Story</h2>
            <label htmlFor="st">Title</label><input id="st" type="text" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
            <label htmlFor="sb">Blurb</label><textarea id="sb" value={meta.blurb} onChange={(e) => setMeta({ ...meta, blurb: e.target.value })} />
            <label htmlFor="sf">Fandom or original world</label><input id="sf" type="text" value={meta.fandom} onChange={(e) => setMeta({ ...meta, fandom: e.target.value })} />
            <label htmlFor="sg">Tags (comma separated)</label><input id="sg" type="text" value={meta.tags} onChange={(e) => setMeta({ ...meta, tags: e.target.value })} />
            <label htmlFor="sv">Variables the AI may change (lowercase, comma separated)</label><input id="sv" type="text" value={meta.variables} onChange={(e) => setMeta({ ...meta, variables: e.target.value })} />
            <label htmlFor="sr">Rules for the AI narrator (tone, world facts, off-limits)</label><textarea id="sr" value={meta.authorRules} onChange={(e) => setMeta({ ...meta, authorRules: e.target.value })} />
          </div>
        </div>
      </div>
    </main>
  );
}
