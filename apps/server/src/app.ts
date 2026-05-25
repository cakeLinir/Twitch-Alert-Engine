import { existsSync } from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import type { AppConfig } from "@hundekuchen/config";
import { logger } from "@hundekuchen/logger";
import { createAlertAssetRoutes } from "./modules/alerts/alert-assets.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";

export async function createApp(appConfig: AppConfig) {
    const app = Fastify({
        loggerInstance: logger
    });

    await app.register(cors, {
        origin: [appConfig.cors.dashboardOrigin, appConfig.cors.overlayOrigin]
    });

    await app.register(healthRoutes);

    await app.register(
        createAlertAssetRoutes({
            publicBaseUrl: appConfig.publicBaseUrl
        })
    );

    const overlayDistPath = path.resolve(process.cwd(), "../overlay/dist");
    const overlayIndexPath = path.join(overlayDistPath, "index.html");
    const overlayStaticEnabled = existsSync(overlayIndexPath);

    if (overlayStaticEnabled) {
        await app.register(fastifyStatic, {
            root: overlayDistPath,
            prefix: "/overlay/",
            wildcard: false
        });

        logger.info(
            {
                overlayDistPath
            },
            "Overlay static files enabled."
        );
    } else {
        logger.warn(
            {
                overlayDistPath
            },
            "Overlay dist folder not found. Use the Vite dev server for overlay during development."
        );
    }

    const alertAssetsPath = path.resolve(process.cwd(), "../../data/assets/alerts");

    if (existsSync(alertAssetsPath)) {
        await app.register(fastifyStatic, {
            root: alertAssetsPath,
            prefix: "/assets/alerts/",
            decorateReply: !overlayStaticEnabled
        });

        logger.info(
            {
                alertAssetsPath
            },
            "Alert asset static files enabled."
        );
    } else {
        logger.warn(
            {
                alertAssetsPath
            },
            "Alert assets folder not found."
        );
    }

    if (overlayStaticEnabled) {
        app.setNotFoundHandler(async (request, reply) => {
            const requestUrl = request.raw.url ?? "";

            if (requestUrl.startsWith("/overlay/")) {
                return reply.sendFile("index.html");
            }

            return reply.code(404).send({
                statusCode: 404,
                error: "Not Found",
                message: "Route not found"
            });
        });
    }

    return app;
}