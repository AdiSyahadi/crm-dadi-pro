import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'path';
import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import routes from './routes';
import { trackedLinkService } from './services/tracked-link.service';

const app = express();

// Disable ETag to prevent stale 304 responses
app.set('etag', false);

// Security
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);

    if (env.isDev) {
      // In development, allow any localhost or 127.0.0.1 origin (any port)
      if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
        return callback(null, true);
      }
    }

    // In production, allow configured frontend URL and its localhost/127.0.0.1 equivalent
    const allowed = [
      env.FRONTEND_URL,
      env.FRONTEND_URL.replace('://localhost', '://127.0.0.1'),
      env.FRONTEND_URL.replace('://127.0.0.1', '://localhost'),
    ];
    if (allowed.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging
if (env.isDev) {
  app.use(morgan('dev'));
}

// Compression
app.use(compression());

// Serve uploaded files (payment proofs, etc.)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Public tracked link redirect (no auth)
app.get('/t/:code', async (req, res) => {
  try {
    const redirectUrl = await trackedLinkService.recordClick(req.params.code as string);
    if (!redirectUrl) {
      res.status(404).send('Link not found or expired');
      return;
    }
    res.redirect(302, redirectUrl);
  } catch {
    res.status(500).send('Internal server error');
  }
});

// API Routes
app.use('/api', routes);

// Error handler (must be last)
app.use(errorHandler);

export default app;
