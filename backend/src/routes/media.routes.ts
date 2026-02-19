import { Router } from 'express';
import multer from 'multer';
import { mediaController } from '../controllers/media.controller';
import { authenticate } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

// Multer: store in memory buffer, max 100MB (document limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

// Upload media — proxies to WA API POST /media/upload
// Requires JWT auth. Accepts multipart/form-data with field "file".
router.post('/upload', authenticate, tenantGuard, upload.single('file'), mediaController.upload.bind(mediaController));

// Media proxy for <img>/<video>/<audio> tags — JWT via ?token= query param.
// SSRF protection: only allows URLs whose origin matches user's org WA API base URL.
router.get('/wa-proxy', (req, res, next) => {
  const queryToken = req.query.token as string;
  if (queryToken && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${queryToken}`;
  }
  next();
}, authenticate, tenantGuard, mediaController.proxy.bind(mediaController));

// Authenticated proxy (kept for backward compat)
router.get('/proxy', (req, res, next) => {
  const queryToken = req.query.token as string;
  if (queryToken && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${queryToken}`;
  }
  next();
}, authenticate, tenantGuard, mediaController.proxy.bind(mediaController));

export default router;
