import { WebSocketServer, WebSocket, RawData } from 'ws';
import { Logger, AsyncQueue, generateId } from '@twitch-alert/utils';
import type { 
  AlertData, 
  ServerToClientEvents, 
  ClientToServerEvents 
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
  private pendingCompletions = new Map<string, () => void>();

  constructor(private wss: WebSocketServer) {
    this.alertQueue = new AsyncQueue<AlertData>(this.processAlert.bind(this));
    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws, req) => {
      const clientId = generateId();
      const clientType = this.detectClientType(req);
      
      const client: ConnectedClient = {
        id: clientId,
        ws,
        type: clientType,
        connectedAt: new Date()
      };

      this.clients.set(clientId, client);
      this.logger.info(`[CLIENT CONNECTED] ${clientId} (${clientType})`);

      this.sendToClient(client, 'connection:established', { clientId });

      ws.on('message', (data: RawData) => {
        this.handleMessage(data);
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        this.logger.info(`[CLIENT DISCONNECTED] ${clientId}`);
      });

      ws.on('error', (error) => {
        this.logger.error(`WebSocket error: ${clientId}`, error);
        this.clients.delete(clientId);
      });

      this.sendToClient(client, 'alert:queue', Array.from(this.alertQueue.items));
    });
  }

  private detectClientType(req: any): ConnectedClient['type'] {
    const userAgent = req.headers['user-agent'] || '';
    if (userAgent.includes('OBS')) return 'overlay';
    if (userAgent.includes('dashboard')) return 'dashboard';
    return 'unknown';
  }

  private handleMessage(data: RawData): void {
    try {
      const message = JSON.parse(data.toString()) as {
        event: keyof ClientToServerEvents;
        data: unknown;
      };

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

  async triggerAlert(alert: AlertData): Promise<void> {
    this.logger.info(`[QUEUE] ${alert.type} from ${alert.user.displayName}`);
    await this.alertQueue.enqueue(alert);
  }

  async triggerImmediateAlert(alert: AlertData): Promise<void> {
    this.logger.info(`[IMMEDIATE] ${alert.type}`);
    await this.processAlert(alert);
  }

  private async processAlert(alert: AlertData): Promise<void> {
    this.currentAlert = alert;
    
    this.broadcast('alert:trigger', alert, c => c.type === 'overlay');
    this.logger.info(`[ALERT SENT] to ${this.getOverlayClientCount()} overlay(s)`);

    await this.waitForAlertCompletion(alert.id, 30000);
    
    this.currentAlert = null;
  }

  private waitForAlertCompletion(alertId: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.logger.warn(`[TIMEOUT] Alert ${alertId}`);
        this.pendingCompletions.delete(alertId);
        resolve();
      }, timeoutMs);

      this.pendingCompletions.set(alertId, () => {
        clearTimeout(timeout);
        this.pendingCompletions.delete(alertId);
        resolve();
      });
    });
  }

  private handleAlertComplete(alertId: string): void {
    this.logger.debug(`[COMPLETE] ${alertId}`);
    const pending = this.pendingCompletions.get(alertId);
    if (pending) pending();
  }

  private skipCurrentAlert(): void {
    if (this.currentAlert) {
      this.handleAlertComplete(this.currentAlert.id);
    }
  }

  private triggerTestAlert(type: AlertData['type']): void {
    const testAlert: AlertData = {
      id: generateId(),
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

  private getOverlayClientCount(): number {
    return Array.from(this.clients.values()).filter(c => c.type === 'overlay').length;
  }

  getQueueLength(): number {
    return this.alertQueue.length;
  }

  getConnectedClients(): number {
    return this.clients.size;
  }
}
