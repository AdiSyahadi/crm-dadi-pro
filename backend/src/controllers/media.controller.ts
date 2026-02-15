import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { prisma } from '../config/database';

export class MediaController {
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

      // SSRF protection: only allow URLs from WA API origin
      let allowedOrigin: string;
      try {
        allowedOrigin = new URL(org.wa_api_base_url).origin;
      } catch {
        res.status(500).json({ success: false, message: 'Invalid WA API base URL in config' });
        return;
      }

      if (!url.startsWith(allowedOrigin)) {
        res.status(403).json({ success: false, message: 'URL not allowed — must be from WA API' });
        return;
      }

      // Fetch from WA API with auth header
      const response = await axios.get(url, {
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

      // SSRF protection: only allow URLs from WA API origin
      let allowedOrigin: string;
      try {
        allowedOrigin = new URL(org.wa_api_base_url).origin;
      } catch {
        res.status(500).json({ success: false, message: 'Invalid WA API base URL in config' });
        return;
      }

      if (!url.startsWith(allowedOrigin)) {
        res.status(403).json({ success: false, message: 'URL not allowed' });
        return;
      }

      // Fetch from WA API with auth header
      const response = await axios.get(url, {
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
