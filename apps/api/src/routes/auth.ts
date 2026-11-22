import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import {
  confirmPasswordReset,
  getUserById,
  loginUser,
  registerUser,
  requestPasswordReset,
  updateProfile,
} from '../services/authService.js';

export const authRouter = Router();

const platformSchema = z.enum(['mobile_ios', 'mobile_android', 'web_chrome', 'web_safari', 'web_browser']);

authRouter.post('/login', (req, res, next) => {
  try {
    const body = z
      .object({
        identifier: z.string().min(2),
        password: z.string().min(4),
        deviceId: z.string().default('mobile-default'),
        deviceName: z.string().default('Smartphone'),
        platform: platformSchema.default('mobile_ios'),
      })
      .parse(req.body);

    const session = loginUser(body);
    res.json(session);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/register', (req, res, next) => {
  try {
    const body = z
      .object({
        username: z.string().min(3).max(30),
        displayName: z.string().min(2).max(50),
        phone: z.string().min(6).max(20),
        password: z.string().min(4),
        age: z.number().int().min(18).max(99).optional(),
        city: z.string().optional(),
        bio: z.string().max(240).optional(),
        avatarUrl: z.string().max(2_000_000).optional(),
        interests: z.array(z.string()).optional(),
        deviceId: z.string().default('mobile-default'),
        deviceName: z.string().default('Smartphone'),
        platform: platformSchema.default('mobile_ios'),
      })
      .parse(req.body);

    const session = registerUser(body);
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const body = z.object({ identifier: z.string().min(2) }).parse(req.body);
    const result = await requestPasswordReset(body.identifier);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/reset-password', (req, res, next) => {
  try {
    const body = z
      .object({
        identifier: z.string().min(2),
        code: z.string().length(6),
        newPassword: z.string().min(4),
      })
      .parse(req.body);

    confirmPasswordReset(body);
    res.json({ reset: true });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  const user = getUserById(req.auth!.userId);
  res.json({ user, sessionId: req.auth!.sessionId, platform: req.auth!.platform });
});

authRouter.patch('/me', requireAuth, (req, res, next) => {
  try {
    const body = z
      .object({
        displayName: z.string().min(2).max(50).optional(),
        bio: z.string().max(240).optional(),
        city: z.string().max(80).optional(),
        interests: z.array(z.string()).max(10).optional(),
        lookingFor: z.enum(['relationship', 'friendship', 'networking', 'all']).optional(),
        avatarUrl: z.string().url().optional(),
      })
      .parse(req.body);

    const user = updateProfile(req.auth!.userId, body);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});
