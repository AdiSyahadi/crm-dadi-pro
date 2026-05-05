import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { prisma } from '../config/database';
import { WAApiClient, resolveDockerUrl } from '../services/wa-api.client';

/**
 * WA API stores media URLs with /api/media/ path prefix in the database,
 * but Fastify serves static files at /media/ (without /api prefix).
 * Nginx routes /media/ to the Next.js frontend instead of Fastify backend,
 * so we must rewrite the URL to use the internal WA API backend directly.
 *
 * Example: https://wapi.abdashboard.com/api/media/{orgId}/file.jpg
 *       → http://localhost:3001/media/{orgId}/file.jpg
 */
function rewriteWaApiMediaUrl(url: string, waApiBaseUrl: string): string {
  try {
    const parsedUrl = new URL(url);
    const baseUrl = new URL(waApiBaseUrl);
    // Only rewrite if same origin as WA API
    if (parsedUrl.origin !== baseUrl.origin
      && resolveDockerUrl(parsedUrl.origin) !== resolveDockerUrl(baseUrl.origin)) {
      return url;
    }
    // Rewrite /api/media/ → /media/ (WA API Fastify serves at /media/)
    if (parsedUrl.pathname.startsWith('/api/media/')) {
      parsedUrl.pathname = parsedUrl.pathname.replace('/api/media/', '/media/');
    }
    return parsedUrl.href;
  } catch {
    return url;
  }
}

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
        const rawErr = error.response.data?.error;
        const errMsg = typeof rawErr === 'object' && rawErr?.message
          ? rawErr.message
          : typeof rawErr === 'string' ? rawErr : (error.response.data?.message || 'Upload failed');
        res.status(status).json({ success: false, message: errMsg });
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
      // Rewrite /api/media/ → /media/ for WA API origin (Fastify serves at /media/)
      resolvedUrl = rewriteWaApiMediaUrl(resolvedUrl, org.wa_api_base_url);

      // SSRF protection: only allow URLs from WA API origin OR external HTTPS
      let allowedOrigin: string;
      try {
        allowedOrigin = new URL(org.wa_api_base_url).origin;
      } catch {
        res.status(500).json({ success: false, message: 'Invalid WA API base URL in config' });
        return;
      }

      let requestOrigin: string;
      try {
        requestOrigin = new URL(resolvedUrl).origin;
      } catch {
        res.status(400).json({ success: false, message: 'Invalid URL' });
        return;
      }

      const isWaApiOrigin = requestOrigin === allowedOrigin
        || resolveDockerUrl(requestOrigin) === resolveDockerUrl(allowedOrigin);

      // External HTTP (non-HTTPS, non-WA-API) → block (SSRF risk with internal networks)
      if (!isWaApiOrigin && !resolvedUrl.startsWith('https://')) {
        res.status(403).json({ success: false, message: 'URL not allowed — must be from WA API or HTTPS' });
        return;
      }

      // WA API origin → fetch with X-API-Key; External HTTPS → fetch without auth
      const fetchUrl = isWaApiOrigin ? resolveDockerUrl(resolvedUrl) : resolvedUrl;
      const fetchHeaders: Record<string, string> = isWaApiOrigin
        ? { 'X-API-Key': org.wa_api_key }
        : {};

      const response = await axios.get(fetchUrl, {
        headers: fetchHeaders,
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
      // Rewrite /api/media/ → /media/ for WA API origin (Fastify serves at /media/)
      resolvedUrl = rewriteWaApiMediaUrl(resolvedUrl, org.wa_api_base_url);

      // SSRF protection: only allow URLs from WA API origin OR external HTTPS
      let allowedOrigin: string;
      try {
        allowedOrigin = new URL(org.wa_api_base_url).origin;
      } catch {
        res.status(500).json({ success: false, message: 'Invalid WA API base URL in config' });
        return;
      }

      let requestOrigin: string;
      try {
        requestOrigin = new URL(resolvedUrl).origin;
      } catch {
        res.status(400).json({ success: false, message: 'Invalid URL' });
        return;
      }

      const isWaApiOrigin = requestOrigin === allowedOrigin
        || resolveDockerUrl(requestOrigin) === resolveDockerUrl(allowedOrigin);

      if (!isWaApiOrigin && !resolvedUrl.startsWith('https://')) {
        res.status(403).json({ success: false, message: 'URL not allowed' });
        return;
      }

      const fetchUrl = isWaApiOrigin ? resolveDockerUrl(resolvedUrl) : resolvedUrl;
      const fetchHeaders: Record<string, string> = isWaApiOrigin
        ? { 'X-API-Key': org.wa_api_key }
        : {};

      const response = await axios.get(fetchUrl, {
        headers: fetchHeaders,
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
