import type {
    ServerToClientEvents,
    ClientToServerEvents,
    AlertData,
    AlertConfig
} from '@twitch-alert/types';

class AlertOverlay {
    private ws: WebSocket | null = null;
    private container: HTMLElement;
    private currentAlert: AlertData | null = null;
    private isPlaying = false;
    private audioContext: AudioContext | null = null;

    // Alert-Konfigurationen (können vom Server geladen werden)
    private alertConfigs: Record<AlertData['type'], AlertConfig> = {
        follow: {
            duration: 5000,
            animation: 'slideInBounce',
            sound: 'follow.mp3',
            template: 'follow',
            position: 'center'
        },
        subscribe: {
            duration: 7000,
            animation: 'zoomInRotate',
            sound: 'sub.mp3',
            template: 'subscribe',
            position: 'center'
        },
        sub_gift: {
            duration: 8000,
            animation: 'giftBurst',
            sound: 'gift.mp3',
            template: 'sub-gift',
            position: 'center'
        },
        cheer: {
            duration: 6000,
            animation: 'bitsRain',
            sound: 'cheer.mp3',
            template: 'cheer',
            position: 'center'
        },
        raid: {
            duration: 10000,
            animation: 'raidPulse',
            sound: 'raid.mp3',
            template: 'raid',
            position: 'center'
        },
        donation: {
            duration: 8000,
            animation: 'donationShine',
            sound: 'donation.mp3',
            template: 'donation',
            position: 'center'
        },
        host: {
            duration: 5000,
            animation: 'fadeInUp',
            sound: 'host.mp3',
            template: 'host',
            position: 'center'
        }
    };

    constructor() {
        this.container = document.getElementById('alert-container')!;
        this.connect();
    }

    private connect(): void {
        const wsUrl = this.getWebSocketUrl();
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('✅ Connected to Alert Server');
        };

        this.ws.onmessage = (event) => {
            const { event: eventType, data } = JSON.parse(event.data);
            this.handleServerMessage(eventType as keyof ServerToClientEvents, data);
        };

