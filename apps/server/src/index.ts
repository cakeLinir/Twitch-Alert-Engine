import Fastify from 'fastify';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { WebSocketServer } from './websocket/server.js';
import { overlayRoutes } from './routes/overlay.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const fastify = Fastify({
        logger: {
            level: 'info',
            transport: {
                target: 'pino-pretty',
                options: { colorize: true }
            }
        }
    });

    // Plugins
    await fastify.register(cors, { origin: env.CORS_ORIGIN });

    // Statische Assets (Soundfiles, Bilder)
    await fastify.register(staticPlugin, {
        root: path.resolve(__dirname, env.STATIC_PATH),
        prefix: '/assets/',
    });

    // WebSocket Server
    const wsServer = new WebSocketServer(fastify);
    await wsServer.register();

    // Routes
    await fastify.register(overlayRoutes);

    // Server starten
    const address = await fastify.listen({
        port: parseInt(env.PORT),
        host: env.HOST
    });

    console.log(`
🎬 OBS WebSocket Server läuft

📍 WebSocket:   ws://localhost:${env.PORT}/ws
🎨 Overlay URL: http://localhost:${env.PORT}/overlay
💓 Health:      http://localhost:${env.PORT}/health
📁 Assets:      http://localhost:${env.PORT}/assets/

🔧 OBS Browser-Source einrichten:
   URL: http://localhost:${env.PORT}/overlay
   Breite: 1920, Höhe: 1080
   CSS: Body { background-color: rgba(0, 0, 0, 0); }
  `);

    // Graceful Shutdown
    process.on('SIGINT', async () => {
        await fastify.close();
        process.exit(0);
    });
}

main().catch(console.error);
