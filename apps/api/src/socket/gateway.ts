import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { SOCKET_EVENTS } from '@converse/shared';
import { getDb } from '../db/database.js';
import { verifyTokenAndSession, type AuthTokenPayload } from '../middleware/auth.js';
import {
  getChatMemberIds,
  isChatMember,
  markChatAsRead,
  reactToMessage,
  sendMessage,
} from '../services/chatService.js';

let ioInstance: Server | null = null;

export function getIO(): Server | null {
  return ioInstance;
}

export function initSocketGateway(httpServer: HttpServer, corsOrigin: string | string[]): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
    },
  });

  ioInstance = io;

  io.on('connection', (socket: Socket) => {
    const token = socket.handshake.auth?.token as string | undefined;
    let auth: AuthTokenPayload | null = null;

    if (token) {
      try {
        auth = verifyTokenAndSession(token);
        socket.join(`user:${auth.userId}`);
        socket.join(`session:${auth.sessionId}`);

        const db = getDb();
        db.prepare('UPDATE users SET is_online = 1, last_seen_at = ? WHERE id = ?').run(
          new Date().toISOString(),
          auth.userId
        );

        io.emit(SOCKET_EVENTS.PRESENCE_UPDATE, {
          userId: auth.userId,
          isOnline: true,
          lastSeenAt: new Date().toISOString(),
        });
      } catch {
        socket.emit(SOCKET_EVENTS.SESSION_REVOKED, { reason: 'Sessão inválida ou expirada.' });
        socket.disconnect(true);
        return;
      }
    }

    // Unauthenticated Web client waiting on QR screen
    socket.on(SOCKET_EVENTS.PAIRING_JOIN, (payload: { pairingId?: string }) => {
      if (payload?.pairingId) {
        socket.join(`pairing:${payload.pairingId}`);
      }
    });

    // Authenticated events
    socket.on(SOCKET_EVENTS.CHAT_JOIN, (payload: { chatId?: string }) => {
      if (!auth || !payload?.chatId) return;
      if (isChatMember(payload.chatId, auth.userId)) {
        socket.join(`chat:${payload.chatId}`);
      }
    });

    socket.on(SOCKET_EVENTS.TYPING_START, (payload: { chatId?: string; isRecording?: boolean }) => {
      if (!auth || !payload?.chatId) return;
      if (!isChatMember(payload.chatId, auth.userId)) return;
      socket.to(`chat:${payload.chatId}`).emit(SOCKET_EVENTS.TYPING_START, {
        chatId: payload.chatId,
        userId: auth.userId,
        isRecording: Boolean(payload.isRecording),
      });
    });

    socket.on(SOCKET_EVENTS.TYPING_STOP, (payload: { chatId?: string }) => {
      if (!auth || !payload?.chatId) return;
      if (!isChatMember(payload.chatId, auth.userId)) return;
      socket.to(`chat:${payload.chatId}`).emit(SOCKET_EVENTS.TYPING_STOP, {
        chatId: payload.chatId,
        userId: auth.userId,
      });
    });

    socket.on(
      SOCKET_EVENTS.MESSAGE_SEND,
      (
        payload: {
          chatId: string;
          type?: 'text' | 'image' | 'audio' | 'story_reply';
          content: string;
          mediaUrl?: string | null;
          audioDurationSec?: number | null;
          replyToId?: string | null;
          clientMessageId?: string;
        },
        ack?: (res: { ok: boolean; message?: unknown; error?: string }) => void
      ) => {
        if (!auth) {
          ack?.({ ok: false, error: 'Não autenticado.' });
          return;
        }
        try {
          const message = sendMessage({
            chatId: payload.chatId,
            senderId: auth.userId,
            type: payload.type,
            content: payload.content,
            mediaUrl: payload.mediaUrl,
            audioDurationSec: payload.audioDurationSec,
            replyToId: payload.replyToId,
            clientMessageId: payload.clientMessageId,
          });

          const memberIds = getChatMemberIds(payload.chatId);
          for (const memberId of memberIds) {
            io.to(`user:${memberId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, message);
          }

          ack?.({ ok: true, message });
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : 'Erro ao enviar.' });
        }
      }
    );

    socket.on(SOCKET_EVENTS.MESSAGE_STATUS, (payload: { chatId?: string; status?: 'read' }) => {
      if (!auth || !payload?.chatId || payload.status !== 'read') return;
      try {
        const updatedIds = markChatAsRead(payload.chatId, auth.userId);
        if (updatedIds.length > 0) {
          const memberIds = getChatMemberIds(payload.chatId);
          for (const memberId of memberIds) {
            io.to(`user:${memberId}`).emit(SOCKET_EVENTS.MESSAGE_STATUS, {
              chatId: payload.chatId,
              messageIds: updatedIds,
              status: 'read',
              readerId: auth.userId,
            });
          }
        }
      } catch {
        // ignore unauthorized read receipts
      }
    });

    socket.on(SOCKET_EVENTS.MESSAGE_REACT, (payload: { messageId?: string; emoji?: string }) => {
      if (!auth || !payload?.messageId || !payload?.emoji) return;
      try {
        const result = reactToMessage(payload.messageId, auth.userId, payload.emoji);
        const memberIds = getChatMemberIds(result.chatId);
        for (const memberId of memberIds) {
          io.to(`user:${memberId}`).emit(SOCKET_EVENTS.MESSAGE_REACTION_UPDATED, {
            chatId: result.chatId,
            messageId: payload.messageId,
            reactions: result.reactions,
          });
        }
      } catch {
        // ignore invalid reaction
      }
    });

    // Audio / Video Call Signaling (WhatsApp / Telegram style)
    socket.on(SOCKET_EVENTS.CALL_INVITE, (payload: { targetUserId?: string; chatId?: string; mode?: 'audio' | 'video'; callerName?: string; callerAvatar?: string }) => {
      if (!auth || !payload?.targetUserId) return;
      io.to(`user:${payload.targetUserId}`).emit(SOCKET_EVENTS.CALL_INVITE, {
        ...payload,
        callerId: auth.userId,
      });
    });

    socket.on(SOCKET_EVENTS.CALL_ACCEPT, (payload: { targetUserId?: string; chatId?: string }) => {
      if (!auth || !payload?.targetUserId) return;
      io.to(`user:${payload.targetUserId}`).emit(SOCKET_EVENTS.CALL_ACCEPT, {
        chatId: payload.chatId,
        accepterId: auth.userId,
      });
    });

    socket.on(SOCKET_EVENTS.CALL_REJECT, (payload: { targetUserId?: string; chatId?: string }) => {
      if (!auth || !payload?.targetUserId) return;
      io.to(`user:${payload.targetUserId}`).emit(SOCKET_EVENTS.CALL_REJECT, {
        chatId: payload.chatId,
        rejecterId: auth.userId,
      });
    });

    socket.on(SOCKET_EVENTS.CALL_END, (payload: { targetUserId?: string; chatId?: string }) => {
      if (!auth || !payload?.targetUserId) return;
      io.to(`user:${payload.targetUserId}`).emit(SOCKET_EVENTS.CALL_END, {
        chatId: payload.chatId,
        enderId: auth.userId,
      });
    });

    socket.on('disconnect', () => {
      if (!auth) return;
      // Check if user still has any other active sockets (e.g., Mobile + Web)
      const room = io.sockets.adapter.rooms.get(`user:${auth.userId}`);
      if (!room || room.size === 0) {
        const now = new Date().toISOString();
        const db = getDb();
        db.prepare('UPDATE users SET is_online = 0, last_seen_at = ? WHERE id = ?').run(now, auth.userId);
        io.emit(SOCKET_EVENTS.PRESENCE_UPDATE, {
          userId: auth.userId,
          isOnline: false,
          lastSeenAt: now,
        });
      }
    });
  });

  return io;
}
