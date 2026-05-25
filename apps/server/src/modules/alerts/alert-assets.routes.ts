import type { FastifyPluginAsync } from "fastify";
import { AlertAssetResolverService } from "./alert-asset-resolver.service.js";

interface AlertAssetRoutesOptions {
    publicBaseUrl: string;
}

export function createAlertAssetRoutes(options: AlertAssetRoutesOptions): FastifyPluginAsync {
    return async (app) => {
        const assetResolver = new AlertAssetResolverService(options.publicBaseUrl);

        app.get("/api/alerts/assets", async () => {
            return assetResolver.getManifest();
        });
    };
}