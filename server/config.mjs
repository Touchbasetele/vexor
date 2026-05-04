import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  AUTO_SEED: z.string().optional(),
  AUTO_MIGRATE: z.string().optional(),
  DATABASE_URL: z.string().optional(),
});

const env = EnvSchema.parse(process.env);
const isProduction = env.NODE_ENV === 'production';

if (isProduction && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to at least 32 characters in production.');
}

if (isProduction && env.AUTO_SEED === 'true') {
  throw new Error('AUTO_SEED=true is not allowed in production.');
}

function parseCorsOrigins(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const config = {
  env: env.NODE_ENV,
  isProduction,
  port: env.PORT,
  jwtSecret: env.JWT_SECRET || 'dev_secret_change_me',
  corsOrigins: parseCorsOrigins(env.CORS_ORIGIN),
  autoSeed: !isProduction && env.AUTO_SEED !== 'false',
  autoMigrate: env.AUTO_MIGRATE !== 'false',
};
