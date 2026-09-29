import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool, q } from '../db';
import { moderate } from '../ai';

const uuid = z.string().uuid();
const Graph = z.object({
  startNodeId: uuid.nullable(),
  nodes: z.array(z.object({
    id: uuid, title: z.string().max(120), content: z.string().max(20000),
    isEnding: z.boolean(), allowCustom: z.boolean(), metadata: z.record(z.any()), x: z.number(), y: z.number(),
  })).max(500),
  choices: z.array(z.object({
    id: uuid, parentNodeId: uuid, nextNodeId: uuid, text: z.string().min(1).max(255),
    requiredState: z.record(z.any()), effects: z.record(z.any()),
  })).max(2000),
});
const Meta = z.object({
  title: z.string().min(1).max(255), blurb: z.string().max(1000), fandom: z.string().max(100).optional(),
  tags: z.array(z.string().max(30)).max(10), variables: z.array(z.string().regex(/^[a-z_][a-z0-9_]{0,29}$/)).max(12),
  authorRules: z.string().max(4000),
});

async function owned(id: string, userId: string) {
  const [s] = await q('select * from stories where id=$1 and author_id=$2', [id, userId]);
  return s;
}

export async function storyRoutes(app: FastifyInstance) {
  // ---------- public ----------
  app.get('/stories', async () =>
    q('select s.id, s.title, s.blurb, s.fandom, s.tags from stories s where is_published order by created_at desc limit 50'));
  app.get('/stories/:id', async (req, rep) => {
    const { id } = req.params as any;
    const [s] = await q('select id, title, blurb, fandom, tags from stories where id=$1 and is_published', [id]);
    return s ?? rep.code(404).send({ error: 'Story not found' });
  });
  app.post('/stories/:id/report', { onRequest: app.auth }, async (req) => {
    const { id } = req.params as any;
    const b = z.object({ reason: z.string().min(3).max(500) }).parse(req.body);
    await q('insert into content_reports(story_id, reporter_id, reason) values($1,$2,$3)', [id, req.user.id, b.reason]);
    return { ok: true };
  });

  // ---------- author ----------
  app.get('/author/stories', { onRequest: app.authorOnly }, async (req) =>
    q('select id, title, is_published, created_at from stories where author_id=$1 order by created_at desc', [req.user.id]));

  app.post('/author/stories', { onRequest: app.authorOnly }, async (req) => {
    const b = z.object({ title: z.string().min(1).max(255) }).parse(req.body);
    const [s] = await q('insert into stories(title, author_id) values($1,$2) returning id', [b.title, req.user.id]);
    return s;
  });

  app.get('/author/stories/:id', { onRequest: app.authorOnly }, async (req, rep) => {
    const { id } = req.params as any;
    const s = await owned(id, req.user.id);
    if (!s) return rep.code(404).send({ error: 'Story not found' });
    const nodes = await q('select id, title, content, is_ending, allow_custom, node_metadata, pos_x, pos_y from story_nodes where story_id=$1', [id]);
    const choices = await q(
      `select c.id, c.parent_node_id, c.next_node_id, c.choice_text, c.required_state, c.effects
       from node_choices c join story_nodes n on n.id=c.parent_node_id where n.story_id=$1 order by c.sort`, [id]);
    return { story: s, nodes, choices };
  });

  app.patch('/author/stories/:id', { onRequest: app.authorOnly }, async (req, rep) => {
    const { id } = req.params as any;
    if (!(await owned(id, req.user.id))) return rep.code(404).send({ error: 'Story not found' });
    const b = Meta.parse(req.body);
    await q('update stories set title=$2, blurb=$3, fandom=$4, tags=$5, variables=$6, author_rules=$7 where id=$1',
      [id, b.title, b.blurb, b.fandom ?? null, b.tags, b.variables, b.authorRules]);
    return { ok: true };
  });

  // Bulk-save the whole graph from the visual editor (transactional).
  app.put('/author/stories/:id/graph', { onRequest: app.authorOnly }, async (req, rep) => {
    const { id } = req.params as any;
    if (!(await owned(id, req.user.id))) return rep.code(404).send({ error: 'Story not found' });
    const g = Graph.parse(req.body);
    const ids = new Set(g.nodes.map((n) => n.id));
    if (g.startNodeId && !ids.has(g.startNodeId)) return rep.code(400).send({ error: 'Start scene is missing' });
    if (g.choices.some((c) => !ids.has(c.parentNodeId) || !ids.has(c.nextNodeId))) return rep.code(400).send({ error: 'A choice points to a missing scene' });
    // Reject ids that already belong to another story.
    const clash = await q('select 1 from story_nodes where id = any($1::uuid[]) and story_id <> $2 limit 1', [[...ids], id]);
    if (clash.length) return rep.code(400).send({ error: 'Scene id collision' });

    const c = await pool.connect();
    try {
      await c.query('begin');
      await c.query('delete from story_nodes where story_id=$1 and not (id = any($2::uuid[]))', [id, [...ids]]);
      for (const n of g.nodes) {
        await c.query(
          `insert into story_nodes(id, story_id, title, content, is_ending, allow_custom, node_metadata, pos_x, pos_y)
           values($1,$2,$3,$4,$5,$6,$7,$8,$9)
           on conflict (id) do update set title=$3, content=$4, is_ending=$5, allow_custom=$6, node_metadata=$7, pos_x=$8, pos_y=$9`,
          [n.id, id, n.title, n.content, n.isEnding, n.allowCustom, n.metadata, n.x, n.y]);
      }
      await c.query('delete from node_choices where parent_node_id = any($1::uuid[])', [[...ids]]);
      let sort = 0;
      for (const ch of g.choices) {
        await c.query('insert into node_choices(id, parent_node_id, next_node_id, choice_text, required_state, effects, sort) values($1,$2,$3,$4,$5,$6,$7)',
          [ch.id, ch.parentNodeId, ch.nextNodeId, ch.text, ch.requiredState, ch.effects, sort++]);
      }
      await c.query('update stories set start_node_id=$2 where id=$1', [id, g.startNodeId]);
      await c.query('commit');
    } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
    return { ok: true };
  });

  app.post('/author/stories/:id/publish', { onRequest: app.authorOnly }, async (req, rep) => {
    const { id } = req.params as any;
    const s = await owned(id, req.user.id);
    if (!s) return rep.code(404).send({ error: 'Story not found' });
    if (!s.start_node_id) return rep.code(400).send({ error: 'Pick a start scene before publishing' });
    const nodes = await q('select title, content from story_nodes where story_id=$1', [id]);
    const choices = await q('select c.choice_text t from node_choices c join story_nodes n on n.id=c.parent_node_id where n.story_id=$1', [id]);
    const text = [s.title, s.blurb, s.author_rules, ...nodes.flatMap((n) => [n.title, n.content]), ...choices.map((c) => c.t)].join('\n');
    const flagged = moderate(text);
    if (flagged) return rep.code(422).send({ error: `Publishing blocked by content check: ${flagged}` });
    await q('update stories set is_published=true where id=$1', [id]);
    return { ok: true };
  });
  app.post('/author/stories/:id/unpublish', { onRequest: app.authorOnly }, async (req, rep) => {
    const { id } = req.params as any;
    if (!(await owned(id, req.user.id))) return rep.code(404).send({ error: 'Story not found' });
    await q('update stories set is_published=false where id=$1', [id]);
    return { ok: true };
  });
  app.delete('/author/stories/:id', { onRequest: app.authorOnly }, async (req, rep) => {
    const { id } = req.params as any;
    if (!(await owned(id, req.user.id))) return rep.code(404).send({ error: 'Story not found' });
    await q('delete from stories where id=$1', [id]);
    return { ok: true };
  });
}
