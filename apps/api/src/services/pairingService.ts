import { randomBytes, randomUUID } from 'node:crypto';
import { PAIRING_TTL_SECONDS, type AuthSession, type DevicePlatform, type DeviceSession, type PairingSession } from '@converse/shared';
import { getDb } from '../db/database.js';
import { HttpError } from '../middleware/errorHandler.js';
import { createSessionForUser, getUserById } from './authService.js';

function generatePairingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += alphabet[bytes[i] % alphabet.length];
    if (i === 3) code += '-';
  }
  return code;
}

export function createPairingSession(webDeviceName = 'Converse Web (Navegador)'): PairingSession {
  const db = getDb();
  const pairingId = `pair-${randomUUID()}`;
  const pairingCode = generatePairingCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PAIRING_TTL_SECONDS * 1000).toISOString();
  const qrPayload = JSON.stringify({
    app: 'converse',
    v: 1,
    pairingId,
    pairingCode,
  });

  db.prepare(`
    INSERT INTO pairing_sessions (id, pairing_code, qr_payload, status, web_device_name, created_at, expires_at)
    VALUES (?, ?, ?, 'pending', ?, ?, ?)
  `).run(pairingId, pairingCode, qrPayload, webDeviceName, now.toISOString(), expiresAt);

  return {
    pairingId,
    pairingCode,
    qrPayload,
    expiresAt,
    status: 'pending',
  };
}

export function getPairingStatus(pairingId: string): { status: PairingSession['status']; session?: AuthSession } {
  const db = getDb();
  const row = db.prepare('SELECT * FROM pairing_sessions WHERE id = ?').get(pairingId) as
    | {
        id: string;
        status: PairingSession['status'];
        expires_at: string;
        user_id: string | null;
        issued_token: string | null;
        issued_session_id: string | null;
      }
    | undefined;

  if (!row) {
    throw new HttpError(404, 'Sessão de pareamento não encontrada.');
  }

  if (row.status === 'pending' && new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare("UPDATE pairing_sessions SET status = 'expired' WHERE id = ?").run(pairingId);
    return { status: 'expired' };
  }

  if (row.status === 'approved' && row.user_id && row.issued_token && row.issued_session_id) {
    const user = getUserById(row.user_id);
    if (user) {
      return {
        status: 'approved',
        session: {
          token: row.issued_token,
          sessionId: row.issued_session_id,
          deviceId: `web-${row.id}`,
          platform: 'web_browser',
          user,
        },
      };
    }
  }

  return { status: row.status };
}

export function approvePairingSession(input: {
  userId: string;
  pairingId?: string;
  pairingCode?: string;
  webDeviceName?: string;
}): { pairingId: string; session: AuthSession } {
  const db = getDb();
  const normalizedCode = input.pairingCode?.trim().toUpperCase();

  const row = input.pairingId
    ? (db.prepare('SELECT * FROM pairing_sessions WHERE id = ?').get(input.pairingId) as any)
    : (db.prepare('SELECT * FROM pairing_sessions WHERE pairing_code = ?').get(normalizedCode ?? '') as any);

  if (!row) {
    throw new HttpError(404, 'QR Code ou código de pareamento inválido.');
  }

  if (row.status !== 'pending') {
    throw new HttpError(409, 'Este código já foi utilizado ou expirou.');
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare("UPDATE pairing_sessions SET status = 'expired' WHERE id = ?").run(row.id);
    throw new HttpError(410, 'QR Code expirado. Gere um novo no navegador.');
  }

  const user = getUserById(input.userId);
  if (!user) {
    throw new HttpError(404, 'Usuário não encontrado.');
  }

  const session = createSessionForUser(user, {
    deviceId: `web-${row.id}`,
    deviceName: input.webDeviceName || row.web_device_name || 'Converse Web',
    platform: 'web_chrome' as DevicePlatform,
    isPrimary: false,
  });

  db.prepare(`
    UPDATE pairing_sessions
    SET status = 'approved', user_id = ?, issued_session_id = ?, issued_token = ?
    WHERE id = ?
  `).run(user.id, session.sessionId, session.token, row.id);

  return { pairingId: row.id, session };
}

export function listUserDevices(userId: string): DeviceSession[] {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT * FROM device_sessions WHERE user_id = ? AND revoked_at IS NULL ORDER BY is_primary DESC, last_active_at DESC'
    )
    .all(userId) as Array<{
    id: string;
    user_id: string;
    device_id: string;
    device_name: string;
    platform: DevicePlatform;
    is_primary: number;
    last_active_at: string;
    created_at: string;
    revoked_at: string | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    deviceId: r.device_id,
    deviceName: r.device_name,
    platform: r.platform,
    isPrimary: Boolean(r.is_primary),
    lastActiveAt: r.last_active_at,
    createdAt: r.created_at,
    revokedAt: r.revoked_at,
  }));
}

export function revokeDeviceSession(userId: string, sessionId: string): void {
  const db = getDb();
  const result = db
    .prepare('UPDATE device_sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL')
    .run(new Date().toISOString(), sessionId, userId);

  if (result.changes === 0) {
    throw new HttpError(404, 'Sessão de dispositivo não encontrada.');
  }
}
