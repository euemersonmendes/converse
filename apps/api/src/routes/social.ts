import { Router } from 'express';
import { z } from 'zod';
import { SOCKET_EVENTS } from '@converse/shared';
import { requireAuth } from '../middleware/auth.js';
import { getChatMemberIds, getOrCreateDirectChat, sendMessage } from '../services/chatService.js';
import {
  addPostComment,
  createPost,
  createStory,
  listFeedPosts,
  listFollowingUsers,
  listPeopleDirectory,
  listStoryGroups,
  markStoryViewed,
  toggleFollowUser,
  togglePostLike,
} from '../services/socialService.js';
import { getIO } from '../socket/gateway.js';

export const socialRouter = Router();

socialRouter.use(requireAuth);

// Stories
socialRouter.get('/stories', (req, res) => {
  const groups = listStoryGroups(req.auth!.userId);
  res.json({ groups });
});

socialRouter.post('/stories', (req, res, next) => {
  try {
    const body = z
      .object({
        mediaUrl: z.string().min(1).max(15_000_000),
        caption: z.string().max(220).optional(),
        backgroundColor: z.string().max(20).optional(),
      })
      .parse(req.body);

    const story = createStory(req.auth!.userId, body);
    res.status(201).json({ story });
  } catch (err) {
    next(err);
  }
});

socialRouter.post('/stories/:storyId/view', (req, res) => {
  markStoryViewed(String(req.params.storyId), req.auth!.userId);
  res.json({ ok: true });
});

socialRouter.post('/stories/:storyId/reply', (req, res, next) => {
  try {
    const body = z
      .object({
        targetUserId: z.string().min(1),
        content: z.string().min(1).max(1000),
      })
      .parse(req.body);

    const chatId = getOrCreateDirectChat(req.auth!.userId, body.targetUserId);
    const message = sendMessage({
      chatId,
      senderId: req.auth!.userId,
      type: 'story_reply',
      content: `Respondeu ao seu Story: "${body.content}"`,
    });

    const io = getIO();
    for (const memberId of getChatMemberIds(chatId)) {
      io?.to(`user:${memberId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, message);
    }

    res.status(201).json({ chatId, message });
  } catch (err) {
    next(err);
  }
});

// Feed Posts
socialRouter.get('/posts', (req, res) => {
  const posts = listFeedPosts(req.auth!.userId);
  res.json({ posts });
});

socialRouter.post('/posts', (req, res, next) => {
  try {
    const body = z
      .object({
        imageUrl: z.string().min(1).max(15_000_000),
        caption: z.string().min(1).max(1000),
        location: z.string().max(100).optional(),
      })
      .parse(req.body);

    const post = createPost(req.auth!.userId, body);
    res.status(201).json({ post });
  } catch (err) {
    next(err);
  }
});

socialRouter.post('/posts/:postId/like', (req, res, next) => {
  try {
    const result = togglePostLike(String(req.params.postId), req.auth!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

socialRouter.post('/posts/:postId/comments', (req, res, next) => {
  try {
    const body = z.object({ content: z.string().min(1).max(500) }).parse(req.body);
    const comment = addPostComment(String(req.params.postId), req.auth!.userId, body.content);
    res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
});

// Following / People Directory
socialRouter.get('/following', (req, res) => {
  const users = listFollowingUsers(req.auth!.userId);
  res.json({ users });
});

socialRouter.get('/people', (req, res) => {
  const people = listPeopleDirectory(req.auth!.userId);
  res.json({ people });
});

socialRouter.post('/follow/:userId', (req, res, next) => {
  try {
    const result = toggleFollowUser(req.auth!.userId, String(req.params.userId));
    res.json(result);
  } catch (err) {
    next(err);
  }
});
