import WebSocket from 'ws';
import axios from 'axios';
import { randomUUID } from 'crypto';

import { Logger } from '@twitch-alert/utils';
import type { AlertServer } from '../websocket/AlertServer.js';
import type {
    TwitchEventBase,
    ChannelFollowEvent,
    ChannelSubscribeEvent,
    ChannelSubscriptionGiftEvent,
    ChannelCheerEvent,
    ChannelRaidEvent,
    AlertData
} from '@twitch-alert/types';

type EventSubSubscriptionType =
    | 'channel.follow'
    | 'channel.subscribe'
    | 'channel.subscription.gift'
    | 'channel.cheer'
    | 'channel.raid'
    | 'channel.channel_points_custom_reward_redemption.add';

export class TwitchEventSubClient {
    private logger = new Logger('EventSub');
    private ws: WebSocket | null = null;
    private reconnectInterval: NodeJS.Timeout | null = null;
    private sessionId: string | null = null;
    private accessToken: string | null = null;
    private tokenExpiry: Date | null = null;

    constructor(private alertServer: AlertServer) { }

    async connect(): Promise<void> {
        try {
            // Hole App Access Token
            await this.authenticate();

            // Verbinde zu EventSub WebSocket
            this.ws = new WebSocket('wss://eventsub.wss.twitch.tv/ws');

            this.ws.on('open', () => {
                this.logger.info('Connected to Twitch EventSub');
            });

            this.ws.on('message', (data: Buffer) => {
                this.handleMessage(JSON.parse(data.toString()));
            });

            this.ws.on('close', () => {
                this.logger.warn('EventSub connection closed, reconnecting...');
                this.scheduleReconnect();
            });

            this.ws.on('error', (error) => {
                this.logger.error('EventSub error:', error);
            });

        } catch (error) {
            this.logger.error('Failed to connect:', error);
            this.scheduleReconnect();
        }
    }

    async disconnect(): Promise<void> {
        if (this.reconnectInterval) {
            clearTimeout(this.reconnectInterval);
        }
        if (this.ws) {
            this.ws.close();
        }
    }

    private async authenticate(): Promise<void> {
        const clientId = process.env.TWITCH_CLIENT_ID;
        const clientSecret = process.env.TWITCH_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error('TWITCH_CLIENT_ID oder TWITCH_CLIENT_SECRET fehlt');
        }

