import { createHash, randomInt, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { AuthSession, DevicePlatform, UserProfile } from '@converse/shared';
import { env } from '../config/env.js';
import { getDb } from '../db/database.js';
import { HttpError } from '../middleware/errorHandler.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';
import { sendPasswordResetSms, type SmsChannel } from './smsService.js';

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  phone: string;
  password_hash: string;
  avatar_url: string;
  bio: string;
  age: number;
  city: string;
  interests_json: string;
  photos_json: string;
  looking_for: UserProfile['lookingFor'];
  verified: number;
  is_online: number;
  last_seen_at: string;
}

export function mapUserRow(row: UserRow): UserProfile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    age: row.age,
    city: row.city,
    interests: JSON.parse(row.interests_json || '[]') as string[],
    verified: Boolean(row.verified),
    isOnline: Boolean(row.is_online),
    lastSeenAt: row.last_seen_at,
    lookingFor: row.looking_for,
  };
}

export function getUserById(userId: string): UserProfile | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  return row ? mapUserRow(row) : null;
}

export function createSessionForUser(
  user: UserProfile,
  opts: { deviceId: string; deviceName: string; platform: DevicePlatform; isPrimary: boolean }
): AuthSession {
  const db = getDb();
  const sessionId = `sess-${randomUUID()}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO device_sessions (id, user_id, device_id, device_name, platform, is_primary, last_active_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(sessionId, user.id, opts.deviceId, opts.deviceName, opts.platform, opts.isPrimary ? 1 : 0, now, now);

  const token = jwt.sign(
    {
      userId: user.id,
      sessionId,
      deviceId: opts.deviceId,
      platform: opts.platform,
    },
    env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  return {
    token,
    sessionId,
    deviceId: opts.deviceId,
    platform: opts.platform,
    user,
  };
}

export function loginUser(input: {
  identifier: string;
  password: string;
  deviceId: string;
  deviceName: string;
  platform: DevicePlatform;
}): AuthSession {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM users WHERE phone = ? OR username = ?')
    .get(input.identifier.trim(), input.identifier.trim().toLowerCase()) as UserRow | undefined;

  if (!row || !verifyPassword(input.password, row.password_hash)) {
    throw new HttpError(401, 'Telefone/usuário ou senha incorretos.');
  }

  const user = mapUserRow(row);
  const isPrimary = input.platform.startsWith('mobile_');
  return createSessionForUser(user, {
    deviceId: input.deviceId,
    deviceName: input.deviceName,
    platform: input.platform,
    isPrimary,
  });
}

export function registerUser(input: {
  username: string;
  displayName: string;
  phone: string;
  password: string;
  age?: number;
  city?: string;
  bio?: string;
  avatarUrl?: string;
  interests?: string[];
  deviceId: string;
  deviceName: string;
  platform: DevicePlatform;
}): AuthSession {
  const db = getDb();
  const username = input.username.trim().toLowerCase();
  const phone = input.phone.trim();

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR phone = ?').get(username, phone);
  if (existing) {
    throw new HttpError(409, 'Telefone ou nome de usuário já cadastrado.');
  }

  const userId = `user-${randomUUID()}`;
  const now = new Date().toISOString();
  const avatarUrl =
    input.avatarUrl?.trim() ||
    `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(username)}`;

  db.prepare(`
    INSERT INTO users (id, username, display_name, phone, password_hash, avatar_url, bio, age, city, interests_json, photos_json, looking_for, verified, is_online, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    username,
    input.displayName.trim(),
    phone,
    hashPassword(input.password),
    avatarUrl,
    input.bio?.trim() || 'Novo(a) no Converse ✨',
    input.age ?? 25,
    input.city?.trim() || 'São Paulo, SP',
    JSON.stringify(input.interests ?? ['Música', 'Viagens', 'Café']),
    JSON.stringify([avatarUrl]),
    'relationship',
    0,
    1,
    now
  );

  const user = getUserById(userId)!;
  return createSessionForUser(user, {
    deviceId: input.deviceId,
    deviceName: input.deviceName,
    platform: input.platform,
    isPrimary: input.platform.startsWith('mobile_'),
  });
}

export function updateProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, 'displayName' | 'bio' | 'city' | 'interests' | 'lookingFor' | 'avatarUrl'>>
): UserProfile {
  const db = getDb();
  const current = getUserById(userId);
  if (!current) throw new HttpError(404, 'Usuário não encontrado.');

  db.prepare(`
    UPDATE users
    SET display_name = ?, bio = ?, city = ?, interests_json = ?, looking_for = ?, avatar_url = ?
    WHERE id = ?
  `).run(
    updates.displayName ?? current.displayName,
    updates.bio ?? current.bio,
    updates.city ?? current.city,
    JSON.stringify(updates.interests ?? current.interests),
    updates.lookingFor ?? current.lookingFor,
    updates.avatarUrl ?? current.avatarUrl,
    userId
  );

  return getUserById(userId)!;
}

function hashResetCode(code: string): string {
  return createHash('sha256').update(code.trim()).digest('hex');
}

function findUserForReset(identifier: string): { id: string; phone: string } | undefined {
  const db = getDb();
  const clean = identifier.trim();
  const direct = db
    .prepare('SELECT id, phone FROM users WHERE phone = ? OR username = ?')
    .get(clean, clean.toLowerCase()) as { id: string; phone: string } | undefined;
  if (direct) return direct;

  const digits = clean.replace(/\D/g, '');
  if (digits.length >= 8) {
    const users = db.prepare('SELECT id, phone FROM users').all() as Array<{ id: string; phone: string }>;
    return users.find((u) => {
      const userDigits = u.phone.replace(/\D/g, '');
      return userDigits === digits || userDigits.endsWith(digits) || digits.endsWith(userDigits);
    });
  }
  return undefined;
}

export async function requestPasswordReset(
  identifier: string
): Promise<{ sent: boolean; maskedPhone?: string; channel?: SmsChannel; devCode?: string }> {
  const db = getDb();
  const row = findUserForReset(identifier);

  if (!row || !row.phone) {
    return { sent: true };
  }

  const code = String(randomInt(100000, 999999));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60_000).toISOString();

  db.prepare('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL').run(
    now.toISOString(),
    row.id
  );
  db.prepare(
    'INSERT INTO password_resets (id, user_id, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(`rst-${randomUUID()}`, row.id, hashResetCode(code), expiresAt, now.toISOString());

  const sms = await sendPasswordResetSms(row.phone, code);
  const includeDevCode = process.env.NODE_ENV !== 'production' && sms.channel === 'dev';

  return {
    sent: true,
    maskedPhone: sms.maskedPhone,
    channel: sms.channel,
    ...(includeDevCode ? { devCode: code } : {}),
  };
}

export function confirmPasswordReset(input: { identifier: string; code: string; newPassword: string }): void {
  const db = getDb();
  const user = findUserForReset(input.identifier);

  if (!user) {
    throw new HttpError(400, 'Código inválido ou expirado.');
  }

  const codeHash = hashResetCode(input.code);
  const now = new Date().toISOString();
  const resetRow = db
    .prepare(
      `SELECT id FROM password_resets
       WHERE user_id = ? AND code_hash = ? AND used_at IS NULL AND expires_at > ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(user.id, codeHash, now) as { id: string } | undefined;

  if (!resetRow) {
    throw new HttpError(400, 'Código inválido ou expirado.');
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(input.newPassword), user.id);
  db.prepare('UPDATE password_resets SET used_at = ? WHERE id = ?').run(now, resetRow.id);
  // Revoga sessões anteriores por segurança após troca de senha
  db.prepare('UPDATE device_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(now, user.id);
}
