import { randomUUID } from 'node:crypto';
import type {
  BoostStatus,
  DiscoverCandidate,
  DiscoverFilters,
  MatchResult,
  ReceivedLikeItem,
} from '@converse/shared';
import { getDb } from '../db/database.js';
import { HttpError } from '../middleware/errorHandler.js';
import { getUserById, mapUserRow } from './authService.js';
import { getOrCreateDirectChat, sendMessage } from './chatService.js';

function buildCandidateFromRow(row: any, meInterests: string[]): DiscoverCandidate {
  const user = mapUserRow(row);
  const photos = JSON.parse(row.photos_json || '[]') as string[];
  const sharedInterests = user.interests.filter((i) => meInterests.includes(i));
  const baseScore = 68 + sharedInterests.length * 8 + (user.verified ? 4 : 0);
  const compatibilityScore = Math.min(99, baseScore);
  const distanceKm = Math.max(1, (row.id.length * 3) % 18);
  const isBoosted = Boolean(row.boosted_until && new Date(row.boosted_until).getTime() > Date.now());

  return {
    user,
    compatibilityScore,
    sharedInterests,
    distanceKm,
    photos: photos.length > 0 ? photos : [user.avatarUrl],
    isBoosted,
  };
}

export function getDiscoverCandidates(userId: string, filters: DiscoverFilters = {}): DiscoverCandidate[] {
  const db = getDb();
  const me = getUserById(userId);
  if (!me) throw new HttpError(404, 'Usuário não encontrado.');

  const rows = db
    .prepare(
      `SELECT * FROM users
       WHERE id != ?
       AND id NOT IN (SELECT to_user_id FROM swipes WHERE from_user_id = ?)`
    )
    .all(userId, userId) as any[];

  return rows
    .map((row) => buildCandidateFromRow(row, me.interests))
    .filter((c) => {
      if (filters.minAge && c.user.age < filters.minAge) return false;
      if (filters.maxAge && c.user.age > filters.maxAge) return false;
      if (filters.maxDistanceKm && c.distanceKm > filters.maxDistanceKm) return false;
      if (filters.lookingFor && filters.lookingFor !== 'all' && c.user.lookingFor !== filters.lookingFor) {
        return false;
      }
      return true;
    })
    .sort((a, b) => Number(Boolean(b.isBoosted)) - Number(Boolean(a.isBoosted)) || b.compatibilityScore - a.compatibilityScore);
}

export function swipeCandidate(
  fromUserId: string,
  toUserId: string,
  action: 'like' | 'super_spark' | 'pass'
): MatchResult {
  if (fromUserId === toUserId) {
    throw new HttpError(400, 'Você não pode curtir a si mesmo.');
  }

  const db = getDb();
  const target = getUserById(toUserId);
  if (!target) throw new HttpError(404, 'Perfil não encontrado.');

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO swipes (from_user_id, to_user_id, action, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(from_user_id, to_user_id) DO UPDATE SET action = excluded.action, created_at = excluded.created_at
  `).run(fromUserId, toUserId, action, now);

  if (action === 'pass') {
    return { matched: false };
  }

  const reciprocal = db
    .prepare("SELECT action FROM swipes WHERE from_user_id = ? AND to_user_id = ? AND action IN ('like', 'super_spark')")
    .get(toUserId, fromUserId) as { action: string } | undefined;

  if (!reciprocal) {
    return { matched: false };
  }

  const [userA, userB] = [fromUserId, toUserId].sort();
  const existingMatch = db
    .prepare('SELECT id, chat_id FROM matches WHERE user_a_id = ? AND user_b_id = ?')
    .get(userA, userB) as { id: string; chat_id: string } | undefined;

  if (existingMatch) {
    return {
      matched: true,
      matchId: existingMatch.id,
      chatId: existingMatch.chat_id,
      matchedUser: target,
    };
  }

  const chatId = getOrCreateDirectChat(fromUserId, toUserId);
  const matchId = `match-${randomUUID()}`;
  db.prepare('INSERT INTO matches (id, user_a_id, user_b_id, chat_id, created_at) VALUES (?, ?, ?, ?, ?)').run(
    matchId,
    userA,
    userB,
    chatId,
    now
  );

  sendMessage({
    chatId,
    senderId: fromUserId,
    type: 'match_intro',
    content: action === 'super_spark' ? '⚡ Vocês deram um Super Spark! Comecem a conversar!' : '✨ Deu Match! Que tal mandar um oi?',
  });

  return {
    matched: true,
    matchId,
    chatId,
    matchedUser: target,
  };
}

export function rewindLastSwipe(userId: string): DiscoverCandidate {
  const db = getDb();
  const me = getUserById(userId);
  if (!me) throw new HttpError(404, 'Usuário não encontrado.');

  const last = db
    .prepare(
      `SELECT s.to_user_id
       FROM swipes s
       WHERE s.from_user_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM matches m
         WHERE (m.user_a_id = s.from_user_id AND m.user_b_id = s.to_user_id)
            OR (m.user_b_id = s.from_user_id AND m.user_a_id = s.to_user_id)
       )
       ORDER BY s.created_at DESC
       LIMIT 1`
    )
    .get(userId) as { to_user_id: string } | undefined;

  if (!last) {
    throw new HttpError(404, 'Nenhum perfil recente para voltar (Rewind).');
  }

  db.prepare('DELETE FROM swipes WHERE from_user_id = ? AND to_user_id = ?').run(userId, last.to_user_id);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(last.to_user_id) as any;
  if (!row) throw new HttpError(404, 'Perfil não encontrado.');

  return buildCandidateFromRow(row, me.interests);
}

export function getLikesReceived(userId: string): ReceivedLikeItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT u.*, s.action as swipe_action, s.created_at as liked_at
       FROM swipes s
       JOIN users u ON u.id = s.from_user_id
       WHERE s.to_user_id = ?
         AND s.action IN ('like', 'super_spark')
         AND s.from_user_id NOT IN (SELECT to_user_id FROM swipes WHERE from_user_id = ?)
       ORDER BY s.created_at DESC`
    )
    .all(userId, userId) as any[];

  return rows.map((r) => ({
    user: mapUserRow(r),
    action: r.swipe_action as 'like' | 'super_spark',
    likedAt: r.liked_at,
  }));
}

export function activateBoost(userId: string): BoostStatus {
  const db = getDb();
  const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
  db.prepare('UPDATE users SET boosted_until = ? WHERE id = ?').run(expiresAt, userId);
  return { active: true, expiresAt };
}

export function getBoostStatus(userId: string): BoostStatus {
  const db = getDb();
  const row = db.prepare('SELECT boosted_until FROM users WHERE id = ?').get(userId) as
    | { boosted_until: string | null }
    | undefined;
  const active = Boolean(row?.boosted_until && new Date(row.boosted_until).getTime() > Date.now());
  return { active, expiresAt: active ? row!.boosted_until : null };
}
