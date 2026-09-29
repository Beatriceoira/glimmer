import { Pool } from 'pg';
import Redis from 'ioredis';
import { cfg } from './config';
export const pool = new Pool({ connectionString: cfg.databaseUrl });
export const redis = new Redis(cfg.redisUrl);
export const q = <T = any>(text: string, params: any[] = []) => pool.query(text, params).then((r) => r.rows as T[]);
