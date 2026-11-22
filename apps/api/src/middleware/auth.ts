import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { getDb } from '../db/database.js';

export interface AuthTokenPayload {
  userId: string;
  sessionId: string;
  deviceId: string;
  platform: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

export function verifyTokenAndSession(token: string): AuthTokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
  const db = getDb();
  const session = db
    .prepare('SELECT id, revoked_at FROM device_sessions WHERE id = ? AND user_id = ?')
    .get(payload.sessionId, payload.userId) as { id: string; revoked_at: string | null } | undefined;

  if (!session || session.revoked_at !== null) {
    throw new Error('SESSION_REVOKED');
  }

  db.prepare('UPDATE device_sessions SET last_active_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    payload.sessionId
  );

  return payload;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticação ausente.' });
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  try {
    req.auth = verifyTokenAndSession(token);
    next();
  } catch (err) {
    const code = err instanceof Error && err.message === 'SESSION_REVOKED' ? 'SESSION_REVOKED' : 'INVALID_TOKEN';
    res.status(401).json({ error: 'Sessão inválida ou desconectada.', code });
  }
}
