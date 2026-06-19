import { getRequestContext } from '@cloudflare/next-on-pages';

export interface CloudflareEnv {
  DB: D1Database;
  R2: R2Bucket;
}

export function getDb(): D1Database {
  const ctx = getRequestContext();
  return (ctx.env as unknown as CloudflareEnv).DB;
}

export function getR2(): R2Bucket {
  const ctx = getRequestContext();
  return (ctx.env as unknown as CloudflareEnv).R2;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
