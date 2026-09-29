import { FastifyInstance } from 'fastify';
import { q } from '../db';
import { cfg } from '../config';
import { grantPurchased } from '../turns';

// RevenueCat verifies Apple/Google receipts, then calls this webhook. We only trust the shared secret.
export async function billingRoutes(app: FastifyInstance) {
  app.post('/billing/revenuecat-webhook', async (req, reply) => {
    if (!cfg.rcSecret || req.headers.authorization !== `Bearer ${cfg.rcSecret}`) return reply.code(401).send({ error: 'Unauthorized' });
    const ev = (req.body as any)?.event;
    if (!ev?.id || !ev?.app_user_id) return reply.code(400).send({ error: 'Bad event' });
    if (!['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE'].includes(ev.type)) return { ok: true, ignored: true };
    const turns = cfg.products[ev.product_id];
    if (!turns) return { ok: true, ignored: true };
    const fresh = await q('insert into processed_events(id) values($1) on conflict do nothing returning id', [ev.id]); // idempotent
    if (fresh.length) await grantPurchased(ev.app_user_id, turns); // app_user_id = our user uuid (set via Purchases.logIn)
    return { ok: true };
  });
}
