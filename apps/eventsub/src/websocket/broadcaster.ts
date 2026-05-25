import WebSocket from 'ws';
import { type ServerToClientEvents } from '@hundekuchenlive/shared';

type EventMap = ServerToClientEvents;
type EventName = keyof EventMap;

export class WebSocketBroadcaster {
    private ws: WebSocket | null = null;
    private reconnectInterval = 5000;
    private url: string;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    constructor(url: string) {
        this.url = url;
    }

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log(`[WS-Client] Verbinde zu ${this.url}`);

            this.ws = new WebSocket(this.url);

            this.ws.on('open', () => {
                console.log('[WS-Client] Verbunden mit OBS-Server');
                this.ws?.send(JSON.stringify({ type: 'service:register', service: 'twitch-eventsub' }));
                resolve();
            });

            this.ws.on('message', (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'pong') {
                    // Heartbeat ok
                }
            });

            this.ws.on('error', (err) => {
                console.error('[WS-Client] Fehler:', err.message);
                reject(err);
            });

            this.ws.on('close', () => {
                console.log('[WS-Client] Verbindung geschlossen. Reconnect...');
                this.scheduleReconnect();
            });
        });
    }

    broadcast<K extends EventName>(event: K, ...args: Parameters<EventMap[K]>): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            const payload = args[0];
            this.ws.send(JSON.stringify({
                type: 'broadcast',
                event,
                payload,
                timestamp: Date.now(),
            }));
        } else {
            console.warn('[WS-Client] Nicht verbunden, Event verworfen');
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimeout) return;

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect().catch(() => {
                // Reconnect-Fehler werden von scheduleReconnect behandelt
            });
        }, this.reconnectInterval);
    }

    disconnect(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        this.ws?.close();
    }
}
