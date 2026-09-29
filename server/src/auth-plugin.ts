import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export async function authPlugin(app: FastifyInstance) {
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
}
