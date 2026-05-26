import 'dotenv/config';
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
import { webhookRoutes } from './routes/webhooks.js';
import { configRoutes } from './routes/config.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const logger = new Logger('Server');
const app = express();
const httpServer = createServer(app);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helmet mit entschaerften Einstellungen
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "ws:", "wss:", "data:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      connectSrc: ["'self'", "ws:", "wss:", "*"],
      imgSrc: ["'self'", "data:", "https:", "*"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "data:"],
      frameSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// WICHTIG: Overlay Assets MUESSEN auch unter /assets erreichbar sein
// weil Vite absolute Pfade generiert
const overlayDistPath = join(__dirname, '..', '..', 'overlay', 'dist');
app.use('/assets', express.static(join(overlayDistPath, 'assets')));
app.use('/overlay', express.static(overlayDistPath));

// Overlay root
app.get('/overlay', (_req, res) => {
  res.sendFile(join(overlayDistPath, 'index.html'));
});

// Data assets (Sounds, etc.)
app.use('/data-assets', express.static(join(__dirname, '..', '..', '..', 'data', 'assets')));

app.use('/api/donations', donationRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/api/config', configRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
new AlertServer(wss);

process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  httpServer.close(() => process.exit(0));
});

const PORT = parseInt(process.env.SERVER_PORT || '3000', 10);

httpServer.listen(PORT, () => {
  logger.info('=======================================');
  logger.info('🚀 Twitch Alert Engine gestartet!');
  logger.info(`📡 Server: http://localhost:${PORT}`);
  logger.info(`📡 WebSocket: ws://localhost:${PORT}/ws`);
  logger.info(`🎨 Overlay: http://localhost:${PORT}/overlay`);
  logger.info('=======================================');
});