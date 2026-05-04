import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { db } from './db.mjs';
import { registerApi, registerAuthApi } from './api.mjs';
import Knex from 'knex';
import knexConfig from '../knexfile.js';
import { v1Router } from './api/v1/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(compression());
app.use(cors({ origin: process.env.CORS_ORIGIN || false }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));

const knex = Knex(knexConfig);
app.use('/api/v1', v1Router(knex));
registerApi(app, db);
registerAuthApi(app, knex);

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, { index: 'index.html', maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'vexor-erp' });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal error' : String(err.message || err) });
});

async function ensureSeed() {
  const row = db.prepare('SELECT COUNT(*) AS c FROM tenant').get();
  if (row.c === 0) await import('./seed.mjs');
}

await ensureSeed();

app.listen(PORT, () => {
  console.log(`Vexor ERP listening on http://localhost:${PORT}`);
});
