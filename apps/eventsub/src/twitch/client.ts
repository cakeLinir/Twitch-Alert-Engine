import { ApiClient } from '@twurple/api';
import { AppTokenAuthProvider } from '@twurple/auth';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import { env } from '../config/env.js';

export class TwitchEventSubClient {
    private apiClient: ApiClient;
    public listener: EventSubWsListener;

    constructor() {
        // App-Token Auth (keine User-Login nötig für öffentliche Events)
        const authProvider = new AppTokenAuthProvider(
            env.TWITCH_CLIENT_ID,
            env.TWITCH_CLIENT_SECRET
        );

        this.apiClient = new ApiClient({ authProvider });
        this.listener = new EventSubWsListener({ apiClient: this.apiClient });
    }

    async start(): Promise<void> {
        await this.listener.start();
        console.log('[Twitch] EventSub WebSocket Listener gestartet');
    }

    async stop(): Promise<void> {
        await this.listener.stop();
        console.log('[Twitch] EventSub WebSocket Listener gestoppt');
    }

    getListener(): EventSubWsListener {
        return this.listener;
    }
}
