// server/api/v1/middleware.js
import jwt from 'jsonwebtoken';

export function requireAuth(jwtSecret) {
  return function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Missing bearer token' });
    try {
      req.user = jwt.verify(token, jwtSecret);
      next();
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  };
}
