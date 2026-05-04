// server/api/v1/index.js
import express from 'express';
import { productsRouter } from './products.js';
import { authRouter } from './auth.js';

const router = express.Router();

router.use('/products', productsRouter);
router.use('/auth', authRouter);

export { router as v1Router };``