        this.ws.onclose = () => {
            console.log('⚠️ Connection closed, reconnecting...');
            setTimeout(() => this.connect(), 3000);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    private getWebSocketUrl(): string {
        // Production: Gleicher Host
        if (window.location.hostname !== 'localhost') {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            return `${protocol}//${window.location.host}/ws`;
        }
        // Development
        return 'ws://localhost:3000/ws';
    }

    private handleServerMessage<T extends keyof ServerToClientEvents>(
        eventType: T,
        data: Parameters<ServerToClientEvents[T]>[0]
    ): void {
        switch (eventType) {
            case 'connection:established':
                console.log('Connected with client ID:', (data as { clientId: string }).clientId);
                break;

            case 'alert:trigger':
                this.handleAlertTrigger(data as AlertData);
                break;

            case 'alert:queue':
                console.log('Queue updated:', data);
                break;

            case 'stats:update':
                // Optional: Stats-Overlay aktualisieren
                break;
        }
    }

    private async handleAlertTrigger(alert: AlertData): Promise<void> {
        // Queue-Logik: Warten wenn gerade ein Alert läuft
        if (this.isPlaying) {
            // Alert wird vom Server gequeued, wir warten auf trigger
            return;
        }

        this.currentAlert = alert;
        this.isPlaying = true;

        await this.showAlert(alert);

        // Signalisiere Server dass Alert fertig ist
        this.sendToServer('alert:complete', alert.id);

        this.isPlaying = false;
        this.currentAlert = null;
    }

    private async showAlert(alert: AlertData): Promise<void> {
        const config = this.alertConfigs[alert.type];

        // DOM Element erstellen
        const alertEl = this.createAlertElement(alert, config);
        this.container.appendChild(alertEl);

        // Sound abspielen
        await this.playSound(config.sound);

        // Animation starten
        alertEl.classList.add(`animate-${config.animation}`);

        // Warte auf Ende
        await this.wait(config.duration);

        // Ausblenden
        alertEl.classList.add('animate-out');
        await this.wait(500); // Ausblende-Animation

        // Cleanup
        alertEl.remove();
    }

    private createAlertElement(alert: AlertData, config: AlertConfig): HTMLElement {
        const div = document.createElement('div');
        div.className = `alert alert-${alert.type} alert-${config.position}`;
        div.innerHTML = this.getAlertTemplate(alert);

        // Optional: Avatar laden
        if (alert.user.avatar) {
            const img = div.querySelector('.alert-avatar') as HTMLImageElement;
            if (img) img.src = alert.user.avatar;
        }

        return div;
    }

    private getAlertTemplate(alert: AlertData): string {
        const templates: Record<AlertData['type'], string> = {
            follow: `
        <div class="alert-box follow-alert">
          <div class="alert-icon">❤️</div>
          <div class="alert-content">
            <div class="alert-title">Neuer Follower!</div>
            <div class="alert-user">${alert.user.displayName}</div>
            <div class="alert-message">Willkommen in der Community! 🐕</div>
          </div>
        </div>
      `,
            subscribe: `
        <div class="alert-box sub-alert tier-${alert.tier}">
          <div class="alert-icon">⭐</div>
          <div class="alert-content">
            <div class="alert-title">Neuer Subscriber!</div>
            <div class="alert-user">${alert.user.displayName}</div>
            <div class="alert-tier">Tier ${this.formatTier(alert.tier)}</div>
            <div class="alert-message">Danke für deine Unterstützung!</div>
          </div>
        </div>
      `,
            sub_gift: `
        <div class="alert-box subgift-alert">
          <div class="alert-icon">🎁</div>
          <div class="alert-content">
            <div class="alert-title">Geschenk-Subs!</div>
            <div class="alert-user">${alert.user.displayName}</div>
            <div class="alert-amount">${alert.amount} Subs geschenkt!</div>
            ${alert.cumulative ? `<div class="alert-cumulative">Insgesamt: ${alert.cumulative}</div>` : ''}
          </div>
        </div>
      `,
            cheer: `
        <div class="alert-box cheer-alert">
          <div class="alert-icon">💎</div>
          <div class="alert-content">
            <div class="alert-title">Bits! Bits! Bits!</div>
            <div class="alert-user">${alert.user.displayName}</div>
            <div class="alert-amount">${alert.amount} Bits</div>
            ${alert.message ? `<div class="alert-message">"${alert.message}"</div>` : ''}
          </div>
        </div>
      `,
            raid: `
        <div class="alert-box raid-alert">
          <div class="alert-icon">🚀</div>
          <div class="alert-content">
            <div class="alert-title">RAID!</div>
            <div class="alert-user">${alert.user.displayName}</div>
            <div class="alert-viewers">${alert.viewers} Zuschauer</div>
            <div class="alert-message">schließen sich uns an! Wilkommen! 👋</div>
          </div>
        </div>
      `,
            donation: `
        <div class="alert-box donation-alert">
          <div class="alert-icon">💰</div>
          <div class="alert-content">
            <div class="alert-title">Trinkgeld erhalten!</div>
            <div class="alert-user">${alert.user.displayName}</div>
            <div class="alert-amount">${alert.amount} ${alert.metadata?.currency || 'EUR'}</div>
            ${alert.message ? `<div class="alert-message">"${alert.message}"</div>` : ''}
          </div>
        </div>
      `,
            host: `
        <div class="alert-box host-alert">
          <div class="alert-icon">📺</div>
          <div class="alert-content">
            <div class="alert-title">Host!</div>
            <div class="alert-user">${alert.user.displayName}</div>
            <div class="alert-message">hostet den Kanal!</div>
          </div>
        </div>
      `
        };

        return templates[alert.type] || templates.follow;
    }

    private async playSound(soundFile: string): Promise<void> {
        try {
            const audio = new Audio(`/assets/sounds/${soundFile}`);
            audio.volume = 0.5;
            await audio.play();
        } catch (error) {
            console.warn('Failed to play sound:', error);
        }
    }

    private wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private formatTier(tier: string | undefined): string {
        const tiers: Record<string, string> = {
            '1000': '1',
            '2000': '2',
            '3000': '3'
        };
        return tiers[tier || ''] || '1';
    }

    private sendToServer<T extends keyof ClientToServerEvents>(
        event: T,
        data: Parameters<ClientToServerEvents[T]>[0]
    ): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ event, data }));
        }
    }
}

// Overlay initialisieren
document.addEventListener('DOMContentLoaded', () => {
    new AlertOverlay();
});
