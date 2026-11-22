import { randomUUID } from 'node:crypto';
import type {
  ChatSummary,
  MessageDeliveryStatus,
  MessageItem,
  MessageReaction,
  MessageType,
  PollData,
} from '@converse/shared';
import { getDb } from '../db/database.js';
import { scheduleSupabaseSync } from '../db/supabaseSync.js';
import { HttpError } from '../middleware/errorHandler.js';
import { getUserById } from './authService.js';

interface MessageRow {
  id: string;
  client_message_id: string | null;
  chat_id: string;
  sender_id: string;
  type: MessageType;
  content: string;
  media_url: string | null;
  audio_duration_sec: number | null;
  reply_to_id: string | null;
  status: MessageDeliveryStatus;
  edited_at: string | null;
  deleted_at: string | null;
  is_forwarded: number;
  expires_at: string | null;
  poll_json: string | null;
  created_at: string;
}

function hydrateMessages(rows: MessageRow[], viewerUserId?: string): MessageItem[] {
  if (rows.length === 0) return [];
  const db = getDb();

  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const reactionRows = db
    .prepare(
      `SELECT mr.message_id, mr.emoji, mr.user_id, u.display_name
       FROM message_reactions mr
       JOIN users u ON u.id = mr.user_id
       WHERE mr.message_id IN (${placeholders})`
    )
    .all(...ids) as Array<{ message_id: string; emoji: string; user_id: string; display_name: string }>;

  const reactionsMap = new Map<string, MessageReaction[]>();
  for (const r of reactionRows) {
    const arr = reactionsMap.get(r.message_id) || [];
    arr.push({ emoji: r.emoji, userId: r.user_id, userDisplayName: r.display_name });
    reactionsMap.set(r.message_id, arr);
  }

  const starredSet = new Set<string>();
  if (viewerUserId) {
    const starredRows = db
      .prepare(`SELECT message_id FROM starred_messages WHERE user_id = ? AND message_id IN (${placeholders})`)
      .all(viewerUserId, ...ids) as Array<{ message_id: string }>;
    for (const s of starredRows) starredSet.add(s.message_id);
  }

  return rows.map((row) => {
    let replyToPreview: MessageItem['replyToPreview'] = null;
    if (row.reply_to_id) {
      const parent = db
        .prepare(
          `SELECT m.id, m.content, m.type, m.deleted_at, u.display_name as sender_name
           FROM messages m
           JOIN users u ON u.id = m.sender_id
           WHERE m.id = ?`
        )
        .get(row.reply_to_id) as
        | { id: string; content: string; type: MessageType; deleted_at: string | null; sender_name: string }
        | undefined;
      if (parent) {
        replyToPreview = {
          id: parent.id,
          senderName: parent.sender_name,
          content: parent.deleted_at ? '🚫 Mensagem apagada' : parent.content,
          type: parent.type,
        };
      }
    }

    const isDeleted = Boolean(row.deleted_at);
    return {
      id: row.id,
      clientMessageId: row.client_message_id ?? undefined,
      chatId: row.chat_id,
      senderId: row.sender_id,
      type: row.type,
      content: isDeleted ? '🚫 Mensagem apagada' : row.content,
      mediaUrl: isDeleted ? null : row.media_url,
      audioDurationSec: isDeleted ? null : row.audio_duration_sec,
      replyToId: row.reply_to_id,
      replyToPreview,
      status: row.status,
      reactions: isDeleted ? [] : reactionsMap.get(row.id) || [],
      editedAt: row.edited_at,
      deletedAt: row.deleted_at,
      isStarred: starredSet.has(row.id),
      isForwarded: Boolean(row.is_forwarded),
      expiresAt: row.expires_at,
      poll: !isDeleted && row.poll_json ? (JSON.parse(row.poll_json) as PollData) : null,
      createdAt: row.created_at,
    };
  });
}

