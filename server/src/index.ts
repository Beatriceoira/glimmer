import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { cfg } from './config';
import { redis } from './db';
import { authRoutes } from './auth';
import { storyRoutes } from './routes/stories';
import { playRoutes } from './routes/play';
import { billingRoutes } from './routes/billing';
import { startFlushJob } from './turns';

async function main() {
  const app = Fastify({ logger: true, bodyLimit: 1_000_000, trustProxy: true });
  await app.register(helmet);
  await app.register(cors, { origin: cfg.corsOrigin.split(','), methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] });
  await app.register(jwt, { secret: cfg.jwtSecret });
  app.decorate('auth', async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return rep.code(401).send({ error: 'Sign in required' });
    }
  });

  app.decorate('authorOnly', async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return rep.code(401).send({ error: 'Sign in required' });
    }

    if (req.user.role !== 'author') {
      return rep.code(403).send({ error: 'Author account required' });
    }
  });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute', redis });
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) return reply.code(400).send({ error: 'Check your input', details: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
    if ((err as any).statusCode && (err as any).statusCode < 500) return reply.code((err as any).statusCode).send({ error: err.message });
    app.log.error(err);
    reply.code(500).send({ error: 'Something went wrong' });
  });
  app.get('/health', async () => ({ ok: true }));
  await app.register(authRoutes);
  await app.register(storyRoutes);
  await app.register(playRoutes);
  await app.register(billingRoutes);
  startFlushJob();
  await app.listen({ port: cfg.port, host: '0.0.0.0' });
}
main().catch((e) => { console.error(e); process.exit(1); });
