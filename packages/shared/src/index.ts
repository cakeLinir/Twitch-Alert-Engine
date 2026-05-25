export const ALERT_PRIORITIES = {
    donation: 100,
    raid: 90,
    gift_sub: 80,
    prime_sub: 75,
    resub: 72,
    sub: 70,
    cheer: 60,
    channel_points: 50,
    follow: 30,
    chat_highlight: 20,
    test: 10
} as const;

export type AlertType = keyof typeof ALERT_PRIORITIES;

export type AlertSource =
    | "dashboard_test"
    | "twitch_eventsub"
    | "twitch_chat"
    | "paypal_webhook"
    | "system";

export type AlertAssetMediaType = "image" | "video";

export interface AlertMediaAsset {
    fileName: string;
    url: string;
    mediaType: AlertAssetMediaType;
    extension: string;
}

export interface AlertSoundAsset {
    fileName: string;
    url: string;
    extension: string;
    volume: number;
    startDelayMs: number;
}

export interface AlertAssetManifestItem {
    type: AlertType;
    label: string;
    priority: number;
    expectedBaseName: string;
    expectedSoundBaseName: string;
    candidateBaseNames: string[];
    candidateSoundBaseNames: string[];
    availableAssets: AlertMediaAsset[];
    availableSoundAssets: AlertSoundAsset[];
    resolvedAsset?: AlertMediaAsset;
    resolvedSound?: AlertSoundAsset;
    missing: boolean;
    soundMissing: boolean;
}

export interface AlertAssetManifestResponse {
    generatedAt: string;
    assetRootPath: string;
    items: AlertAssetManifestItem[];
}

export interface AlertDefinition {
    type: AlertType;
    label: string;
    description: string;
    priority: number;
    defaultDurationMs: number;
    defaultMessage: string;
    accent: "cyan" | "purple" | "green" | "yellow" | "red" | "blue";
    assetBaseName: string;
    soundBaseName: string;
    defaultSoundVolume: number;
    soundStartDelayMs: number;
}