export function ensureSavedMessagesChat(userId: string): string {
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT c.id FROM chats c
       JOIN chat_members cm ON cm.chat_id = c.id
       WHERE c.is_saved_messages = 1 AND cm.user_id = ?
       LIMIT 1`
    )
    .get(userId) as { id: string } | undefined;

  if (existing) return existing.id;

  const chatId = `chat-saved-${userId}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO chats (id, is_group, is_saved_messages, title, avatar_url, created_at, updated_at)
     VALUES (?, 0, 1, 'Mensagens Salvas', 'https://api.dicebear.com/9.x/shapes/svg?seed=saved-notes', ?, ?)`
  ).run(chatId, now, now);

  db.prepare(
    `INSERT OR IGNORE INTO chat_members (chat_id, user_id, pinned, muted, archived, unread_count)
     VALUES (?, ?, 0, 0, 0, 0)`
  ).run(chatId, userId);

  return chatId;
}

export function isChatMember(chatId: string, userId: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, userId);
  return Boolean(row);
}

export function getChatMemberIds(chatId: string): string[] {
  const db = getDb();
  const rows = db.prepare('SELECT user_id FROM chat_members WHERE chat_id = ?').all(chatId) as Array<{ user_id: string }>;
  return rows.map((r) => r.user_id);
}

export function listChatsForUser(userId: string): ChatSummary[] {
  ensureSavedMessagesChat(userId);
  const db = getDb();
  const now = new Date().toISOString();

  const rows = db
    .prepare(
      `SELECT c.id, c.is_group, c.is_saved_messages, c.title, c.avatar_url, c.disappearing_ttl_sec, c.pinned_message_id, c.updated_at,
              cm.pinned, cm.muted, cm.archived, cm.unread_count
       FROM chats c
       JOIN chat_members cm ON cm.chat_id = c.id
       WHERE cm.user_id = ?
       ORDER BY cm.pinned DESC, c.updated_at DESC`
    )
    .all(userId) as Array<{
    id: string;
    is_group: number;
    is_saved_messages: number;
    title: string;
    avatar_url: string;
    disappearing_ttl_sec: number | null;
    pinned_message_id: string | null;
    updated_at: string;
    pinned: number;
    muted: number;
    archived: number;
    unread_count: number;
  }>;

  return rows.map((chat) => {
    let peerUser = null;
    let title = chat.title;
    let avatarUrl = chat.avatar_url;

    if (!chat.is_group && !chat.is_saved_messages) {
      const peerRow = db
        .prepare('SELECT user_id FROM chat_members WHERE chat_id = ? AND user_id != ? LIMIT 1')
        .get(chat.id, userId) as { user_id: string } | undefined;
      if (peerRow) {
        peerUser = getUserById(peerRow.user_id);
        if (peerUser) {
          title = peerUser.displayName;
          avatarUrl = peerUser.avatarUrl;
        }
      }
    }

    const lastMsgRow = db
      .prepare(
        `SELECT * FROM messages
         WHERE chat_id = ? AND (expires_at IS NULL OR expires_at > ?)
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(chat.id, now) as unknown as MessageRow | undefined;

    const lastMessage = lastMsgRow ? hydrateMessages([lastMsgRow], userId)[0] : null;

    let pinnedMessage: ChatSummary['pinnedMessage'] = null;
    if (chat.pinned_message_id) {
      const pm = db
        .prepare('SELECT id, content, type, sender_id, deleted_at FROM messages WHERE id = ?')
        .get(chat.pinned_message_id) as
        | { id: string; content: string; type: MessageType; sender_id: string; deleted_at: string | null }
        | undefined;
      if (pm && !pm.deleted_at) {
        pinnedMessage = { id: pm.id, content: pm.content, type: pm.type, senderId: pm.sender_id };
      }
    }

    return {
      id: chat.id,
      isGroup: Boolean(chat.is_group),
      isSavedMessages: Boolean(chat.is_saved_messages),
      title,
      avatarUrl,
      peerUser,
      lastMessage,
      unreadCount: chat.unread_count,
      pinned: Boolean(chat.pinned),
      muted: Boolean(chat.muted),
      archived: Boolean(chat.archived),
      disappearingTtlSec: chat.disappearing_ttl_sec,
      pinnedMessage,
      updatedAt: chat.updated_at,
    };
  });
}

