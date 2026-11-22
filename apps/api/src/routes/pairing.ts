import { Router } from 'express';
import { z } from 'zod';
import { SOCKET_EVENTS } from '@converse/shared';
import { requireAuth } from '../middleware/auth.js';
import {
  approvePairingSession,
  createPairingSession,
  getPairingStatus,
  listUserDevices,
  revokeDeviceSession,
} from '../services/pairingService.js';
import { getIO } from '../socket/gateway.js';

export const pairingRouter = Router();

// Web calls this to generate a QR code & 8-char code
pairingRouter.post('/session', (req, res, next) => {
  try {
    const body = z
      .object({
        webDeviceName: z.string().max(80).optional(),
      })
      .parse(req.body || {});
    const pairing = createPairingSession(body.webDeviceName);
    res.status(201).json(pairing);
  } catch (err) {
    next(err);
  }
});

// Web polls or listens via socket for approval
pairingRouter.get('/session/:pairingId', (req, res, next) => {
  try {
    const status = getPairingStatus(req.params.pairingId);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

// Mobile scans QR or enters 8-char pairing code to authorize Web
pairingRouter.post('/approve', requireAuth, (req, res, next) => {
  try {
    const body = z
      .object({
        pairingId: z.string().optional(),
        pairingCode: z.string().optional(),
        webDeviceName: z.string().optional(),
      })
      .refine((v) => Boolean(v.pairingId || v.pairingCode), {
        message: 'Informe pairingId ou pairingCode.',
      })
      .parse(req.body);

    const result = approvePairingSession({
      userId: req.auth!.userId,
      pairingId: body.pairingId,
      pairingCode: body.pairingCode,
      webDeviceName: body.webDeviceName,
    });

    const io = getIO();
    io?.to(`pairing:${result.pairingId}`).emit(SOCKET_EVENTS.PAIRING_APPROVED, result.session);

    res.json({ approved: true, session: result.session });
  } catch (err) {
    next(err);
  }
});

// List all active linked devices (Mobile + Web)
pairingRouter.get('/devices', requireAuth, (req, res) => {
  const devices = listUserDevices(req.auth!.userId);
  res.json({ devices });
});

// Remotely disconnect a linked Web/Mobile device
pairingRouter.delete('/devices/:sessionId', requireAuth, (req, res, next) => {
  try {
    const sessionId = String(req.params.sessionId);
    revokeDeviceSession(req.auth!.userId, sessionId);
    const io = getIO();
    io?.to(`session:${sessionId}`).emit(SOCKET_EVENTS.SESSION_REVOKED, {
      reason: 'Dispositivo desconectado pelo aparelho principal.',
    });
    res.json({ revoked: true });
  } catch (err) {
    next(err);
  }
});
