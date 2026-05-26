import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { Logger } from '@twitch-alert/utils';
import { AlertServer } from './websocket/AlertServer.js';
import { TwitchEventSubClient } from './twitch/EventSubClient.js';
import { donationRoutes } from './routes/donations.js';
import { configRoutes } from './routes/config.js';
import { webhookRoutes } from './routes/webhooks.js';

const logger = new Logger('Server');
const app = express();
const httpServer = createServer(app);

// Basic middleware
app.use(helmet());
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://hundekuchenlive.de', 'https://streamelements.com']
        : '*',
    credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 Minuten
    max: 100, // Limit pro IP
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Routes
app.use('/api/donations', donationRoutes);
app.use('/api/config', configRoutes);
app.use('/webhooks', webhookRoutes); // Stripe & PayPal webhooks

// Static files für Overlay Assets
app.use('/assets', express.static('../../data/assets'));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket Server
const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws'
});

const alertServer = new AlertServer(wss);
const twitchClient = new TwitchEventSubClient(alertServer);

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    await twitchClient.disconnect();
    httpServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

const PORT = parseInt(process.env.SERVER_PORT || '3000', 10);

httpServer.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws`);
    logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);

    // Start Twitch EventSub connection
    twitchClient.connect().catch(err => {
        logger.error('Failed to connect to Twitch EventSub:', err);
    });
});
