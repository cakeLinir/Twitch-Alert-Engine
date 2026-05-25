import {
    type AlertEvent,
    type AlertFinishedPayload,
    type QueueState,
    type TestAlertInput
} from "@hundekuchen/shared";
import { logger } from "@hundekuchen/logger";
import { AlertAssetResolverService } from "./alert-asset-resolver.service.js";
import { AlertNormalizerService } from "./alert-normalizer.service.js";

type AlertDispatchHandler = (alert: AlertEvent) => void;
type QueueStateHandler = (state: QueueState) => void;

interface AlertQueueServiceOptions {
    publicBaseUrl: string;
}

export class AlertQueueService {
    private readonly queue: AlertEvent[] = [];
    private readonly normalizer: AlertNormalizerService;

    private activeAlert: AlertEvent | null = null;
    private overlayClientCount = 0;

    private dispatchHandler: AlertDispatchHandler | null = null;
    private queueStateHandler: QueueStateHandler | null = null;
    private activeAlertTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(options: AlertQueueServiceOptions) {
        const assetResolver = new AlertAssetResolverService(options.publicBaseUrl);
        this.normalizer = new AlertNormalizerService(assetResolver);
    }

    setDispatchHandler(handler: AlertDispatchHandler): void {
        this.dispatchHandler = handler;
    }

    setQueueStateHandler(handler: QueueStateHandler): void {
        this.queueStateHandler = handler;
    }

    setOverlayClientCount(count: number): void {
        this.overlayClientCount = count;

        logger.info(
            {
                overlayClientCount: this.overlayClientCount
            },
            "Overlay client count updated."
        );

        this.emitQueueState();
        this.processNext();
    }

    enqueueTestAlert(input: TestAlertInput): AlertEvent {
        const alert = this.normalizer.normalizeTestAlert(input);
        this.enqueue(alert);
        return alert;
    }

    markAlertFinished(payload: AlertFinishedPayload): void {
        if (!this.activeAlert) {
            logger.warn({ payload }, "Received alert finished event but no alert is active.");
            return;
        }

        if (payload.alertId !== this.activeAlert.id) {
            logger.warn(
                {
                    receivedAlertId: payload.alertId,
                    activeAlertId: this.activeAlert.id
                },
                "Received alert finished event for a different alert."
            );
            return;
        }

        logger.info(
            {
                alertId: payload.alertId,
                finishedAt: payload.finishedAt
            },
            "Alert finished by overlay ACK."
        );

        this.clearActiveAlertTimeout();
        this.activeAlert = null;
        this.emitQueueState();
        this.processNext();
    }

    getQueueState(): QueueState {
        return {
            activeAlertId: this.activeAlert?.id ?? null,
            waitingCount: this.queue.length,
            overlayConnected: this.overlayClientCount > 0
        };
    }

    private enqueue(alert: AlertEvent): void {
        logger.info(
            {
                alertId: alert.id,
                type: alert.type,
                source: alert.source,
                priority: alert.priority,
                assetFileName: alert.asset?.fileName ?? null
            },
            "Alert enqueued."
        );

        this.queue.push(alert);
        this.sortQueue();
        this.emitQueueState();
        this.processNext();
    }

    private sortQueue(): void {
        this.queue.sort((a, b) => {
            if (b.priority !== a.priority) {
                return b.priority - a.priority;
            }

            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
    }

    private processNext(): void {
        if (this.activeAlert) {
            return;
        }

        if (this.overlayClientCount <= 0) {
            if (this.queue.length > 0) {
                logger.warn(
                    {
                        waitingCount: this.queue.length
                    },
                    "Alert queue is waiting because no overlay client is connected."
                );
            }

            this.emitQueueState();
            return;
        }

        const nextAlert = this.queue.shift();

        if (!nextAlert) {
            this.emitQueueState();
            return;
        }

        this.activeAlert = nextAlert;

        logger.info(
            {
                alertId: nextAlert.id,
                type: nextAlert.type,
                priority: nextAlert.priority,
                assetUrl: nextAlert.asset?.url ?? null
            },
            "Dispatching alert to overlay."
        );

        this.emitQueueState();
        this.dispatchHandler?.(nextAlert);
        this.startActiveAlertTimeout(nextAlert);
    }

    private startActiveAlertTimeout(alert: AlertEvent): void {
        this.clearActiveAlertTimeout();

        const timeoutMs = alert.durationMs + 3000;

        this.activeAlertTimeout = setTimeout(() => {
            if (!this.activeAlert || this.activeAlert.id !== alert.id) {
                return;
            }

            logger.warn(
                {
                    alertId: alert.id,
                    timeoutMs
                },
                "Alert timed out without overlay ACK. Releasing queue."
            );

            this.activeAlert = null;
            this.emitQueueState();
            this.processNext();
        }, timeoutMs);
    }

    private clearActiveAlertTimeout(): void {
        if (!this.activeAlertTimeout) {
            return;
        }

        clearTimeout(this.activeAlertTimeout);
        this.activeAlertTimeout = null;
    }

    private emitQueueState(): void {
        this.queueStateHandler?.(this.getQueueState());
    }
}