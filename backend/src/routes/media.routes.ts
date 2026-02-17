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
