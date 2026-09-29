export const cfg = {
  port: +(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || 'postgres://glimmer:glimmer@localhost:5432/glimmer',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
  maxTurns: +(process.env.MAX_TURNS || 10),
  refillMs: +(process.env.REFILL_MS || 180000),
  choiceCost: +(process.env.CHOICE_COST || 0), // authored choices
  aiCost: +(process.env.AI_COST || 1), // free-text / AI beats
  rcSecret: process.env.REVENUECAT_WEBHOOK_SECRET || '',
  products: { turns_25: 25, turns_100: 100 } as Record<string, number>,
};
if (process.env.NODE_ENV === 'production' && cfg.jwtSecret === 'dev-secret-change-me') throw new Error('Set JWT_SECRET');
