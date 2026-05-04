import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { db } from './db.mjs';
import { registerApi, registerAuthApi } from './api.mjs';
import { config } from './config.mjs';
import Knex from 'knex';
import knexConfig from '../knexfile.js';
import { v1Router } from './api/v1/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');

const app = express();

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(compression());
app.use(cors({
  origin(origin, cb) {
    if (!origin || !config.corsOrigins.length || config.corsOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS origin denied'));
  },
}));
app.use(morgan(config.isProduction ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));

const knex = Knex(knexConfig);
if (config.autoMigrate) {
  await knex.migrate.latest();
}

app.use('/api/v1', v1Router(knex, config));
registerApi(app, db);
registerAuthApi(app, knex, config);

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, { index: 'index.html', maxAge: config.isProduction ? '1h' : 0 }));
}

app.get('/health', async (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
    await knex.raw('SELECT 1');
    res.json({ ok: true, service: 'vexor-erp', env: config.env });
  } catch {
    res.status(503).json({ ok: false, service: 'vexor-erp' });
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: config.isProduction ? 'Internal error' : String(err.message || err) });
});

async function ensureSeed() {
  if (!config.autoSeed) return;
  const row = db.prepare('SELECT COUNT(*) AS c FROM tenant').get();
  if (row.c === 0) await import('./seed.mjs');

  const core = await knex('users').count({ c: '*' }).first();
  if (Number(core?.c || 0) === 0) await knex.seed.run();

  const admin = await knex('users').where({ email: 'admin@erp.local' }).first();
  if (admin && (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(admin.password_hash))) {
    await knex('users')
      .where({ id: admin.id })
      .update({ password_hash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'admin', 12), active: true });
  }
}

await ensureSeed();

const server = app.listen(config.port, () => {
  console.log(`Vexor ERP listening on http://localhost:${config.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await knex.destroy();
    db.close();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
