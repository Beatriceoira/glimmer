import { redis, q } from './db';
import { cfg } from './config';

// Atomic refill + spend. Redis is the hot path; Postgres is flushed periodically.
const LUA = `
local k=KEYS[1]
local max,refill,now,cost=tonumber(ARGV[1]),tonumber(ARGV[2]),tonumber(ARGV[3]),tonumber(ARGV[4])
local t=redis.call('HMGET',k,'free','ts')
local free,ts=tonumber(t[1]),tonumber(t[2])
if not free then free=max ts=now end
if free<max then
  local g=math.floor((now-ts)/refill)
  if g>0 then free=math.min(max,free+g) ts=ts+g*refill end
end
if free>=max then ts=now end
local ok=0
if cost>0 and free>=cost then
  free=free-cost ok=1
end
redis.call('HSET',k,'free',free,'ts',ts)
return {ok,free,ts}`;

const key = (id: string) => `turns:${id}`;
async function hydrate(id: string) {
  if (await redis.exists(key(id))) return;
  const [u] = await q('select free_turns, free_turns_ts from users where id=$1', [id]);
  await redis.hsetnx(key(id), 'free', u?.free_turns ?? cfg.maxTurns);
  await redis.hsetnx(key(id), 'ts', new Date(u?.free_turns_ts ?? Date.now()).getTime());
}
export type Turns = { free: number; purchased: number; max: number; nextRefillAt: number | null };
async function run(id: string, cost: number) {
  await hydrate(id);
  const [ok, free, ts] = (await redis.eval(LUA, 1, key(id), cfg.maxTurns, cfg.refillMs, Date.now(), cost)) as number[];
  if (cost > 0) await redis.sadd('turns:dirty', id);
  return { ok: ok === 1, free, ts };
}
async function purchased(id: string) {
  const [u] = await q('select purchased_turns p from users where id=$1', [id]);
  return u?.p ?? 0;
}
const shape = (free: number, ts: number, p: number): Turns => ({ free, purchased: p, max: cfg.maxTurns, nextRefillAt: free < cfg.maxTurns ? ts + cfg.refillMs : null });

export async function peek(id: string): Promise<Turns> {
  const r = await run(id, 0);
  return shape(r.free, r.ts, await purchased(id));
}
export async function spend(id: string, cost: number): Promise<{ ok: boolean; source: 'free' | 'purchased' | 'none'; turns: Turns }> {
  if (cost <= 0) return { ok: true, source: 'none', turns: await peek(id) };
  const r = await run(id, cost);
  if (r.ok) return { ok: true, source: 'free', turns: shape(r.free, r.ts, await purchased(id)) };
  const rows = await q('update users set purchased_turns=purchased_turns-$2 where id=$1 and purchased_turns>=$2 returning purchased_turns p', [id, cost]);
  if (rows.length) return { ok: true, source: 'purchased', turns: shape(r.free, r.ts, rows[0].p) };
  return { ok: false, source: 'none', turns: shape(r.free, r.ts, await purchased(id)) };
}
export async function refund(id: string, cost: number, source: string) {
  if (source === 'free') { await hydrate(id); await redis.hincrby(key(id), 'free', cost); await redis.sadd('turns:dirty', id); }
  else if (source === 'purchased') await q('update users set purchased_turns=purchased_turns+$2 where id=$1', [id, cost]);
}
export async function grantPurchased(id: string, n: number) {
  await q('update users set purchased_turns=purchased_turns+$2 where id=$1', [id, n]);
}
export function startFlushJob() {
  setInterval(async () => {
    try {
      const ids = await redis.spop('turns:dirty', 200);
      for (const id of ids) {
        const h = await redis.hgetall(key(id));
        if (h.free) await q('update users set free_turns=$2, free_turns_ts=to_timestamp($3/1000.0) where id=$1', [id, +h.free, +h.ts]);
      }
    } catch (e) { console.error('flush failed', e); }
  }, 30000).unref();
}
