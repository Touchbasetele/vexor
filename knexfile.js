import dotenv from 'dotenv';
dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required when NODE_ENV=production.');
}

const config = {
  client: isProd ? 'pg' : 'better-sqlite3',
  connection: isProd
    ? process.env.DATABASE_URL
    : { filename: './data/vexor.sqlite' },
  useNullAsDefault: !isProd,
  migrations: {
    directory: './server/migrations',
  },
  seeds: {
    directory: './server/seeds',
  },
};

export default config;
