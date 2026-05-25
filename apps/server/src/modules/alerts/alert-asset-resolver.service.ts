import { existsSync } from "node:fs";
import path from "node:path";
import {
    ALERT_DEFINITION_BY_TYPE,
    ALERT_DEFINITIONS,
    type AlertAssetManifestItem,
    type AlertAssetManifestResponse,
    type AlertMediaAsset,
    type AlertSoundAsset,
    type AlertType
} from "@hundekuchen/shared";
import { logger } from "@hundekuchen/logger";

const VISUAL_EXTENSIONS = [".mp4", ".webm", ".mov", ".jpg", ".jpeg", ".png", ".gif"] as const;
const AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".m4a"] as const;

const VIDEO_EXTENSIONS = new Set<string>([".mp4", ".webm", ".mov"]);

const ALERT_ASSET_ALIASES: Record<AlertType, string[]> = {
    donation: ["Alert_Donation", "Alert_donation", "Alert_support", "Alert_Support"],
    raid: ["Alert_Raid", "Alert_raid"],
    gift_sub: ["Alert_GiftSub", "Alert_gift_sub", "Alert_giftsub", "Alert_GiftedSub"],
    prime_sub: ["Alert_PrimeSub", "Alert_prime_sub", "Alert_PrimeSubscriber"],
    resub: ["Alert_ReSub", "Alert_resub", "Alert_ReSubscriber"],
    sub: ["Alert_Subscriber", "Alert_subscriber", "Alert_Sub", "Alert_sub"],
    cheer: ["Alert_Bits", "Alert_bits", "Alert_Cheer", "Alert_cheer"],
    channel_points: [
        "Alert_ChannelPoints",
        "Alert_channel_points",
        "Alert_channelpoints",
        "Alert_Points"
    ],
    follow: ["Alert_Follower", "Alert_follower", "Alert_Follow", "Alert_follow"],
    chat_highlight: ["Alert_ChatHighlight", "Alert_chat_highlight", "Alert_Highlight"],
    test: ["Alert_Test", "Alert_test"]
};

const ALERT_SOUND_ALIASES: Record<AlertType, string[]> = {
    donation: ["Sound_Donation", "Sound_donation", "Alert_Donation", "Alert_donation"],
    raid: ["Sound_Raid", "Sound_raid", "Alert_Raid", "Alert_raid"],
    gift_sub: ["Sound_GiftSub", "Sound_gift_sub", "Alert_GiftSub", "Alert_gift_sub"],
    prime_sub: ["Sound_PrimeSub", "Sound_prime_sub", "Alert_PrimeSub", "Alert_prime_sub"],
    resub: ["Sound_ReSub", "Sound_resub", "Alert_ReSub", "Alert_resub"],
    sub: ["Sound_Subscriber", "Sound_subscriber", "Sound_Sub", "Alert_Subscriber", "Alert_sub"],
    cheer: ["Sound_Bits", "Sound_bits", "Sound_Cheer", "Alert_Bits", "Alert_cheer"],
    channel_points: [
        "Sound_ChannelPoints",
        "Sound_channel_points",
        "Alert_ChannelPoints",
        "Alert_channel_points"
    ],
    follow: ["Sound_Follower", "Sound_follower", "Sound_Follow", "Alert_Follower", "Alert_follow"],
    chat_highlight: ["Sound_ChatHighlight", "Sound_chat_highlight", "Alert_ChatHighlight"],
    test: ["Sound_Test", "Sound_test", "Alert_Test", "Alert_test"]
};

export class AlertAssetResolverService {
    private readonly assetRootPath = path.resolve(process.cwd(), "../../data/assets/alerts");

    constructor(private readonly publicBaseUrl: string) { }

    resolveAssetForType(type: AlertType): AlertMediaAsset | undefined {
        const assets = this.getAssetsForType(type);
        return this.pickPreferredVisualAsset(assets);
    }

    resolveSoundForType(type: AlertType): AlertSoundAsset | undefined {
        const sounds = this.getSoundsForType(type);
        return sounds[0];
    }

