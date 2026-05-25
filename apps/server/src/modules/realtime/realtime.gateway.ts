import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type {
    ClientToServerEvents,
    InterServerEvents,
    ServerToClientEvents,
    SocketData,
    TestAlertInput
} from "@hundekuchen/shared";
import type { AppConfig } from "@hundekuchen/config";
import { logger } from "@hundekuchen/logger";
import type { AlertQueueService } from "../alerts/alert-queue.service.js";

export function createRealtimeGateway(
    httpServer: HttpServer,
    appConfig: AppConfig,
    alertQueue: AlertQueueService
): Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
    const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
        httpServer,
        {
            cors: {
                origin: [appConfig.cors.dashboardOrigin, appConfig.cors.overlayOrigin],
                methods: ["GET", "POST"]
            }
        }
    );

    const overlaySocketIds = new Set<string>();

    function syncOverlayClientCount(): void {
        alertQueue.setOverlayClientCount(overlaySocketIds.size);
    }

    alertQueue.setDispatchHandler((alert) => {
        io.to("overlay").emit("alert:show", alert);
    });

    alertQueue.setQueueStateHandler((state) => {
        io.to("dashboard").emit("alert:queue-state", state);
        io.to("overlay").emit("alert:queue-state", state);
    });

    io.on("connection", (socket) => {
        const rawClientType = socket.handshake.auth.clientType;

        if (rawClientType !== "dashboard" && rawClientType !== "overlay") {
            logger.warn(
                {
                    socketId: socket.id,
                    rawClientType
                },
                "Socket connection rejected because clientType is invalid."
            );

            socket.disconnect(true);
            return;
        }

        socket.data.clientType = rawClientType;
        socket.join(rawClientType);

        if (rawClientType === "overlay") {
            overlaySocketIds.add(socket.id);
            syncOverlayClientCount();
        }

        logger.info(
            {
                socketId: socket.id,
                clientType: rawClientType
            },
            "Socket client connected."
        );

        socket.emit("system:status", {
            status: "ok",
            timestamp: new Date().toISOString()
        });

        socket.emit("alert:queue-state", alertQueue.getQueueState());

        socket.on("dashboard:test-alert", (payload: TestAlertInput, callback) => {
            if (socket.data.clientType !== "dashboard") {
                callback({
                    ok: false,
                    error: "Only dashboard clients can create test alerts."
                });
                return;
            }

            try {
                const alert = alertQueue.enqueueTestAlert(payload);

                callback({
                    ok: true,
                    alertId: alert.id
                });
            } catch (error) {
                logger.error({ error }, "Failed to enqueue test alert.");

                callback({
                    ok: false,
                    error: "Failed to enqueue test alert."
                });
            }
        });

        socket.on("overlay:alert-finished", (payload) => {
            if (socket.data.clientType !== "overlay") {
                logger.warn(
                    {
                        socketId: socket.id,
                        clientType: socket.data.clientType
                    },
                    "Non-overlay client tried to finish an alert."
                );
                return;
            }

            alertQueue.markAlertFinished(payload);
        });

        socket.on("disconnect", (reason) => {
            if (socket.data.clientType === "overlay") {
                overlaySocketIds.delete(socket.id);
                syncOverlayClientCount();
            }

            logger.info(
                {
                    socketId: socket.id,
                    clientType: socket.data.clientType,
                    reason
                },
                "Socket client disconnected."
            );
        });
    });

    return io;
}