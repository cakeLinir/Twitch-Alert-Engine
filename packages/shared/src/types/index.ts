// Event-Typen von Twitch EventSub
export type TwitchEventType =
    | 'channel.follow'
    | 'channel.subscribe'
    | 'channel.subscription.gift'
    | 'channel.cheer'
    | 'channel.raid'
    | 'channel.ban'; // falls benötigt

export interface BaseAlertPayload {
    id: string;
    timestamp: number;
    type: TwitchEventType;
}

export interface FollowAlert extends BaseAlertPayload {
    type: 'channel.follow';
    userName: string;
    userId: string;
}

export interface SubscribeAlert extends BaseAlertPayload {
    type: 'channel.subscribe';
    userName: string;
    userId: string;
    tier: '1000' | '2000' | '3000';
    isGift: boolean;
}

export interface CheerAlert extends BaseAlertPayload {
    type: 'channel.cheer';
    userName: string;
    message: string;
    bits: number;
}

export interface RaidAlert extends BaseAlertPayload {
    type: 'channel.raid';
    fromBroadcasterName: string;
    fromBroadcasterId: string;
    viewers: number;
}

export type AlertPayload = FollowAlert | SubscribeAlert | CheerAlert | RaidAlert;

// WebSocket Nachrichtenformat für OBS-Overlay
export interface ServerToClientEvents {
    'alert:trigger': (payload: AlertPayload) => void;
    'connection:ping': () => void;
}

export interface ClientToServerEvents {
    'client:ready': () => void;
    'alert:complete': (alertId: string) => void;
}

// Konfiguration
export interface AlertConfig {
    type: TwitchEventType;
    duration: number; // ms
    soundFile?: string;
    animationIn: string;
    animationOut: string;
    template: string; // HTML-Template-Name
}