export function getChatMessages(chatId: string, userId: string, limit = 80): MessageItem[] {
  if (!isChatMember(chatId, userId)) {
    throw new HttpError(403, 'Você não participa desta conversa.');
  }

  const db = getDb();
  const now = new Date().toISOString();
  const rows = db
    .prepare(
      `SELECT * FROM messages
       WHERE chat_id = ? AND (expires_at IS NULL OR expires_at > ?)
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(chatId, now, limit) as unknown as MessageRow[];

  return hydrateMessages(rows.reverse(), userId);
}

export function sendMessage(input: {
  chatId: string;
  senderId: string;
  type?: MessageType;
  content: string;
  mediaUrl?: string | null;
  audioDurationSec?: number | null;
  replyToId?: string | null;
  clientMessageId?: string;
  isForwarded?: boolean;
  poll?: PollData | null;
}): MessageItem {
  if (!isChatMember(input.chatId, input.senderId)) {
    throw new HttpError(403, 'Você não participa desta conversa.');
  }

  const db = getDb();

  if (input.clientMessageId) {
    const existing = db
      .prepare('SELECT * FROM messages WHERE client_message_id = ?')
      .get(input.clientMessageId) as unknown as MessageRow | undefined;
    if (existing) {
      return hydrateMessages([existing], input.senderId)[0];
    }
  }

  const chat = db.prepare('SELECT disappearing_ttl_sec FROM chats WHERE id = ?').get(input.chatId) as
    | { disappearing_ttl_sec: number | null }
    | undefined;

  const id = `msg-${randomUUID()}`;
  const now = new Date();
  const expiresAt = chat?.disappearing_ttl_sec
    ? new Date(now.getTime() + chat.disappearing_ttl_sec * 1000).toISOString()
    : null;

  const msgType: MessageType = input.type || 'text';

  db.prepare(`
    INSERT INTO messages (
      id, client_message_id, chat_id, sender_id, type, content, media_url, audio_duration_sec,
      reply_to_id, status, is_forwarded, expires_at, poll_json, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?, ?, ?, ?)
  `).run(
    id,
    input.clientMessageId ?? null,
    input.chatId,
    input.senderId,
    msgType,
    input.content,
    input.mediaUrl ?? null,
    input.audioDurationSec ?? null,
    input.replyToId ?? null,
    input.isForwarded ? 1 : 0,
    expiresAt,
    input.poll ? JSON.stringify(input.poll) : null,
    now.toISOString()
  );

  db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(now.toISOString(), input.chatId);
  db.prepare('UPDATE chat_members SET unread_count = unread_count + 1, archived = 0 WHERE chat_id = ? AND user_id != ?').run(
    input.chatId,
    input.senderId
  );

  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as unknown as MessageRow;
  scheduleSupabaseSync();
  return hydrateMessages([row], input.senderId)[0];
}

export function editMessage(messageId: string, userId: string, newContent: string): MessageItem {
  const db = getDb();
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as unknown as MessageRow | undefined;
  if (!row) throw new HttpError(404, 'Mensagem não encontrada.');
  if (row.sender_id !== userId) throw new HttpError(403, 'Você só pode editar suas próprias mensagens.');
  if (row.deleted_at) throw new HttpError(400, 'Não é possível editar uma mensagem apagada.');

  const editedAt = new Date().toISOString();
  db.prepare('UPDATE messages SET content = ?, edited_at = ? WHERE id = ?').run(newContent.trim(), editedAt, messageId);

  const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as unknown as MessageRow;
  return hydrateMessages([updated], userId)[0];
}

export function deleteMessageForEveryone(messageId: string, userId: string): { chatId: string; deletedAt: string } {
  const db = getDb();
  const row = db.prepare('SELECT id, chat_id, sender_id FROM messages WHERE id = ?').get(messageId) as
    | { id: string; chat_id: string; sender_id: string }
    | undefined;
  if (!row) throw new HttpError(404, 'Mensagem não encontrada.');
  if (row.sender_id !== userId) throw new HttpError(403, 'Você só pode apagar suas próprias mensagens.');

  const deletedAt = new Date().toISOString();
  db.prepare("UPDATE messages SET deleted_at = ?, content = '🚫 Mensagem apagada', media_url = NULL, poll_json = NULL WHERE id = ?").run(
    deletedAt,
    messageId
  );
  db.prepare('UPDATE chats SET pinned_message_id = NULL WHERE id = ? AND pinned_message_id = ?').run(row.chat_id, messageId);

  return { chatId: row.chat_id, deletedAt };
}

export function toggleStarMessage(messageId: string, userId: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT chat_id FROM messages WHERE id = ?').get(messageId) as { chat_id: string } | undefined;
  if (!row) throw new HttpError(404, 'Mensagem não encontrada.');
  if (!isChatMember(row.chat_id, userId)) throw new HttpError(403, 'Acesso negado.');

  const existing = db.prepare('SELECT 1 FROM starred_messages WHERE user_id = ? AND message_id = ?').get(userId, messageId);
  if (existing) {
    db.prepare('DELETE FROM starred_messages WHERE user_id = ? AND message_id = ?').run(userId, messageId);
    return false;
  }
  db.prepare('INSERT INTO starred_messages (user_id, message_id, created_at) VALUES (?, ?, ?)').run(
    userId,
    messageId,
    new Date().toISOString()
  );
  return true;
}

export function listStarredMessages(userId: string): MessageItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT m.* FROM messages m
       JOIN starred_messages sm ON sm.message_id = m.id
       WHERE sm.user_id = ? AND m.deleted_at IS NULL
       ORDER BY sm.created_at DESC`
    )
    .all(userId) as unknown as MessageRow[];
  return hydrateMessages(rows, userId);
}

