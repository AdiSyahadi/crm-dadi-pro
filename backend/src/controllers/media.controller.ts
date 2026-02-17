import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { prisma } from '../config/database';
import { WAApiClient, resolveDockerUrl } from '../services/wa-api.client';

export class MediaController {
  /**
   * Upload media file — proxies to WA API POST /media/upload.
   * Accepts multipart/form-data with field "file" (via multer).
   * Returns the media URL that can be used in send-media / broadcast.
   */
  async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        res.status(400).json({ success: false, message: 'No file uploaded. Use field name "file".' });
        return;
      }

      const waClient = await WAApiClient.forOrganization(req.user!.organizationId);

      // Derive media type from mime
      let mediaType = req.body.type as string | undefined;
      if (!mediaType) {
        const mime = file.mimetype;
        if (mime.startsWith('image/')) mediaType = 'image';
        else if (mime.startsWith('video/')) mediaType = 'video';
        else if (mime.startsWith('audio/')) mediaType = 'audio';
        else mediaType = 'document';
      }

      const result = await waClient.uploadMedia(file.buffer, file.originalname, file.mimetype, mediaType);

      res.json({ success: true, data: result });
    } catch (error: any) {
      if (error.response?.data) {
        const status = error.response.status || 500;
        res.status(status).json({ success: false, message: error.response.data?.error || error.response.data?.message || 'Upload failed' });
        return;
      }
      next(error);
    }
  }

  /**
   * Proxy media files from WA API to frontend.
   * 
   * WA API now requires X-API-Key header for /uploads/* paths.
   * Browser <img>/<video>/<audio> tags cannot send custom headers,
   * so we proxy through CRM backend which adds the auth header.
   * 
   * Auth: JWT token via query parameter (since HTML tags can't send headers).
   * SSRF protection: only allows URLs from the org's configured WA API origin.
   */
  async proxy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const url = req.query.url as string;

      if (!url) {
        res.status(400).json({ success: false, message: 'Missing url parameter' });
        return;
      }

      // Get org's WA API config
      const org = await prisma.organization.findUnique({
        where: { id: req.user!.organizationId },
        select: { wa_api_base_url: true, wa_api_key: true },
      });

      if (!org?.wa_api_base_url || !org?.wa_api_key) {
        res.status(400).json({ success: false, message: 'WA API not configured' });
        return;
      }

      // Resolve relative paths (e.g. /media/org-uuid/file.webp) to full URL using WA API origin
      let resolvedUrl = url;
      if (url.startsWith('/')) {
        try {
          resolvedUrl = new URL(url, org.wa_api_base_url).href;
        } catch {
          res.status(400).json({ success: false, message: 'Invalid relative URL' });
          return;
        }
      }

      // SSRF protection: only allow URLs from WA API origin
      let allowedOrigin: string;
      try {
        allowedOrigin = new URL(org.wa_api_base_url).origin;
      } catch {
        res.status(500).json({ success: false, message: 'Invalid WA API base URL in config' });
        return;
      }

      // Compare origins (resolve Docker URLs for both sides)
      let requestOrigin: string;
      try {
        requestOrigin = new URL(resolvedUrl).origin;
      } catch {
        res.status(400).json({ success: false, message: 'Invalid URL' });
        return;
      }

      if (requestOrigin !== allowedOrigin && resolveDockerUrl(requestOrigin) !== resolveDockerUrl(allowedOrigin)) {
        res.status(403).json({ success: false, message: 'URL not allowed — must be from WA API' });
        return;
      }

      // Fetch from WA API with auth header (resolve Docker URL for container networking)
      const fetchUrl = resolveDockerUrl(resolvedUrl);
      const response = await axios.get(fetchUrl, {
        headers: { 'X-API-Key': org.wa_api_key },
        responseType: 'stream',
        timeout: 30000,
      });

      // Forward content headers
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      res.set('Content-Type', contentType);

      if (response.headers['content-length']) {
        res.set('Content-Length', response.headers['content-length']);
      }

      // Cache in browser for 1 hour (private = only user's browser, not CDN)
      res.set('Cache-Control', 'private, max-age=3600');
      // Override helmet's CORP header so cross-origin <img>/<video>/<audio> can load
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');

      // Stream binary data to client
      response.data.pipe(res);
    } catch (error: any) {
      // Forward WA API error status if available
      if (error.response) {
        const status = error.response.status || 500;
        const message = status === 404
          ? 'Media file not found (may have been deleted)'
          : status === 401
            ? 'WA API authentication failed — check API key'
            : 'Failed to fetch media from WA API';
        res.status(status).json({ success: false, message });
        return;
      }

      // Network/timeout error
      if (error.code === 'ECONNABORTED') {
        res.status(504).json({ success: false, message: 'Media fetch timed out' });
        return;
      }

      next(error);
    }
  }
  /**
   * Public media proxy — no JWT required.
   * Used by <img>/<video>/<audio> tags which cannot send Authorization headers.
   * SSRF protection: only allows URLs whose origin matches WA API base URL.
   */
  async publicProxy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const url = req.query.url as string;

      if (!url) {
        res.status(400).json({ success: false, message: 'Missing url parameter' });
        return;
      }

      // Get first org's WA API config (single-tenant shortcut)
      const org = await prisma.organization.findFirst({
        where: { wa_api_base_url: { not: null }, wa_api_key: { not: null } },
        select: { wa_api_base_url: true, wa_api_key: true },
      });
      if (!org?.wa_api_base_url || !org?.wa_api_key) {
        res.status(400).json({ success: false, message: 'WA API not configured' });
        return;
      }

      // Resolve relative paths (e.g. /media/org-uuid/file.webp) to full URL using WA API origin
      let resolvedUrl = url;
      if (url.startsWith('/')) {
        try {
          resolvedUrl = new URL(url, org.wa_api_base_url).href;
        } catch {
          res.status(400).json({ success: false, message: 'Invalid relative URL' });
          return;
        }
      }

      // SSRF protection: only allow URLs from WA API origin
      let allowedOrigin: string;
      try {
        allowedOrigin = new URL(org.wa_api_base_url).origin;
      } catch {
        res.status(500).json({ success: false, message: 'Invalid WA API base URL in config' });
        return;
      }

      // Compare origins (resolve Docker URLs for both sides)
      let requestOrigin: string;
      try {
        requestOrigin = new URL(resolvedUrl).origin;
      } catch {
        res.status(400).json({ success: false, message: 'Invalid URL' });
        return;
      }

      if (requestOrigin !== allowedOrigin && resolveDockerUrl(requestOrigin) !== resolveDockerUrl(allowedOrigin)) {
        res.status(403).json({ success: false, message: 'URL not allowed' });
        return;
      }

      // Fetch from WA API with auth header (resolve Docker URL for container networking)
      const fetchUrl = resolveDockerUrl(resolvedUrl);
      const response = await axios.get(fetchUrl, {
        headers: { 'X-API-Key': org.wa_api_key },
        responseType: 'stream',
        timeout: 30000,
      });

      const contentType = response.headers['content-type'] || 'application/octet-stream';
      res.set('Content-Type', contentType);

      if (response.headers['content-length']) {
        res.set('Content-Length', response.headers['content-length']);
      }

      // Cache in browser for 24 hours
      res.set('Cache-Control', 'public, max-age=86400');
      // Override helmet's CORP header so cross-origin <img>/<video>/<audio> can load
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');

      response.data.pipe(res);
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status || 500;
        res.status(status).json({ success: false, message: 'Failed to fetch media' });
        return;
      }
      if (error.code === 'ECONNABORTED') {
        res.status(504).json({ success: false, message: 'Media fetch timed out' });
        return;
      }
      next(error);
    }
  }
}

export const mediaController = new MediaController();
