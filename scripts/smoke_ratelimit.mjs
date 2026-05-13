// Smoke Upstash rate-limit: bucket de 3 tokens / 60s.
// Espera: 0 true 2 / 1 true 1 / 2 true 0 / 3 false 0 / 4 false 0.
//
// Run: node scripts/smoke_ratelimit.mjs
//
// Lee UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN de .env.local.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { config } from 'dotenv';

config({ path: '.env.local' });

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error('[smoke] Faltan UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN en .env.local');
  process.exit(1);
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const rl = new Ratelimit({
  redis,
  limiter: Ratelimit.tokenBucket(3, '60 s', 3),
  prefix: `vertice/smoke/${Date.now()}`,
});

for (let i = 0; i < 5; i++) {
  const r = await rl.limit('smoke-test');
  console.log(i, r.success, 'remaining:', r.remaining);
}