export const ALERT_DEFINITIONS: AlertDefinition[] = [
    {
        type: "donation",
        label: "Donation",
        description: "PayPal-Support oder Donation-Event.",
        priority: ALERT_PRIORITIES.donation,
        defaultDurationMs: 7000,
        defaultMessage: "Danke für deine Unterstützung!",
        accent: "green",
        assetBaseName: "Alert_Donation",
        soundBaseName: "Sound_Donation",
        defaultSoundVolume: 0.85,
        soundStartDelayMs: 0
    },
    {
        type: "raid",
        label: "Raid",
        description: "Ein anderer Streamer raidet deinen Kanal.",
        priority: ALERT_PRIORITIES.raid,
        defaultDurationMs: 6500,
        defaultMessage: "Willkommen an alle Raider!",
        accent: "red",
        assetBaseName: "Alert_Raid",
        soundBaseName: "Sound_Raid",
        defaultSoundVolume: 0.9,
        soundStartDelayMs: 0
    },
    {
        type: "gift_sub",
        label: "Gift Sub",
        description: "Ein Zuschauer verschenkt ein Abo.",
        priority: ALERT_PRIORITIES.gift_sub,
        defaultDurationMs: 6500,
        defaultMessage: "Danke für den Gift Sub!",
        accent: "purple",
        assetBaseName: "Alert_GiftSub",
        soundBaseName: "Sound_GiftSub",
        defaultSoundVolume: 0.85,
        soundStartDelayMs: 0
    },
    {
        type: "prime_sub",
        label: "Prime Sub",
        description: "Ein Zuschauer nutzt Prime Subscription.",
        priority: ALERT_PRIORITIES.prime_sub,
        defaultDurationMs: 6500,
        defaultMessage: "Danke für deinen Prime Sub!",
        accent: "purple",
        assetBaseName: "Alert_PrimeSub",
        soundBaseName: "Sound_PrimeSub",
        defaultSoundVolume: 0.85,
        soundStartDelayMs: 0
    },
    {
        type: "resub",
        label: "ReSub",
        description: "Ein Zuschauer verlängert sein Abo.",
        priority: ALERT_PRIORITIES.resub,
        defaultDurationMs: 6500,
        defaultMessage: "Danke für deinen ReSub!",
        accent: "purple",
        assetBaseName: "Alert_ReSub",
        soundBaseName: "Sound_ReSub",
        defaultSoundVolume: 0.85,
        soundStartDelayMs: 0
    },
    {
        type: "sub",
        label: "Subscriber",
        description: "Ein Zuschauer abonniert deinen Kanal.",
        priority: ALERT_PRIORITIES.sub,
        defaultDurationMs: 6000,
        defaultMessage: "Danke für deinen Sub!",
        accent: "purple",
        assetBaseName: "Alert_Subscriber",
        soundBaseName: "Sound_Subscriber",
        defaultSoundVolume: 0.85,
        soundStartDelayMs: 0
    },
    {
        type: "cheer",
        label: "Bits / Cheer",
        description: "Ein Zuschauer sendet Bits.",
        priority: ALERT_PRIORITIES.cheer,
        defaultDurationMs: 5500,
        defaultMessage: "Danke für die Bits!",
        accent: "yellow",
        assetBaseName: "Alert_Bits",
        soundBaseName: "Sound_Bits",
        defaultSoundVolume: 0.8,
        soundStartDelayMs: 0
    },
    {
        type: "channel_points",
        label: "Channel Points",
        description: "Ein Zuschauer löst eine Kanalpunkte-Belohnung ein.",
        priority: ALERT_PRIORITIES.channel_points,
        defaultDurationMs: 5000,
        defaultMessage: "Kanalpunkte eingelöst!",
        accent: "blue",
        assetBaseName: "Alert_ChannelPoints",
        soundBaseName: "Sound_ChannelPoints",
        defaultSoundVolume: 0.75,
        soundStartDelayMs: 0
    },
    {
        type: "follow",
        label: "Follower",
        description: "Ein neuer Zuschauer folgt deinem Kanal.",
        priority: ALERT_PRIORITIES.follow,
        defaultDurationMs: 4500,
        defaultMessage: "Willkommen im Rudel!",
        accent: "cyan",
        assetBaseName: "Alert_Follower",
        soundBaseName: "Sound_Follower",
        defaultSoundVolume: 0.75,
        soundStartDelayMs: 0
    },
    {
        type: "chat_highlight",
        label: "Chat Highlight",
        description: "Eine hervorgehobene Chat-Nachricht.",
        priority: ALERT_PRIORITIES.chat_highlight,
        defaultDurationMs: 4500,
        defaultMessage: "Nachricht hervorgehoben.",
        accent: "blue",
        assetBaseName: "Alert_ChatHighlight",
        soundBaseName: "Sound_ChatHighlight",
        defaultSoundVolume: 0.65,
        soundStartDelayMs: 0
    },
    {
        type: "test",
        label: "Test",
        description: "Manueller Test-Alert aus dem Dashboard.",
        priority: ALERT_PRIORITIES.test,
        defaultDurationMs: 5000,
        defaultMessage: "Das ist ein lokaler Test-Alert.",
        accent: "cyan",
        assetBaseName: "Alert_Test",
        soundBaseName: "Sound_Test",
        defaultSoundVolume: 0.7,
        soundStartDelayMs: 0
    }
];

export const ALERT_DEFINITION_BY_TYPE = ALERT_DEFINITIONS.reduce(
    (result, definition) => {
        result[definition.type] = definition;
        return result;
    },
    {} as Record<AlertType, AlertDefinition>
);

export type ClientType = "dashboard" | "overlay";

export interface AlertEvent {
    id: string;
    source: AlertSource;
    sourceEventId?: string;
    type: AlertType;
    priority: number;
    title: string;
    message?: string;
    username?: string;
    amount?: number;
    currency?: string;
    durationMs: number;
    createdAt: string;
    asset?: AlertMediaAsset;
    sound?: AlertSoundAsset;
    metadata?: Record<string, string | number | boolean | null>;
}

export interface TestAlertInput {
    type: AlertType;
    title?: string;
    message?: string;
    username?: string;
    amount?: number;
    currency?: string;
    durationMs?: number;
}

export interface AlertFinishedPayload {
    alertId: string;
    finishedAt: string;
}

export interface QueueState {
    activeAlertId: string | null;
    waitingCount: number;
    overlayConnected: boolean;
}

export interface ServerToClientEvents {
    "system:status": (payload: { status: "ok"; timestamp: string }) => void;
    "alert:show": (payload: AlertEvent) => void;
    "alert:queue-state": (payload: QueueState) => void;
}

export interface ClientToServerEvents {
    "dashboard:test-alert": (
        payload: TestAlertInput,
        callback: (response: { ok: true; alertId: string } | { ok: false; error: string }) => void
    ) => void;

    "overlay:alert-finished": (payload: AlertFinishedPayload) => void;
}

export interface InterServerEvents { }

export interface SocketData {
    clientType?: ClientType;
}