    getManifest(): AlertAssetManifestResponse {
        const items = ALERT_DEFINITIONS.map((definition): AlertAssetManifestItem => {
            const candidateBaseNames = this.createCandidateBaseNames(
                definition.type,
                definition.assetBaseName
            );

            const candidateSoundBaseNames = this.createCandidateSoundBaseNames(
                definition.type,
                definition.soundBaseName
            );

            const availableAssets = this.getAssetsForCandidateBaseNames(candidateBaseNames);
            const availableSoundAssets = this.getSoundsForCandidateBaseNames(
                definition.type,
                candidateSoundBaseNames
            );

            const resolvedAsset = this.pickPreferredVisualAsset(availableAssets);
            const resolvedSound = availableSoundAssets[0];

            const baseItem = {
                type: definition.type,
                label: definition.label,
                priority: definition.priority,
                expectedBaseName: definition.assetBaseName,
                expectedSoundBaseName: definition.soundBaseName,
                candidateBaseNames,
                candidateSoundBaseNames,
                availableAssets,
                availableSoundAssets,
                missing: !resolvedAsset,
                soundMissing: !resolvedSound
            };

            return {
                ...baseItem,
                ...(resolvedAsset ? { resolvedAsset } : {}),
                ...(resolvedSound ? { resolvedSound } : {})
            };
        });

        return {
            generatedAt: new Date().toISOString(),
            assetRootPath: this.assetRootPath,
            items
        };
    }

    private getAssetsForType(type: AlertType): AlertMediaAsset[] {
        const definition = ALERT_DEFINITION_BY_TYPE[type];
        const candidateBaseNames = this.createCandidateBaseNames(type, definition.assetBaseName);

        const assets = this.getAssetsForCandidateBaseNames(candidateBaseNames);

        if (assets.length === 0) {
            logger.debug(
                {
                    type,
                    assetRootPath: this.assetRootPath,
                    candidateBaseNames
                },
                "No visual alert asset found for alert type."
            );
        }

        return assets;
    }

    private getSoundsForType(type: AlertType): AlertSoundAsset[] {
        const definition = ALERT_DEFINITION_BY_TYPE[type];
        const candidateSoundBaseNames = this.createCandidateSoundBaseNames(
            type,
            definition.soundBaseName
        );

        const sounds = this.getSoundsForCandidateBaseNames(type, candidateSoundBaseNames);

        if (sounds.length === 0) {
            logger.debug(
                {
                    type,
                    assetRootPath: this.assetRootPath,
                    candidateSoundBaseNames
                },
                "No alert sound asset found for alert type."
            );
        }

        return sounds;
    }

    private getAssetsForCandidateBaseNames(candidateBaseNames: string[]): AlertMediaAsset[] {
        const assets: AlertMediaAsset[] = [];

        for (const baseName of candidateBaseNames) {
            for (const extension of VISUAL_EXTENSIONS) {
                const fileName = `${baseName}${extension}`;
                const filePath = path.join(this.assetRootPath, fileName);

                if (!existsSync(filePath)) {
                    continue;
                }

                assets.push(this.createVisualAsset(fileName, extension));
            }
        }

        return assets;
    }

    private getSoundsForCandidateBaseNames(
        type: AlertType,
        candidateSoundBaseNames: string[]
    ): AlertSoundAsset[] {
        const definition = ALERT_DEFINITION_BY_TYPE[type];
        const sounds: AlertSoundAsset[] = [];

        for (const baseName of candidateSoundBaseNames) {
            for (const extension of AUDIO_EXTENSIONS) {
                const fileName = `${baseName}${extension}`;
                const filePath = path.join(this.assetRootPath, fileName);

                if (!existsSync(filePath)) {
                    continue;
                }

                sounds.push(
                    this.createSoundAsset(
                        fileName,
                        extension,
                        definition.defaultSoundVolume,
                        definition.soundStartDelayMs
                    )
                );
            }
        }

        return sounds;
    }

    private pickPreferredVisualAsset(assets: AlertMediaAsset[]): AlertMediaAsset | undefined {
        const videoAsset = assets.find((asset) => asset.mediaType === "video");

        if (videoAsset) {
            return videoAsset;
        }

        return assets[0];
    }

    private createVisualAsset(fileName: string, extension: string): AlertMediaAsset {
        const mediaType = VIDEO_EXTENSIONS.has(extension) ? "video" : "image";
        const url = `${this.publicBaseUrl}/assets/alerts/${encodeURIComponent(fileName)}`;

        return {
            fileName,
            url,
            mediaType,
            extension
        };
    }

    private createSoundAsset(
        fileName: string,
        extension: string,
        volume: number,
        startDelayMs: number
    ): AlertSoundAsset {
        const url = `${this.publicBaseUrl}/assets/alerts/${encodeURIComponent(fileName)}`;

        return {
            fileName,
            url,
            extension,
            volume,
            startDelayMs
        };
    }

    private createCandidateBaseNames(type: AlertType, defaultBaseName: string): string[] {
        return Array.from(new Set([defaultBaseName, ...ALERT_ASSET_ALIASES[type]]));
    }

    private createCandidateSoundBaseNames(type: AlertType, defaultBaseName: string): string[] {
        return Array.from(new Set([defaultBaseName, ...ALERT_SOUND_ALIASES[type]]));
    }
}