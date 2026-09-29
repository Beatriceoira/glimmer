import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { q } from './db';

declare module '@fastify/jwt' {
  interface FastifyJWT { payload: { id: string; role: string }; user: { id: string; role: string } }
}
declare module 'fastify' {
  interface FastifyInstance {
    auth: (req: FastifyRequest, rep: FastifyReply) => Promise<void>;
    authorOnly: (req: FastifyRequest, rep: FastifyReply) => Promise<void>;
  }
}

export async function authRoutes(app: FastifyInstance) {
  const limit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  app.post('/auth/register', limit, async (req, rep) => {
    const b = z.object({
      email: z.string().email().max(200), password: z.string().min(8).max(100),
      acceptTerms: z.literal(true), confirmAge13: z.literal(true), wantsToWrite: z.boolean().optional(),
    }).parse(req.body);
    const email = b.email.toLowerCase();
    if ((await q('select 1 from users where email=$1', [email])).length) return rep.code(409).send({ error: 'Email already registered' });
    const hash = await bcrypt.hash(b.password, 12);
    const [u] = await q('insert into users(email,password_hash,role,accepted_terms_at) values($1,$2,$3,now()) returning id, role', [email, hash, b.wantsToWrite ? 'author' : 'reader']);
    return { token: app.jwt.sign({ id: u.id, role: u.role }, { expiresIn: '30d' }), role: u.role };
  });
  app.post('/auth/login', limit, async (req, rep) => {
    const b = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
    const [u] = await q('select id, role, password_hash from users where email=$1', [b.email.toLowerCase()]);
    if (!u || !(await bcrypt.compare(b.password, u.password_hash))) return rep.code(401).send({ error: 'Wrong email or password' });
    return { token: app.jwt.sign({ id: u.id, role: u.role }, { expiresIn: '30d' }), role: u.role };
  });
  app.get('/auth/me', { onRequest: app.auth }, async (req) => {
    const [u] = await q('select id, email, role from users where id=$1', [req.user.id]);
    return u;
  });
  app.delete('/auth/me', { onRequest: app.auth }, async (req) => {
    await q('delete from users where id=$1', [req.user.id]); // cascades sessions and authored stories
    return { ok: true };
  });
}