export function pinMessageInChat(
  chatId: string,
  userId: string,
  messageId: string | null
): ChatSummary['pinnedMessage'] {
  if (!isChatMember(chatId, userId)) throw new HttpError(403, 'Acesso negado.');
  const db = getDb();

  if (!messageId) {
    db.prepare('UPDATE chats SET pinned_message_id = NULL WHERE id = ?').run(chatId);
    return null;
  }

  const msg = db
    .prepare('SELECT id, content, type, sender_id, deleted_at FROM messages WHERE id = ? AND chat_id = ?')
    .get(messageId, chatId) as
    | { id: string; content: string; type: MessageType; sender_id: string; deleted_at: string | null }
    | undefined;
  if (!msg || msg.deleted_at) throw new HttpError(404, 'Mensagem não encontrada nesta conversa.');

  db.prepare('UPDATE chats SET pinned_message_id = ? WHERE id = ?').run(messageId, chatId);
  return { id: msg.id, content: msg.content, type: msg.type, senderId: msg.sender_id };
}

export function votePoll(messageId: string, userId: string, optionId: string): { chatId: string; poll: PollData } {
  const db = getDb();
  const row = db.prepare('SELECT chat_id, type, poll_json, deleted_at FROM messages WHERE id = ?').get(messageId) as
    | { chat_id: string; type: string; poll_json: string | null; deleted_at: string | null }
    | undefined;
  if (!row || row.deleted_at || row.type !== 'poll' || !row.poll_json) {
    throw new HttpError(404, 'Enquete não encontrada.');
  }
  if (!isChatMember(row.chat_id, userId)) throw new HttpError(403, 'Acesso negado.');

  const poll = JSON.parse(row.poll_json) as PollData;
  const targetOption = poll.options.find((o) => o.id === optionId);
  if (!targetOption) throw new HttpError(400, 'Opção inválida.');

  const alreadyVoted = targetOption.voterIds.includes(userId);
  if (!poll.allowMultiple) {
    for (const opt of poll.options) {
      opt.voterIds = opt.voterIds.filter((id) => id !== userId);
    }
    if (!alreadyVoted) targetOption.voterIds.push(userId);
  } else {
    targetOption.voterIds = alreadyVoted
      ? targetOption.voterIds.filter((id) => id !== userId)
      : [...targetOption.voterIds, userId];
  }

  db.prepare('UPDATE messages SET poll_json = ? WHERE id = ?').run(JSON.stringify(poll), messageId);
  return { chatId: row.chat_id, poll };
}

export function forwardMessage(messageId: string, userId: string, targetChatIds: string[]): MessageItem[] {
  const db = getDb();
  const source = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as unknown as MessageRow | undefined;
  if (!source || source.deleted_at) throw new HttpError(404, 'Mensagem original não encontrada.');
  if (!isChatMember(source.chat_id, userId)) throw new HttpError(403, 'Acesso negado.');

  return targetChatIds.map((targetChatId) =>
    sendMessage({
      chatId: targetChatId,
      senderId: userId,
      type: source.type === 'poll' ? 'text' : source.type,
      content: source.content,
      mediaUrl: source.media_url,
      audioDurationSec: source.audio_duration_sec,
      isForwarded: true,
    })
  );
}

