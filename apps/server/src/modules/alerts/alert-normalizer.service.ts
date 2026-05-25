import { randomUUID } from "node:crypto";
import {
    ALERT_DEFINITION_BY_TYPE,
    ALERT_PRIORITIES,
    type AlertEvent,
    type AlertType,
    type TestAlertInput
} from "@hundekuchen/shared";
import { AlertAssetResolverService } from "./alert-asset-resolver.service.js";

export class AlertNormalizerService {
    constructor(private readonly assetResolver: AlertAssetResolverService) { }

    normalizeTestAlert(input: TestAlertInput): AlertEvent {
        const definition = ALERT_DEFINITION_BY_TYPE[input.type];
        const priority = ALERT_PRIORITIES[input.type] ?? ALERT_PRIORITIES.test;

        const username = input.username?.trim() || "hundekuchenlive";
        const hasAmount = typeof input.amount === "number";
        const currency = input.currency?.trim() || "EUR";
        const asset = this.assetResolver.resolveAssetForType(input.type);
        const sound = this.assetResolver.resolveSoundForType(input.type);

        return {
            id: randomUUID(),
            source: "dashboard_test",
            type: input.type,
            priority,
            title: input.title?.trim() || this.createDefaultTitle(input.type, username),
            message: input.message?.trim() || definition.defaultMessage,
            username,
            durationMs: input.durationMs ?? definition.defaultDurationMs,
            createdAt: new Date().toISOString(),
            metadata: {
                normalizedFrom: "dashboard:test-alert",
                isTest: true,
                hasVisualAsset: Boolean(asset),
                hasSoundAsset: Boolean(sound)
            },
            ...(hasAmount
                ? {
                    amount: input.amount,
                    currency
                }
                : {}),
            ...(asset
                ? {
                    asset
                }
                : {}),
            ...(sound
                ? {
                    sound
                }
                : {})
        };
    }

    private createDefaultTitle(type: AlertType, username: string): string {
        switch (type) {
            case "donation":
                return "Neue Donation";
            case "raid":
                return "Raid incoming";
            case "gift_sub":
                return "Gift Sub";
            case "prime_sub":
                return "Prime Sub";
            case "resub":
                return "ReSub";
            case "sub":
                return "Neuer Subscriber";
            case "cheer":
                return "Bits Cheer";
            case "channel_points":
                return "Channel Points";
            case "follow":
                return "Neuer Follower";
            case "chat_highlight":
                return "Chat Highlight";
            case "test":
                return "Test Alert";
            default:
                return `Alert von ${username}`;
        }
    }
}