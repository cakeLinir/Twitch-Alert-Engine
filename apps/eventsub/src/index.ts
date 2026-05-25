import { TwitchEventSubClient } from './twitch/client.js';
import { EventHandlers } from './twitch/handlers.js';
import { WebSocketBroadcaster } from './websocket/broadcaster.js';
import { env } from './config/env.js';

async function main() {
    console.log('🚀 Twitch EventSub Service startet...');

    // Verbindung zum OBS-WebSocket-Server
    const broadcaster = new WebSocketBroadcaster(env.WSS_SERVER_URL);
    await broadcaster.connect();

    // Twitch EventSub
    const twitchClient = new TwitchEventSubClient();
    await twitchClient.start();

    // Handler registrieren
    const handlers = new EventHandlers(
        twitchClient.getListener(),
        broadcaster,
        env.TWITCH_BROADCASTER_ID
    );
    handlers.register();

    // Graceful Shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Beende Service...');
        broadcaster.disconnect();
        await twitchClient.stop();
        process.exit(0);
    });

    console.log('✅ Twitch EventSub Service läuft');
}

main().catch(console.error);