        // Prüfe ob Token noch gültig
        if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
            return;
        }

        try {
            const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
                params: {
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: 'client_credentials'
                }
            });

            this.accessToken = response.data.access_token;
            // Token läuft in response.data.expires_in Sekunden ab (ca. 60 Tage)
            this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);

            this.logger.info('Successfully authenticated with Twitch');
        } catch (error) {
            this.logger.error('Authentication failed:', error);
            throw error;
        }
    }

    private async handleMessage(message: any): Promise<void> {
        const { metadata, payload } = message;

        switch (metadata.message_type) {
            case 'session_welcome':
                this.sessionId = payload.session.id;
                this.logger.info(`Session ID: ${this.sessionId}`);
                await this.subscribeToEvents();
                break;

            case 'session_keepalive':
                this.logger.debug('Keepalive received');
                break;

            case 'notification':
                await this.handleNotification(payload);
                break;

            case 'session_reconnect':
                this.logger.info('Reconnect required');
                this.reconnect(payload.session.reconnect_url);
                break;

            case 'revocation':
                this.logger.warn(`Subscription revoked: ${payload.subscription.type}`);
                break;

            default:
                this.logger.debug('Unknown message type:', metadata.message_type);
        }
    }

    private async subscribeToEvents(): Promise<void> {
        const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
        if (!broadcasterId) {
            throw new Error('TWITCH_BROADCASTER_ID fehlt');
        }

        const subscriptions: EventSubSubscriptionType[] = [
            'channel.follow',
            'channel.subscribe',
            'channel.subscription.gift',
            'channel.cheer',
            'channel.raid'
        ];

        for (const type of subscriptions) {
            try {
                await this.createSubscription(type, broadcasterId);
                this.logger.info(`Subscribed to ${type}`);
            } catch (error) {
                this.logger.error(`Failed to subscribe to ${type}:`, error);
            }
        }
    }

    private async createSubscription(
        type: EventSubSubscriptionType,
        broadcasterId: string
    ): Promise<void> {
        const response = await axios.post(
            'https://api.twitch.tv/helix/eventsub/subscriptions',
            {
                type,
                version: '1',
                condition: {
                    broadcaster_user_id: broadcasterId,
                    // Für 'channel.raid' braucht es 'to_broadcaster_user_id'
                    ...(type === 'channel.raid' ? { to_broadcaster_user_id: broadcasterId } : {})
                },
                transport: {
                    method: 'websocket',
                    session_id: this.sessionId
                }
            },
            {
                headers: {
                    'Client-Id': process.env.TWITCH_CLIENT_ID!,
                    'Authorization': `Bearer ${this.accessToken!}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.status === 202) {
            this.logger.debug(`Subscription ${type} created`);
        }
    }

    private async handleNotification(payload: TwitchEventBase): Promise<void> {
        const { subscription, event } = payload;

        this.logger.info(`Received ${subscription.type} event`);

        switch (subscription.type) {
            case 'channel.follow':
                await this.handleFollowEvent(event as ChannelFollowEvent);
                break;
            case 'channel.subscribe':
                await this.handleSubscribeEvent(event as ChannelSubscribeEvent);
                break;
            case 'channel.subscription.gift':
                await this.handleSubscriptionGiftEvent(event as ChannelSubscriptionGiftEvent);
                break;
            case 'channel.cheer':
                await this.handleCheerEvent(event as ChannelCheerEvent);
                break;
            case 'channel.raid':
                await this.handleRaidEvent(event as ChannelRaidEvent);
                break;
        }
    }

    private async handleFollowEvent(event: ChannelFollowEvent): Promise<void> {
        const alert: AlertData = {
            id: randomUUID(),
            type: 'follow',
            timestamp: new Date().toISOString(),
            user: {
                id: event.user_id,
                name: event.user_login,
                displayName: event.user_name
            }
        };

        await this.alertServer.triggerAlert(alert);
    }

    private async handleSubscribeEvent(event: ChannelSubscribeEvent): Promise<void> {
        const alert: AlertData = {
            id: randomUUID(),
            type: 'subscribe',
            timestamp: new Date().toISOString(),
            user: {
                id: event.user_id,
                name: event.user_login,
                displayName: event.user_name
            },
            tier: event.tier
        };

        await this.alertServer.triggerAlert(alert);
    }

    private async handleSubscriptionGiftEvent(event: ChannelSubscriptionGiftEvent): Promise<void> {
        const alert: AlertData = {
            id: randomUUID(),
            type: 'sub_gift',
            timestamp: new Date().toISOString(),
            user: {
                id: event.user_id,
                name: event.user_login,
                displayName: event.user_name
            },
            amount: event.total,
            tier: event.tier,
            cumulative: event.cumulative_total || undefined
        };

        await this.alertServer.triggerAlert(alert);
    }

    private async handleCheerEvent(event: ChannelCheerEvent): Promise<void> {
        const alert: AlertData = {
            id: randomUUID(),
            type: 'cheer',
            timestamp: new Date().toISOString(),
            user: {
                id: event.user_id || 'anonymous',
                name: event.user_login || 'anonymous',
                displayName: event.user_name || 'Anonymous'
            },
            amount: event.bits,
            message: event.message
        };

        await this.alertServer.triggerAlert(alert);
    }

    private async handleRaidEvent(event: ChannelRaidEvent): Promise<void> {
        const alert: AlertData = {
            id: randomUUID(),
            type: 'raid',
            timestamp: new Date().toISOString(),
            user: {
                id: event.from_broadcaster_user_id,
                name: event.from_broadcaster_user_login,
                displayName: event.from_broadcaster_user_name
            },
            viewers: event.viewers
        };

        await this.alertServer.triggerAlert(alert);
    }

    private reconnect(url: string): void {
        this.ws?.close();
        this.ws = new WebSocket(url);
        // Re-attach event handlers...
    }

    private scheduleReconnect(): void {
        this.reconnectInterval = setTimeout(() => {
            this.connect();
        }, 5000);
    }
}
