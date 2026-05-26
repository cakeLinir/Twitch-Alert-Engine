import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import { randomUUID } from 'crypto';

import { Logger } from '@twitch-alert/utils';
import { AsyncQueue } from '@twitch-alert/utils';
import type {
    AlertData,
    ServerToClientEvents,
    ClientToServerEvents,
    StreamStats
} from '@twitch-alert/types';

interface ConnectedClient {
    id: string;
    ws: WebSocket;
    type: 'overlay' | 'dashboard' | 'unknown';
    connectedAt: Date;
}

export class AlertServer {
    private logger = new Logger('AlertServer');
    private clients = new Map<string, ConnectedClient>();
    private alertQueue: AsyncQueue<AlertData>;
    private currentAlert: AlertData | null = null;
    private stats: StreamStats = {
        followCount: 0,
        subCount: 0,
        cheerCount: 0,
        donationTotal: 0,
        viewerCount: 0
    };

    constructor(private wss: WebSocketServer) {
        this.alertQueue = new AsyncQueue<AlertData>(this.processAlert.bind(this));
        this.setupWebSocketServer();
    }

    private setupWebSocketServer(): void {
        this.wss.on('connection', (ws: WebSocket, req) => {
            const clientId = randomUUID();
            const clientType = this.detectClientType(req);

            const client: ConnectedClient = {
                id: clientId,
                ws,
                type: clientType,
                connectedAt: new Date()
            };

            this.clients.set(clientId, client);
            this.logger.info(`Client connected: ${clientId} (${clientType})`);

            // Sende Willkommensnachricht
            this.sendToClient(client, 'connection:established', { clientId });

            // Setup message handler
            ws.on('message', (data: Buffer) => {
                this.handleMessage(client, data);
            });

            // Cleanup on disconnect
            ws.on('close', () => {
                this.clients.delete(clientId);
                this.logger.info(`Client disconnected: ${clientId}`);
            });

            ws.on('error', (error) => {
                this.logger.error(`WebSocket error for client ${clientId}:`, error);
                this.clients.delete(clientId);
            });

            // Sende aktuelle Queue
            this.sendToClient(client, 'alert:queue', this.alertQueue.items as AlertData[]);
        });
    }

    private detectClientType(req: any): ConnectedClient['type'] {
        const userAgent = req.headers['user-agent'] || '';
        if (userAgent.includes('OBS')) return 'overlay';
        if (userAgent.includes('dashboard')) return 'dashboard';
        return 'unknown';
    }

    private handleMessage(client: ConnectedClient, data: Buffer): void {
        try {
            const message = JSON.parse(data.toString()) as {
                event: keyof ClientToServerEvents;
                data: unknown;
            };

            this.logger.debug(`Received ${message.event} from ${client.id}`);

            switch (message.event) {
                case 'alert:complete':
                    this.handleAlertComplete(message.data as string);
                    break;
                case 'alert:skip':
                    this.skipCurrentAlert();
                    break;
                case 'test:trigger':
                    this.triggerTestAlert(message.data as AlertData['type']);
                    break;
            }
        } catch (error) {
            this.logger.error('Failed to parse message:', error);
        }
    }

    private sendToClient<T extends keyof ServerToClientEvents>(
        client: ConnectedClient,
        event: T,
        data: Parameters<ServerToClientEvents[T]>[0]
    ): void {
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({ event, data }));
        }
    }

    private broadcast<T extends keyof ServerToClientEvents>(
        event: T,
        data: Parameters<ServerToClientEvents[T]>[0],
        filter?: (client: ConnectedClient) => boolean
    ): void {
        this.clients.forEach(client => {
            if (!filter || filter(client)) {
                this.sendToClient(client, event, data);
            }
        });
    }

    // ============================================
    // PUBLIC API
    // ============================================

    /**
     * Trigger einen neuen Alert
     */
    async triggerAlert(alert: AlertData): Promise<void> {
        this.logger.info(`Queuing alert: ${alert.type} from ${alert.user.displayName}`);

        // Update Stats
        this.updateStats(alert);

        // Add to queue
        await this.alertQueue.enqueue(alert);
    }

    /**
     * Sofortiger Alert (überspringt Queue)
     */
    async triggerImmediateAlert(alert: AlertData): Promise<void> {
        this.logger.info(`Immediate alert: ${alert.type} from ${alert.user.displayName}`);
        await this.processAlert(alert);
    }

    private async processAlert(alert: AlertData): Promise<void> {
        this.currentAlert = alert;

        // Sende an alle Overlay-Clients
        this.broadcast('alert:trigger', alert, client => client.type === 'overlay');

        // Warte auf Abschluss (Overlay meldet sich zurück)
        // Timeout als Fallback (z.B. 30 Sekunden)
        await this.waitForAlertCompletion(alert.id, 30000);

        this.currentAlert = null;
    }

    private waitForAlertCompletion(alertId: string, timeoutMs: number): Promise<void> {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.logger.warn(`Alert ${alertId} timed out`);
                resolve();
            }, timeoutMs);

            // Store resolver to be called when alert:complete is received
            (this as any).pendingCompletions = (this as any).pendingCompletions || new Map();
            (this as any).pendingCompletions.set(alertId, () => {
                clearTimeout(timeout);
                resolve();
            });
        });
    }

    private handleAlertComplete(alertId: string): void {
        this.logger.debug(`Alert completed: ${alertId}`);
        const pending = (this as any).pendingCompletions?.get(alertId);
        if (pending) {
            pending();
            (this as any).pendingCompletions.delete(alertId);
        }
    }

    private skipCurrentAlert(): void {
        if (this.currentAlert) {
            this.handleAlertComplete(this.currentAlert.id);
        }
    }

    private triggerTestAlert(type: AlertData['type']): void {
        const testAlert: AlertData = {
            id: randomUUID(),
            type,
            timestamp: new Date().toISOString(),
            user: {
                name: 'testuser',
                displayName: 'TestUser',
                avatar: 'https://static-cdn.jtvnw.net/user-default-pictures-uv/998f01ae-def8-11e9-b95c-784f43822e80-profile_image-300x300.png'
            },
            amount: type === 'donation' ? 10 : type === 'cheer' ? 100 : undefined,
            message: 'Das ist eine Test-Alert-Nachricht!',
            tier: type === 'subscribe' ? '1000' : undefined,
            viewers: type === 'raid' ? 42 : undefined
        };

        this.triggerAlert(testAlert);
    }

    private updateStats(alert: AlertData): void {
        switch (alert.type) {
            case 'follow':
                this.stats.followCount++;
                break;
            case 'subscribe':
            case 'sub_gift':
                this.stats.subCount++;
                break;
            case 'cheer':
                this.stats.cheerCount += alert.amount || 0;
                break;
            case 'donation':
                this.stats.donationTotal += alert.amount || 0;
                break;
        }

        // Broadcast stats update
        this.broadcast('stats:update', this.stats);
    }

    getConnectedClients(): number {
        return this.clients.size;
    }

    getQueueLength(): number {
        return this.alertQueue.length;
    }
}
