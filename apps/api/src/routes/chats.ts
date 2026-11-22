import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { SOCKET_EVENTS } from '@converse/shared';
import { requireAuth } from '../middleware/auth.js';
import {
  deleteMessageForEveryone,
  editMessage,
  forwardMessage,
  getChatMemberIds,
  getChatMessages,
  getOrCreateDirectChat,
  listChatsForUser,
  listStarredMessages,
  markChatAsRead,
  pinMessageInChat,
  reactToMessage,
  sendMessage,
  setDisappearingTimer,
  toggleChatMemberFlag,
  togglePinChat,
  toggleStarMessage,
  votePoll,
} from '../services/chatService.js';
import { getIO } from '../socket/gateway.js';

export const chatsRouter = Router();

chatsRouter.use(requireAuth);

chatsRouter.get('/', (req, res) => {
  const chats = listChatsForUser(req.auth!.userId);
  res.json({ chats });
});

chatsRouter.get('/starred', (req, res) => {
  const messages = listStarredMessages(req.auth!.userId);
  res.json({ messages });
});

chatsRouter.post('/direct', (req, res, next) => {
  try {
    const body = z.object({ peerUserId: z.string().min(1) }).parse(req.body);
    const chatId = getOrCreateDirectChat(req.auth!.userId, body.peerUserId);
    const chats = listChatsForUser(req.auth!.userId);
    const chat = chats.find((c) => c.id === chatId) || null;
    res.json({ chatId, chat });
  } catch (err) {
    next(err);
  }
});

