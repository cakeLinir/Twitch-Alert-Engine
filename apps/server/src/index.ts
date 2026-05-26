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

const logger = new Logger('Server');
const app = express();
const httpServer = createServer(app);

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://hundekuchenlive.de']
    : '*',
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

app.use('/assets', express.static('../../data/assets'));
app.use('/overlay', express.static('../overlay/dist'));

app.use('/api/donations', donationRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/api/config', configRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString()
  });
});

const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
new AlertServer(wss);

process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  httpServer.close(() => {
    logger.exit(0);
  });
});

const PORT = parseInt(process.env.SERVER_PORT || '3000', 10);

httpServer.listen(PORT, () => {
  logger.info('=======================================');
  logger.info('🚀 Twitch Alert Engine gestartet!');
  logger.info('=======================================');
  logger.info(`📡 Server: http://localhost:${PORT}`);
  logger.info(`📡 WebSocket: ws://localhost:${PORT}/ws`);
  logger.info(`🎨 Overlay: http://localhost:${PORT}/overlay`);
  logger.info('=======================================');
});
