// server/api/v1/products.js
import express from 'express';
import { z } from 'zod';
import { requireAuth } from './middleware.js';

const router = express.Router();

const ProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  uom: z.string().optional(),
  cost: z.number().optional(),
  price: z.number().optional(),
});

export function productsRouter(knex) {
  router.get('/', requireAuth, async (req, res) => {
    const products = await knex('products').select();
    res.json(products);
  });

  router.post('/', requireAuth, async (req, res) => {
    const parse = ProductSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors });
    const { sku, name, uom, cost, price } = parse.data;
    const [id] = await knex('products').insert({ sku, name, uom, cost, price });
    res.json({ id });
  });

  return router;
}