chatsRouter.get('/:chatId/messages', (req, res, next) => {
  try {
    const chatId = String(req.params.chatId);
    const limit = Number(req.query.limit || 80);
    const messages = getChatMessages(chatId, req.auth!.userId, limit);
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

chatsRouter.post('/:chatId/messages', (req, res, next) => {
  try {
    const chatId = String(req.params.chatId);
    const body = z
      .object({
        type: z.enum(['text', 'image', 'audio', 'video', 'story_reply', 'poll']).default('text'),
        content: z.string().min(1).max(4000),
        mediaUrl: z.string().max(20_000_000).nullable().optional(),
        audioDurationSec: z.number().int().min(1).max(600).nullable().optional(),
        replyToId: z.string().nullable().optional(),
        clientMessageId: z.string().optional(),
        poll: z
          .object({
            question: z.string().min(1).max(200),
            allowMultiple: z.boolean().default(false),
            options: z.array(z.string().min(1).max(100)).min(2).max(6),
          })
          .optional(),
      })
      .parse(req.body);

    const pollData = body.poll
      ? {
          question: body.poll.question,
          allowMultiple: body.poll.allowMultiple,
          options: body.poll.options.map((text) => ({
            id: `opt-${randomUUID().slice(0, 8)}`,
            text,
            voterIds: [],
          })),
        }
      : null;

    const message = sendMessage({
      chatId,
      senderId: req.auth!.userId,
      type: body.type,
      content: body.poll ? `📊 Enquete: ${body.poll.question}` : body.content,
      mediaUrl: body.mediaUrl,
      audioDurationSec: body.audioDurationSec,
      replyToId: body.replyToId,
      clientMessageId: body.clientMessageId,
      poll: pollData,
    });

    const io = getIO();
    for (const memberId of getChatMemberIds(chatId)) {
      io?.to(`user:${memberId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, message);
    }

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
});

chatsRouter.patch('/messages/:messageId', (req, res, next) => {
  try {
    const messageId = String(req.params.messageId);
    const body = z.object({ content: z.string().min(1).max(4000) }).parse(req.body);
    const message = editMessage(messageId, req.auth!.userId, body.content);

    const io = getIO();
    for (const memberId of getChatMemberIds(message.chatId)) {
      io?.to(`user:${memberId}`).emit(SOCKET_EVENTS.MESSAGE_EDITED, message);
    }

    res.json({ message });
  } catch (err) {
    next(err);
  }
});

chatsRouter.delete('/messages/:messageId', (req, res, next) => {
  try {
    const messageId = String(req.params.messageId);
    const result = deleteMessageForEveryone(messageId, req.auth!.userId);

    const io = getIO();
    for (const memberId of getChatMemberIds(result.chatId)) {
      io?.to(`user:${memberId}`).emit(SOCKET_EVENTS.MESSAGE_DELETED, {
        chatId: result.chatId,
        messageId,
        deletedAt: result.deletedAt,
      });
    }

    res.json({ deleted: true, ...result });
  } catch (err) {
    next(err);
  }
});

chatsRouter.post('/messages/:messageId/star', (req, res, next) => {
  try {
    const starred = toggleStarMessage(String(req.params.messageId), req.auth!.userId);
    res.json({ starred });
  } catch (err) {
    next(err);
  }
});

chatsRouter.post('/messages/:messageId/forward', (req, res, next) => {
  try {
    const body = z.object({ targetChatIds: z.array(z.string().min(1)).min(1).max(10) }).parse(req.body);
    const messages = forwardMessage(String(req.params.messageId), req.auth!.userId, body.targetChatIds);

    const io = getIO();
    for (const msg of messages) {
      for (const memberId of getChatMemberIds(msg.chatId)) {
        io?.to(`user:${memberId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, msg);
      }
    }

    res.status(201).json({ messages });
  } catch (err) {
    next(err);
  }
});

chatsRouter.post('/messages/:messageId/vote', (req, res, next) => {
  try {
    const messageId = String(req.params.messageId);
    const body = z.object({ optionId: z.string().min(1) }).parse(req.body);
    const result = votePoll(messageId, req.auth!.userId, body.optionId);

    const io = getIO();
    for (const memberId of getChatMemberIds(result.chatId)) {
      io?.to(`user:${memberId}`).emit(SOCKET_EVENTS.POLL_UPDATED, {
        chatId: result.chatId,
        messageId,
        poll: result.poll,
      });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

chatsRouter.post('/:chatId/read', (req, res, next) => {
  try {
    const chatId = String(req.params.chatId);
    const updatedIds = markChatAsRead(chatId, req.auth!.userId);
    if (updatedIds.length > 0) {
      const io = getIO();
      for (const memberId of getChatMemberIds(chatId)) {
        io?.to(`user:${memberId}`).emit(SOCKET_EVENTS.MESSAGE_STATUS, {
          chatId,
          messageIds: updatedIds,
          status: 'read',
          readerId: req.auth!.userId,
        });
      }
    }
    res.json({ updatedIds });
  } catch (err) {
    next(err);
  }
});

chatsRouter.post('/:chatId/pin', (req, res, next) => {
  try {
    const pinned = togglePinChat(String(req.params.chatId), req.auth!.userId);
    res.json({ pinned });
  } catch (err) {
    next(err);
  }
});

chatsRouter.post('/:chatId/archive', (req, res, next) => {
  try {
    const archived = toggleChatMemberFlag(String(req.params.chatId), req.auth!.userId, 'archived');
    res.json({ archived });
  } catch (err) {
    next(err);
  }
});

chatsRouter.post('/:chatId/mute', (req, res, next) => {
  try {
    const muted = toggleChatMemberFlag(String(req.params.chatId), req.auth!.userId, 'muted');
    res.json({ muted });
  } catch (err) {
    next(err);
  }
});

chatsRouter.post('/:chatId/disappearing', (req, res, next) => {
  try {
    const body = z.object({ ttlSec: z.number().int().positive().nullable() }).parse(req.body);
    const ttlSec = setDisappearingTimer(String(req.params.chatId), req.auth!.userId, body.ttlSec);
    res.json({ disappearingTtlSec: ttlSec });
  } catch (err) {
    next(err);
  }
});

chatsRouter.post('/:chatId/pin-message', (req, res, next) => {
  try {
    const chatId = String(req.params.chatId);
    const body = z.object({ messageId: z.string().nullable() }).parse(req.body);
    const pinnedMessage = pinMessageInChat(chatId, req.auth!.userId, body.messageId);

    const io = getIO();
    for (const memberId of getChatMemberIds(chatId)) {
      io?.to(`user:${memberId}`).emit(SOCKET_EVENTS.CHAT_MESSAGE_PINNED, {
        chatId,
        pinnedMessage,
      });
    }

    res.json({ pinnedMessage });
  } catch (err) {
    next(err);
  }
});

chatsRouter.post('/messages/:messageId/react', (req, res, next) => {
  try {
    const messageId = String(req.params.messageId);
    const body = z.object({ emoji: z.string().min(1).max(8) }).parse(req.body);
    const result = reactToMessage(messageId, req.auth!.userId, body.emoji);

    const io = getIO();
    for (const memberId of getChatMemberIds(result.chatId)) {
      io?.to(`user:${memberId}`).emit(SOCKET_EVENTS.MESSAGE_REACTION_UPDATED, {
        chatId: result.chatId,
        messageId,
        reactions: result.reactions,
      });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});
