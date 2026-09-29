import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { q } from '../db';
import { cfg } from '../config';
import { apply, fill, unmet, State } from '../game';
import { peek, spend, refund } from '../turns';
import { direct, moderate, sanitizeInput, streamBeat } from '../ai';

async function load(userId: string, storyId: string) {
  const [story] = await q('select * from stories where id=$1 and (is_published or author_id=$2)', [storyId, userId]);
  if (!story) return null;
  const [session] = await q('select * from player_sessions where user_id=$1 and story_id=$2', [userId, storyId]);
  return { story, session };
}

async function view(userId: string, story: any, session: any) {
  const [node] = await q('select * from story_nodes where id=$1', [session.current_node_id]);
  const st: State = session.state_variables;
  const rows = node.is_ending ? [] : await q('select id, choice_text, required_state from node_choices where parent_node_id=$1 order by sort', [node.id]);
  return {
    node: { id: node.id, title: node.title, content: fill(node.content, st), isEnding: node.is_ending, allowCustom: node.allow_custom && !node.is_ending },
    choices: rows.map((c) => { const why = unmet(c.required_state, st); return { id: c.id, text: fill(c.choice_text, st), locked: !!why, lockReason: why }; }),
    beats: session.beats as string[],
    state: st,
    turns: await peek(userId),
  };
}

function openStream(reply: FastifyReply) {
  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': cfg.corsOrigin.split(',')[0],
  });
  return (event: string, data: any) => reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function playRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.auth);

  app.get('/me/turns', async (req) => peek(req.user.id));

  app.post('/play/:storyId/start', async (req, reply) => {
    const { storyId } = req.params as any;
    const b = z.object({ name: z.string().max(40).optional(), restart: z.boolean().optional() }).parse(req.body ?? {});
    const ctx = await load(req.user.id, storyId);
    if (!ctx) return reply.code(404).send({ error: 'Story not found' });
    if (ctx.session && !b.restart) return view(req.user.id, ctx.story, ctx.session);
    if (!ctx.story.start_node_id) return reply.code(400).send({ error: 'This story has no start scene yet' });
    const name = (b.name ?? '').replace(/[^\p{L}\p{N} '-]/gu, '').trim().slice(0, 20) || ctx.session?.state_variables?.name || 'Iris';
    const st: State = { name, vars: {}, flags: [] };
    const [start] = await q('select node_metadata from story_nodes where id=$1', [ctx.story.start_node_id]);
    apply(start?.node_metadata, st);
    const [s] = await q(
      `insert into player_sessions(user_id, story_id, current_node_id, state_variables, summary, beats)
       values($1,$2,$3,$4,'','[]') on conflict (user_id, story_id)
       do update set current_node_id=$3, state_variables=$4, summary='', beats='[]', updated_at=now() returning *`,
      [req.user.id, storyId, ctx.story.start_node_id, st]);
    return view(req.user.id, ctx.story, s);
  });

  app.get('/play/:storyId/state', async (req, reply) => {
    const { storyId } = req.params as any;
    const ctx = await load(req.user.id, storyId);
    if (!ctx?.session) return reply.code(404).send({ error: 'Not started' });
    return view(req.user.id, ctx.story, ctx.session);
  });

  // Authored choice: deterministic, optionally costs a turn.
  app.post('/play/:storyId/choose', async (req, reply) => {
    const { storyId } = req.params as any;
    const b = z.object({ choiceId: z.string().uuid() }).parse(req.body);
    const ctx = await load(req.user.id, storyId);
    if (!ctx?.session) return reply.code(404).send({ error: 'Not started' });
    const [ch] = await q('select * from node_choices where id=$1 and parent_node_id=$2', [b.choiceId, ctx.session.current_node_id]);
    if (!ch || !ch.next_node_id) return reply.code(400).send({ error: 'That choice is not available' });
    const st: State = ctx.session.state_variables;
    if (unmet(ch.required_state, st)) return reply.code(403).send({ error: 'That choice is locked' });
    const sp = await spend(req.user.id, cfg.choiceCost);
    if (!sp.ok) return reply.code(402).send({ error: 'Out of turns', turns: sp.turns });
    apply(ch.effects, st);
    const [next] = await q('select node_metadata from story_nodes where id=$1', [ch.next_node_id]);
    apply(next?.node_metadata, st);
    const [s] = await q('update player_sessions set current_node_id=$3, state_variables=$4, beats=\'[]\', updated_at=now() where user_id=$1 and story_id=$2 returning *',
      [req.user.id, storyId, ch.next_node_id, st]);
    return view(req.user.id, ctx.story, s);
  });

  // Free-text action: costs a turn, streams the beat over SSE, then applies validated state changes.
  app.post('/play/:storyId/act', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { storyId } = req.params as any;
    const b = z.object({ text: z.string().min(1).max(600) }).parse(req.body);
    const ctx = await load(req.user.id, storyId);
    if (!ctx?.session) return reply.code(404).send({ error: 'Not started' });
    const text = sanitizeInput(b.text);
    if (!text) return reply.code(400).send({ error: 'Type an action first' });
    const blocked = moderate(text);
    if (blocked) return reply.code(422).send({ error: blocked });
    const [node] = await q('select * from story_nodes where id=$1', [ctx.session.current_node_id]);
    if (node.is_ending || !node.allow_custom) return reply.code(409).send({ error: 'Custom actions are off for this scene' });
    const sp = await spend(req.user.id, cfg.aiCost);
    if (!sp.ok) return reply.code(402).send({ error: 'Out of turns', turns: sp.turns });

    const send = openStream(reply);
    try {
      const st: State = ctx.session.state_variables;
      const beats: string[] = ctx.session.beats;
      const beat = await streamBeat(
        { authorRules: ctx.story.author_rules, summary: ctx.session.summary, state: st, scene: fill(node.content, st), recent: beats.slice(-3), action: text },
        (t) => send('token', { t }));
      const d = await direct(beat, text, ctx.story.variables);
      apply({ ...d.effects, flags_add: d.flags_add }, st);
      const summary = `${ctx.session.summary} ${d.summary_line}`.trim().slice(-1500);
      const [s] = await q('update player_sessions set state_variables=$3, summary=$4, beats=$5, updated_at=now() where user_id=$1 and story_id=$2 returning *',
        [req.user.id, storyId, st, summary, JSON.stringify([...beats, beat].slice(-6))]);
      send('done', await view(req.user.id, ctx.story, s));
    } catch (e) {
      req.log.error(e);
      await refund(req.user.id, cfg.aiCost, sp.source);
      send('fail', { error: 'The story stalled. Your turn was refunded.' });
    } finally { reply.raw.end(); }
  });
}
