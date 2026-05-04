// server/api/v1/index.js
import express from 'express';
import { productsRouter } from './products.js';
import { authRouter } from './auth.js';
import { requireAuth } from './middleware.js';

export function v1Router(knex, config) {
  const router = express.Router();
  const auth = requireAuth(config.jwtSecret);

  router.use('/auth', authRouter(knex, config));
  router.use('/products', productsRouter(knex, { requireAuth: auth }));

  return router;
}
