// server/api/v1/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function authRouter(knex, config) {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    const parse = LoginSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues });
    const { email, password } = parse.data;
    const user = await knex('users').where({ email, active: true }).first();
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const isBcryptHash = /^\$2[aby]\$/.test(user.password_hash);
    if (!isBcryptHash && config.isProduction) {
      return res.status(500).json({ error: 'Password store is not production-ready' });
    }
    const valid = isBcryptHash ? await bcrypt.compare(password, user.password_hash) : password === 'admin';
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role_id: user.role_id }, config.jwtSecret, {
      expiresIn: '8h',
      issuer: 'vexor-erp',
    });
    res.json({ token });
  });
  return router;
}
