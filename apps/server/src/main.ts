import { config } from "@hundekuchen/config";
import { logger } from "@hundekuchen/logger";
import { createApp } from "./app.js";
import { AlertQueueService } from "./modules/alerts/alert-queue.service.js";
import { createRealtimeGateway } from "./modules/realtime/realtime.gateway.js";

const app = await createApp(config);

const alertQueue = new AlertQueueService({
    publicBaseUrl: config.publicBaseUrl
});

createRealtimeGateway(app.server, config, alertQueue);

try {
    await app.listen({
        host: config.server.host,
        port: config.server.port
    });

    logger.info(
        {
            host: config.server.host,
            port: config.server.port,
            publicBaseUrl: config.publicBaseUrl
        },
        "Server started."
    );
} catch (error) {
    logger.fatal({ error }, "Server failed to start.");
    process.exit(1);
}