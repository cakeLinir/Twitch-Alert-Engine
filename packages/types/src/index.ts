// ============================================
// TWITCH EVENTSUB EVENTS
// ============================================

export interface TwitchEventBase {
    subscription: {
        id: string;
        status: string;
        type: string;
        version: string;
        cost: number;
        condition: Record<string, unknown>;
        transport: {
            method: string;
            session_id?: string;
        };
        created_at: string;
    };
    event: Record<string, unknown>;
}

export interface ChannelFollowEvent {
    user_id: string;
    user_login: string;
    user_name: string;
    broadcaster_user_id: string;
    broadcaster_user_login: string;
    broadcaster_user_name: string;
    followed_at: string;
}

export interface ChannelSubscribeEvent {
    user_id: string;
    user_login: string;
    user_name: string;
    broadcaster_user_id: string;
    broadcaster_user_login: string;
    broadcaster_user_name: string;
    tier: '1000' | '2000' | '3000';
    is_gift: boolean;
}

export interface ChannelSubscriptionGiftEvent {
    user_id: string;
    user_login: string;
    user_name: string;
    broadcaster_user_id: string;
    broadcaster_user_login: string;
    broadcaster_user_name: string;
    total: number;
    tier: '1000' | '2000' | '3000';
    cumulative_total: number | null;
    is_anonymous: boolean;
}

export interface ChannelCheerEvent {
    is_anonymous: boolean;
    user_id: string | null;
    user_login: string | null;
    user_name: string | null;
    broadcaster_user_id: string;
    broadcaster_user_login: string;
    broadcaster_user_name: string;
    message: string;
    bits: number;
}

export interface ChannelRaidEvent {
    from_broadcaster_user_id: string;
    from_broadcaster_user_login: string;
    from_broadcaster_user_name: string;
    to_broadcaster_user_id: string;
    to_broadcaster_user_login: string;
    to_broadcaster_user_name: string;
    viewers: number;
}

// ============================================
// ALERT TYPES
// ============================================

export type AlertType = 'follow' | 'subscribe' | 'sub_gift' | 'cheer' | 'raid' | 'donation' | 'host';

export interface AlertData {
    id: string;
    type: AlertType;
    timestamp: string;
    user: {
        id?: string;
        name: string;
        displayName: string;
        avatar?: string;
    };
    amount?: number;
    message?: string;
    tier?: string;
    viewers?: number;
    cumulative?: number;
    metadata?: Record<string, unknown>;
}

export interface AlertConfig {
    duration: number;           // Dauer in Millisekunden
    animation: string;          // CSS Animation Name
    sound: string;              // Sound-Datei Name
    template: string;           // HTML Template Name
    position: 'top' | 'center' | 'bottom';
    customCSS?: string;
}

// ============================================
// WEBSOCKET MESSAGES
// ============================================

export interface ServerToClientEvents {
    'alert:trigger': (alert: AlertData) => void;
    'alert:queue': (queue: AlertData[]) => void;
    'connection:established': (data: { clientId: string }) => void;
    'stats:update': (stats: StreamStats) => void;
}

export interface ClientToServerEvents {
    'alert:complete': (alertId: string) => void;
    'alert:skip': (alertId: string) => void;
    'test:trigger': (type: AlertType) => void;
}

export interface StreamStats {
    followCount: number;
    subCount: number;
    cheerCount: number;
    donationTotal: number;
    viewerCount: number;
}

// ============================================
// DONATION TYPES
// ============================================

export interface DonationData {
    id: string;
    provider: 'stripe' | 'paypal';
    amount: number;
    currency: string;
    donorName: string;
    donorEmail?: string;
    message?: string;
    isAnonymous: boolean;
    timestamp: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    metadata?: Record<string, unknown>;
}

export interface DonationPageConfig {
    streamerName: string;
    streamerAvatar?: string;
    minAmount: number;
    suggestedAmounts: number[];
    currency: string;
    messageEnabled: boolean;
    messageMaxLength: number;
    thankYouMessage: string;
}

// ============================================
// THEME TYPES
// ============================================

export interface AlertTheme {
    id: string;
    name: string;
    version: string;
    author: string;
    variables: Record<string, string>;
    fonts: string[];
    previewImage?: string;
}

export interface ThemeManifest {
    themes: AlertTheme[];
    defaultTheme: string;
}
