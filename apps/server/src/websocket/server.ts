import fastifyWebsocket from '@fastify/websocket';
import { FastifyInstance } from 'fastify';
import {
    type ServerToClientEvents,
    type ClientToServerEvents,
    type AlertPayload
} from '@hundekuchenlive/shared';

interface ClientConnection {
    socket: WebSocket;
    id: string;
    type: 'obs-browser' | 'service';
    ready: boolean;
}

export class WebSocketServer {
    private clients = new Map<string, ClientConnection>();
    private clientId = 0;
    private alertQueue: AlertPayload[] = [];
    private currentAlert: AlertPayload | null = null;
    private server!: FastifyInstance;

    constructor(fastify: FastifyInstance) {
        this.server = fastify;
    }

    async register(): Promise<void> {
        await this.server.register(fastifyWebsocket);

        this.server.get('/ws', { websocket: true }, (connection, req) => {
            const id = `client-${++this.clientId}`;
            const client: ClientConnection = {
                socket: connection.socket,
                id,
                type: 'service', // default, wird bei handshake geupdated
                ready: false,
            };

            this.clients.set(id, client);
            console.log(`[WS-Server] Client verbunden: ${id}`);

            // Heartbeat
            const pingInterval = setInterval(() => {
                if (connection.socket.readyState === 1) { // OPEN
                    connection.socket.send(JSON.stringify({ type: 'ping' }));
                }
            }, 30000);

            connection.socket.on('message', (message: Buffer | string) => {
                try {
                    const data = JSON.parse(message.toString());
                    this.handleMessage(id, data);
                } catch (err) {
                    console.error('[WS-Server] Ungültige Nachricht:', err);
                }
            });

            connection.socket.on('close', () => {
                clearInterval(pingInterval);
                this.clients.delete(id);
                console.log(`[WS-Server] Client getrennt: ${id}`);
            });

            connection.socket.on('error', (err) => {
                console.error(`[WS-Server] Fehler bei ${id}:`, err);
            });
        });
    }

    private handleMessage(clientId: string, data: any): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        switch (data.type) {
            case 'service:register':
                client.type = 'service';
                console.log(`[WS-Server] ${clientId} als Service registriert`);
                break;

            case 'client:ready':
                client.type = 'obs-browser';
                client.ready = true;
                console.log(`[WS-Server] ${clientId} als OBS-Browser bereit`);
                // Warte auf Alert?
                break;

            case 'broadcast':
                // Weiterleitung von Services an alle OBS-Browser
                if (data.event && data.payload) {
                    this.broadcastToOBS(data.event, data.payload);
                }
                break;

            case 'alert:complete':
                this.handleAlertComplete(data.alertId);
                break;

            case 'pong':
                // Heartbeat ACK
                break;
        }
    }

    private broadcastToOBS<K extends keyof ServerToClientEvents>(
        event: K,
        payload: Parameters<ServerToClientEvents[K]>[0]
    ): void {
        console.log(`[WS-Server] Broadcast: ${event}`, payload);

        for (const client of this.clients.values()) {
            if (client.type === 'obs-browser' && client.ready) {
                try {
                    client.socket.send(JSON.stringify({
                        type: 'event',
                        event,
                        payload,
                    }));
                } catch (err) {
                    console.error(`[WS-Server] Senden fehlgeschlagen an ${client.id}`);
                }
            }
        }
    }

    private handleAlertComplete(alertId: string): void {
        console.log(`[WS-Server] Alert abgeschlossen: ${alertId}`);
        this.currentAlert = null;
        this.processQueue();
    }

    private processQueue(): void {
        if (this.currentAlert || this.alertQueue.length === 0) return;

        const next = this.alertQueue.shift();
        if (next) {
            this.currentAlert = next;
            this.broadcastToOBS('alert:trigger', next);
        }
    }

    // Queue-Management (für spätere Erweiterung)
    enqueueAlert(alert: AlertPayload): void {
        this.alertQueue.push(alert);
        this.processQueue();
    }

    getStats() {
        return {
            connections: this.clients.size,
            obsClients: Array.from(this.clients.values()).filter(c => c.type === 'obs-browser').length,
            services: Array.from(this.clients.values()).filter(c => c.type === 'service').length,
            queueLength: this.alertQueue.length,
        };
    }
}
