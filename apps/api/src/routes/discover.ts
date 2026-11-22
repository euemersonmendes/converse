import { Router } from 'express';
import { z } from 'zod';
import { SOCKET_EVENTS } from '@converse/shared';
import { requireAuth } from '../middleware/auth.js';
import {
  activateBoost,
  getBoostStatus,
  getDiscoverCandidates,
  getLikesReceived,
  rewindLastSwipe,
  swipeCandidate,
} from '../services/matchService.js';
import { getIO } from '../socket/gateway.js';

export const discoverRouter = Router();

discoverRouter.use(requireAuth);

discoverRouter.get('/', (req, res, next) => {
  try {
    const query = z
      .object({
        minAge: z.coerce.number().int().min(18).max(99).optional(),
        maxAge: z.coerce.number().int().min(18).max(99).optional(),
        maxDistanceKm: z.coerce.number().int().min(1).max(500).optional(),
        lookingFor: z.enum(['relationship', 'friendship', 'networking', 'all']).optional(),
      })
      .parse(req.query);

    const candidates = getDiscoverCandidates(req.auth!.userId, query);
    const boost = getBoostStatus(req.auth!.userId);
    res.json({ candidates, boost });
  } catch (err) {
    next(err);
  }
});

discoverRouter.get('/likes-received', (req, res, next) => {
  try {
    const likes = getLikesReceived(req.auth!.userId);
    res.json({ likes });
  } catch (err) {
    next(err);
  }
});

discoverRouter.post('/rewind', (req, res, next) => {
  try {
    const candidate = rewindLastSwipe(req.auth!.userId);
    res.json({ candidate });
  } catch (err) {
    next(err);
  }
});

discoverRouter.post('/boost', (req, res, next) => {
  try {
    const boost = activateBoost(req.auth!.userId);
    res.json({ boost });
  } catch (err) {
    next(err);
  }
});

discoverRouter.post('/swipe', (req, res, next) => {
  try {
    const body = z
      .object({
        targetUserId: z.string().min(1),
        action: z.enum(['like', 'super_spark', 'pass']),
      })
      .parse(req.body);

    const result = swipeCandidate(req.auth!.userId, body.targetUserId, body.action);

    if (result.matched) {
      const io = getIO();
      io?.to(`user:${req.auth!.userId}`).emit(SOCKET_EVENTS.MATCH_NEW, result);
      io?.to(`user:${body.targetUserId}`).emit(SOCKET_EVENTS.MATCH_NEW, result);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});
