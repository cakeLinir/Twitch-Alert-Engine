// Korrekter Pfad zur CSS-Datei
import './assets/styles/overlay.css';

// Video-Assets über Vite importieren (gibt korrekte gehashte URLs zurück)
import followerVideoUrl from './assets/video/Alert_Follower.mp4';
import subscriberVideoUrl from './assets/video/Alert_Subscriber.mp4';
import raidVideoUrl from './assets/video/Alert_Raid.mp4';
import donationVideoUrl from './assets/video/Alert_Donation.mp4';

interface AlertData {
  id: string;
  type: 'follow' | 'subscribe' | 'sub_gift' | 'cheer' | 'raid' | 'donation';
  timestamp: string;
  user: {
    name: string;
    displayName: string;
    avatar?: string;
  };
  amount?: number;
  message?: string;
  tier?: string;
  viewers?: number;
  metadata?: Record<string, unknown>;
}

class AlertOverlay {
  private ws: WebSocket | null = null;
  private container: HTMLElement;
  private isPlaying = false;
  private alertQueue: AlertData[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 3000;

  // Kein "sound" mehr – stattdessen "video" mit eingebettetem Audio
  private alertConfigs: Record<AlertData['type'], { duration: number; video: string }> = {
    follow: { duration: 6000, video: followerVideoUrl },
    subscribe: { duration: 8000, video: subscriberVideoUrl },
    sub_gift: { duration: 8000, video: subscriberVideoUrl },
    cheer: { duration: 6000, video: donationVideoUrl },
    raid: { duration: 10000, video: raidVideoUrl },
    donation: { duration: 8000, video: donationVideoUrl }
  };

  constructor() {
    this.container = document.getElementById('alert-container')!;
    this.connect();
    if (window.location.search.includes('debug')) {
      document.getElementById('debug-info')!.style.display = 'block';
    }
  }

  private connect(): void {
    const wsUrl = this.getWebSocketUrl();
    console.log('Connecting to:', wsUrl);
    this.ws = new WebSocket(wsUrl);
    this.updateStatus('Connecting...');

    this.ws.onopen = () => {
      console.log('Connected to Alert Server');
      this.updateStatus('Connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const { event: eventType, data } = JSON.parse(event.data);
        this.handleMessage(eventType, data);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
      this.updateStatus('Disconnected');
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.updateStatus('Error');
    };
  }

  private getWebSocketUrl(): string {
    const isLocal = window.location.hostname === 'localhost';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = isLocal ? 'localhost:3000' : window.location.host;
    return `${protocol}//${host}/ws`;
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.updateStatus('Failed');
      return;
    }
    this.reconnectAttempts++;
    console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.updateStatus(`Reconnecting (${this.reconnectAttempts})...`);
    setTimeout(() => this.connect(), this.reconnectDelay);
  }

  private updateStatus(status: string): void {
    const el = document.getElementById('ws-status');
    if (el) el.textContent = status;
  }

  private handleMessage(eventType: string, data: unknown): void {
    switch (eventType) {
      case 'connection:established':
        console.log('Client ID:', (data as { clientId: string }).clientId);
        break;
      case 'alert:trigger':
        this.handleAlert(data as AlertData);
        break;
      case 'alert:queue':
        console.log('Queue:', data);
        break;
    }
  }

  private async handleAlert(alert: AlertData): Promise<void> {
    if (this.isPlaying) {
      this.alertQueue.push(alert);
      return;
    }
    await this.showAlert(alert);
    if (this.alertQueue.length > 0) {
      const next = this.alertQueue.shift();
      if (next) setTimeout(() => this.showAlert(next), 500);
    }
  }

  private async showAlert(alert: AlertData): Promise<void> {
    this.isPlaying = true;
    const config = this.alertConfigs[alert.type];
    const el = this.createAlertElement(alert, config.video);
    this.container.appendChild(el);
    el.classList.add('animate-in');

    // Warte bis Video fertig ist (oder Timeout)
    const videoEl = el.querySelector<HTMLVideoElement>('video');
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, config.duration);
      if (videoEl) {
        videoEl.addEventListener('ended', () => {
          clearTimeout(timer);
          resolve();
        });
        videoEl.play().catch(() => {
          // Autoplay blockiert – Timer übernimmt
        });
      }
    });

    el.classList.remove('animate-in');
    el.classList.add('animate-out');
    await this.sleep(500);
    el.remove();
    this.isPlaying = false;

    this.ws?.send(JSON.stringify({
      event: 'alert:complete',
      data: alert.id
    }));
  }

  private createAlertElement(alert: AlertData, videoUrl: string): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = `alert alert-${alert.type}`;

    // Video-Element (enthält das eingebettete Audio)
    const video = document.createElement('video');
    video.src = videoUrl;
    video.autoplay = true;
    video.muted = false;      // Audio des Videos abspielen
    video.playsInline = true;
    video.className = 'alert-video';

    // Text-Overlay unter dem Video
    const textDiv = document.createElement('div');
    textDiv.className = 'alert-text';
    textDiv.innerHTML = this.getAlertHTML(alert);

    wrapper.appendChild(video);
    wrapper.appendChild(textDiv);
    return wrapper;
  }

  private getAlertHTML(alert: AlertData): string {
    const templates: Record<AlertData['type'], string> = {
      follow: `
        <span class="alert-icon">❤️</span>
        <p class="alert-type">Neuer Follower!</p>
        <h1>${alert.user.displayName}</h1>
        <p>Willkommen!</p>`,
      subscribe: `
        <span class="alert-icon">⭐</span>
        <p class="alert-type">Neuer Subscriber!</p>
        <h1>${alert.user.displayName}</h1>
        <p>Tier ${this.formatTier(alert.tier)}</p>`,
      sub_gift: `
        <span class="alert-icon">🎁</span>
        <p class="alert-type">Gift Subs!</p>
        <h1>${alert.user.displayName}</h1>
        <p>${alert.amount} Subs verschenkt!</p>`,
      cheer: `
        <span class="alert-icon">💎</span>
        <p class="alert-type">${alert.amount} Bits!</p>
        <h1>${alert.user.displayName}</h1>
        ${alert.message ? `<p>"${alert.message}"</p>` : ''}`,
      raid: `
        <span class="alert-icon">🚀</span>
        <p class="alert-type">RAID!</p>
        <h1>${alert.user.displayName}</h1>
        <p>${alert.viewers} Zuschauer!</p>`,
      donation: `
        <span class="alert-icon">💰</span>
        <p class="alert-type">Trinkgeld!</p>
        <h1>${alert.user.displayName}</h1>
        <p>${alert.amount} ${(alert.metadata?.currency as string) || 'EUR'}</p>
        ${alert.message ? `<p>"${alert.message}"</p>` : ''}`
    };
    return templates[alert.type] ?? templates.follow;
  }

  private formatTier(tier?: string): string {
    const map: Record<string, string> = { '1000': '1', '2000': '2', '3000': '3' };
    return map[tier ?? ''] ?? '1';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new AlertOverlay();
});