export function markChatAsRead(chatId: string, readerId: string): string[] {
  if (!isChatMember(chatId, readerId)) {
    throw new HttpError(403, 'Acesso negado.');
  }
  const db = getDb();
  const toUpdate = db
    .prepare("SELECT id FROM messages WHERE chat_id = ? AND sender_id != ? AND status != 'read'")
    .all(chatId, readerId) as Array<{ id: string }>;

  db.prepare("UPDATE messages SET status = 'read' WHERE chat_id = ? AND sender_id != ? AND status != 'read'").run(
    chatId,
    readerId
  );
  db.prepare('UPDATE chat_members SET unread_count = 0 WHERE chat_id = ? AND user_id = ?').run(chatId, readerId);

  return toUpdate.map((r) => r.id);
}

export function reactToMessage(messageId: string, userId: string, emoji: string): { chatId: string; reactions: MessageReaction[] } {
  const db = getDb();
  const msg = db.prepare('SELECT id, chat_id FROM messages WHERE id = ?').get(messageId) as { id: string; chat_id: string } | undefined;
  if (!msg) throw new HttpError(404, 'Mensagem não encontrada.');
  if (!isChatMember(msg.chat_id, userId)) throw new HttpError(403, 'Acesso negado.');

  const existing = db
    .prepare('SELECT emoji FROM message_reactions WHERE message_id = ? AND user_id = ?')
    .get(messageId, userId) as { emoji: string } | undefined;

  if (existing?.emoji === emoji) {
    db.prepare('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?').run(messageId, userId);
  } else {
    db.prepare(`
      INSERT INTO message_reactions (message_id, user_id, emoji, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(message_id, user_id) DO UPDATE SET emoji = excluded.emoji, created_at = excluded.created_at
    `).run(messageId, userId, emoji, new Date().toISOString());
  }

  const reactionRows = db
    .prepare(
      `SELECT mr.emoji, mr.user_id, u.display_name
       FROM message_reactions mr
       JOIN users u ON u.id = mr.user_id
       WHERE mr.message_id = ?`
    )
    .all(messageId) as Array<{ emoji: string; user_id: string; display_name: string }>;

  return {
    chatId: msg.chat_id,
    reactions: reactionRows.map((r) => ({ emoji: r.emoji, userId: r.user_id, userDisplayName: r.display_name })),
  };
}

export function getOrCreateDirectChat(userAId: string, userBId: string): string {
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT c.id
       FROM chats c
       JOIN chat_members cm1 ON cm1.chat_id = c.id AND cm1.user_id = ?
       JOIN chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id = ?
       WHERE c.is_group = 0 AND c.is_saved_messages = 0
       LIMIT 1`
    )
    .get(userAId, userBId) as { id: string } | undefined;

  if (existing) return existing.id;

  const chatId = `chat-${randomUUID()}`;
  const now = new Date().toISOString();
  db.prepare('INSERT INTO chats (id, is_group, is_saved_messages, title, avatar_url, created_at, updated_at) VALUES (?, 0, 0, ?, ?, ?, ?)').run(
    chatId,
    '',
    '',
    now,
    now
  );
  db.prepare('INSERT INTO chat_members (chat_id, user_id, pinned, muted, archived, unread_count) VALUES (?, ?, 0, 0, 0, 0)').run(chatId, userAId);
  db.prepare('INSERT INTO chat_members (chat_id, user_id, pinned, muted, archived, unread_count) VALUES (?, ?, 0, 0, 0, 0)').run(chatId, userBId);

  return chatId;
}

export function toggleChatMemberFlag(
  chatId: string,
  userId: string,
  field: 'pinned' | 'muted' | 'archived'
): boolean {
  const db = getDb();
  const row = db
    .prepare(`SELECT ${field} as val FROM chat_members WHERE chat_id = ? AND user_id = ?`)
    .get(chatId, userId) as { val: number } | undefined;
  if (!row) throw new HttpError(404, 'Conversa não encontrada.');
  const next = row.val ? 0 : 1;
  db.prepare(`UPDATE chat_members SET ${field} = ? WHERE chat_id = ? AND user_id = ?`).run(next, chatId, userId);
  return Boolean(next);
}

export function togglePinChat(chatId: string, userId: string): boolean {
  return toggleChatMemberFlag(chatId, userId, 'pinned');
}

export function setDisappearingTimer(chatId: string, userId: string, ttlSec: number | null): number | null {
  if (!isChatMember(chatId, userId)) throw new HttpError(403, 'Acesso negado.');
  const db = getDb();
  db.prepare('UPDATE chats SET disappearing_ttl_sec = ? WHERE id = ?').run(ttlSec, chatId);
  return ttlSec;
}
