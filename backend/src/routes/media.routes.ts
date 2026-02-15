import { Router } from 'express';
import { mediaController } from '../controllers/media.controller';
import { authenticate } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

// Public media proxy — no JWT required.
// SSRF protection: only allows URLs whose origin matches WA API base URL.
// Used by <img>/<video>/<audio> tags which cannot send Authorization headers.
router.get('/wa-proxy', mediaController.publicProxy.bind(mediaController));

// Authenticated proxy (kept for backward compat)
router.get('/proxy', (req, res, next) => {
  const queryToken = req.query.token as string;
  if (queryToken && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${queryToken}`;
  }
  next();
}, authenticate, tenantGuard, mediaController.proxy.bind(mediaController));

export default router;
