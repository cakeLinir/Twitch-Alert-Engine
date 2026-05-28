import 'dotenv/config';
import { config } from 'dotenv';
import { resolve } from 'path';
import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { Logger } from '@twitch-alert/utils';
import { AlertServer } from './websocket/AlertServer.js';
import { donationRoutes } from './routes/donations.js';
import { createWebhookRoutes } from './routes/webhooks.js';
import { configRoutes } from './routes/config.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '..', '..', '..', '.env') });

console.log('STRIPE_WEBHOOK_SECRET geladen:',
  process.env.STRIPE_WEBHOOK_SECRET ? '✅ JA' : '❌ NEIN'
);

const logger = new Logger('Server');
const app = express();
const httpServer = createServer(app);

// WebSocket + AlertServer
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
const alertServer = new AlertServer(wss); // Referenz speichern!

// Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "ws:", "wss:", "data:", "blob:"],
      scriptSrc: [
        "'self'", "'unsafe-inline'", "'unsafe-eval'",
        "https://js.stripe.com",
        "https://www.paypal.com",        // ← NEU
        "https://www.paypalobjects.com"  // ← NEU
      ],
      connectSrc: [
        "'self'", "ws:", "wss:", "*",
        "https://api.stripe.com",
        "https://www.paypal.com",        // ← NEU
        "https://api.sandbox.paypal.com" // ← NEU
      ],
      imgSrc: ["'self'", "data:", "https:", "*"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "data:"],
      frameSrc: [
        "'self'",
        "https://js.stripe.com",
        "https://hooks.stripe.com",
        "https://www.paypal.com",        // ← NEU
        "https://www.sandbox.paypal.com" // ← NEU
      ]
    }
  },
  crossOriginEmbedderPolicy: false
}));


app.use(cors({ origin: '*' }));
app.use(morgan('dev'));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// ⚠️ Webhook-Route VOR express.json() registrieren (Stripe braucht raw body)
app.use('/webhooks', createWebhookRoutes(alertServer));

// JSON-Parser für alle anderen Routen
app.use(express.json());

// Static Files
const overlayDistPath = join(__dirname, '..', '..', 'overlay', 'dist');
app.use('/assets', express.static(join(overlayDistPath, 'assets')));
app.use('/overlay', express.static(overlayDistPath));
app.get('/overlay', (_req: Request, res: Response) => {
  res.sendFile(join(overlayDistPath, 'index.html'));
});

// Donation Page
const donationDistPath = join(__dirname, '..', '..', 'donation-page', 'dist');
app.use('/donate', express.static(donationDistPath));
app.get('/donate', (_req: Request, res: Response) => {
  res.sendFile(join(donationDistPath, 'index.html'));
});

// Data Assets
app.use('/data-assets', express.static(join(__dirname, '..', '..', '..', 'data', 'assets')));

// API Routes
app.use('/api/donations', donationRoutes);
app.use('/api/config', configRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  httpServer.close(() => process.exit(0));
});

const PORT = parseInt(process.env.SERVER_PORT || '3000', 10);
httpServer.listen(PORT, () => {
  logger.info('=======================================');
  logger.info('🚀 Twitch Alert Engine gestartet!');
  logger.info(`📡 Server:   http://localhost:${PORT}`);
  logger.info(`📡 WebSocket: ws://localhost:${PORT}/ws`);
  logger.info(`🎨 Overlay:  http://localhost:${PORT}/overlay`);
  logger.info(`💰 Donate:   http://localhost:${PORT}/donate`);
  logger.info('=======================================');
});
