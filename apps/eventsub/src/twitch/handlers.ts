import { EventSubWsListener } from '@twurple/eventsub-ws';
import { type AlertPayload } from '@hundekuchenlive/shared';
import { WebSocketBroadcaster } from '../websocket/broadcaster.js';
import { EventSubChannelSubscriptionMessageEvent } from '@twurple/eventsub-base';

export class EventHandlers {
    constructor(
        private listener: EventSubWsListener,
        private broadcaster: WebSocketBroadcaster,
        private broadcasterId: string
    ) { }

    register(): void {
        this.registerFollows();
        this.registerSubscriptions();
        this.registerCheers();
        this.registerRaids();
        this.registerResubs();

        console.log('[Twitch] Alle Event-Handler registriert');
    }

    private registerFollows(): void {
        this.listener.onChannelFollow(this.broadcasterId, this.broadcasterId, (e) => {
            const alert: AlertPayload = {
                id: `follow-${e.userId}-${Date.now()}`,
                timestamp: Date.now(),
                type: 'channel.follow',
                userName: e.userName,
                userId: e.userId,
            };

            console.log(`[Twitch] Follow: ${e.userName}`);
            this.broadcaster.broadcast('alert:trigger', alert);
        });
    }

    private registerSubscriptions(): void {
        // Neue Subs
        this.listener.onChannelSubscription(this.broadcasterId, (e) => {
            const alert: AlertPayload = {
                id: `sub-${e.userId}-${Date.now()}`,
                timestamp: Date.now(),
                type: 'channel.subscribe',
                userName: e.userName,
                userId: e.userId,
                tier: e.tier as '1000' | '2000' | '3000',
                isGift: e.isGift,
            };

            console.log(`[Twitch] Sub: ${e.userName} (Tier ${e.tier})`);
            this.broadcaster.broadcast('alert:trigger', alert);
        });

        // Gift Subs
        this.listener.onChannelSubscriptionGift(this.broadcasterId, (e) => {
            const alert: AlertPayload = {
                id: `subgift-${e.gifterId}-${Date.now()}`,
                timestamp: Date.now(),
                type: 'channel.subscription.gift',
                userName: e.gifterName || 'Anonymous',
                userId: e.gifterId || 'anonymous',
                tier: e.tier as '1000' | '2000' | '3000',
                isGift: true,
            } as AlertPayload;

            console.log(`[Twitch] Gift Sub: ${e.gifterName} hat ${e.amount}x Tier ${e.tier} verschenkt`);
            this.broadcaster.broadcast('alert:trigger', alert);
        });
    }

    private registerCheers(): void {
        this.listener.onChannelCheer(this.broadcasterId, (e) => {
            const alert: AlertPayload = {
                id: `cheer-${e.userId}-${Date.now()}`,
                timestamp: Date.now(),
                type: 'channel.cheer',
                userName: e.userName || 'Anonymous',
                message: e.message,
                bits: e.bits,
            };

            console.log(`[Twitch] Cheer: ${e.userName} - ${e.bits} Bits`);
            this.broadcaster.broadcast('alert:trigger', alert);
        });
    }

    private registerRaids(): void {
        this.listener.onChannelRaidFrom(this.broadcasterId, (e) => {
            const alert: AlertPayload = {
                id: `raid-${e.raidingBroadcasterId}-${Date.now()}`,
                timestamp: Date.now(),
                type: 'channel.raid',
                fromBroadcasterName: e.raidingBroadcasterName,
                fromBroadcasterId: e.raidingBroadcasterId,
                viewers: e.viewers,
            };

            console.log(`[Twitch] Raid: ${e.raidingBroadcasterName} mit ${e.viewers} Viewern`);
            this.broadcaster.broadcast('alert:trigger', alert);
        });
    }

    private registerResubs(): void {
        this.listener.onChannelResub(this.broadcasterId, (e) => {
            const alert: AlertPayload = {
                id: `resub-${e.userId}-${Date.now()}`,
                timestamp: Date.now(),
                type: 'channel.resub',
                userName: e.userName,
                userId: e.userId,
                tier: e.tier as '1000' | '2000' | '3000',
                isGift: e.isGift,
            };

            console.log(`[Twitch] Resub: ${e.userName} (Tier ${e.tier})`);
            this.broadcaster.broadcast('alert:trigger', alert);
        });
    }
}
