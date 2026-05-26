import './styles/overlay.css';

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

    private alertConfigs: Record<AlertData['type'], { duration: number; sound: string }> = {
        follow: { duration: 5000, sound: 'follow.mp3' },
        subscribe: { duration: 7000, sound: 'sub.mp3' },
        sub_gift: { duration: 8000, sound: 'gift.mp3' },
        cheer: { duration: 6000, sound: 'cheer.mp3' },
        raid: { duration: 10000, sound: 'raid.mp3' },
        donation: { duration: 8000, sound: 'donation.mp3' }
    };

    constructor() {
        this.container = document.getElementById('alert-container')!;
        this.connect();

        // Debug mode with ?debug=1
        if (window.location.search.includes('debug')) {
            document.getElementById('debug-info')!.style.display = 'block';
        }
    }

    private connect(): void {
        const wsUrl = this.getWebSocketUrl();
        console.log('🔌 Connecting to:', wsUrl);

        this.ws = new WebSocket(wsUrl);
        this.updateStatus('Connecting...');

        this.ws.onopen = () => {
            console.log('✅ Connected to Alert Server');
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
            console.log('⚠️ WebSocket closed');
            this.updateStatus('Disconnected');
            this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            this.updateStatus('Error');
        };
    }

    private getWebSocketUrl(): string {
        const isLocal = window.location.hostname === 'localhost';
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = isLocal ? 'localhost:3000' : window.location.host;
        return \`\${protocol}//\${host}/ws\`;
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.updateStatus('Failed');
      return;
    }

    this.reconnectAttempts++;
    console.log(\`🔄 Reconnecting... (attempt \${this.reconnectAttempts}/\${this.maxReconnectAttempts})\`);
    this.updateStatus(\`Reconnecting (\${this.reconnectAttempts})...\`);
    
    setTimeout(() => this.connect(), this.reconnectDelay);
  }

  private updateStatus(status: string): void {
    const el = document.getElementById('ws-status');
    if (el) el.textContent = status;
  }

  private handleMessage(eventType: string, data: any): void {
    switch (eventType) {
      case 'connection:established':
        console.log('🆔 Client ID:', data.clientId);
        break;
      case 'alert:trigger':
        this.handleAlert(data as AlertData);
        break;
      case 'alert:queue':
        console.log('📋 Queue updated:', data);
        break;
    }
  }

  private async handleAlert(alert: AlertData): Promise<void> {
    if (this.isPlaying) {
      this.alertQueue.push(alert);
      return;
    }

    await this.showAlert(alert);

    // Process queue
    if (this.alertQueue.length > 0) {
      const next = this.alertQueue.shift();
      if (next) setTimeout(() => this.showAlert(next), 500);
    }
  }

  private async showAlert(alert: AlertData): Promise<void> {
    this.isPlaying = true;
    const config = this.alertConfigs[alert.type];

    // Create alert element
    const el = this.createAlertElement(alert);
    this.container.appendChild(el);

    // Animate in
    el.classList.add('animate-in');
    
    // Play sound
    this.playSound(config.sound);

    // Wait
    await this.sleep(config.duration);

    // Animate out
    el.classList.remove('animate-in');
    el.classList.add('animate-out');

    await this.sleep(500);
    el.remove();

    this.isPlaying = false;
    
    // Notify server
    this.ws?.send(JSON.stringify({ 
      event: 'alert:complete', 
      data: alert.id 
    }));
  }

  private createAlertElement(alert: AlertData): HTMLElement {
    const div = document.createElement('div');
    div.className = \`alert alert-\${alert.type}\`;
    div.innerHTML = this.getAlertHTML(alert);
    return div;
  }

  private getAlertHTML(alert: AlertData): string {
    const templates: Record<AlertData['type'], string> = {
      follow: \`
        <div class="alert-box">
          <div class="alert-icon">❤️</div>
          <div class="alert-content">
            <div class="alert-title">Neuer Follower!</div>
            <div class="alert-user">\${alert.user.displayName}</div>
            <div class="alert-message">Willkommen! 🐕🧁</div>
          </div>
        </div>
      \`,
      subscribe: \`
        <div class="alert-box">
          <div class="alert-icon">⭐</div>
          <div class="alert-content">
            <div class="alert-title">Neuer Subscriber!</div>
            <div class="alert-user">\${alert.user.displayName}</div>
            <div class="alert-tier">Tier \${this.formatTier(alert.tier)}</div>
          </div>
        </div>
      \`,
      sub_gift: \`
        <div class="alert-box">
          <div class="alert-icon">🎁</div>
          <div class="alert-content">
            <div class="alert-title">Gift Subs!</div>
            <div class="alert-user">\${alert.user.displayName}</div>
            <div class="alert-amount">\${alert.amount} Subs geschenkt!</div>
          </div>
        </div>
      \`,
      cheer: \`
        <div class="alert-box">
          <div class="alert-icon">💎</div>
          <div class="alert-content">
            <div class="alert-title">\${alert.amount} Bits!</div>
            <div class="alert-user">\${alert.user.displayName}</div>
            \${alert.message ? \`<div class="alert-message">"\${alert.message}"</div>\` : ''}
          </div>
        </div>
      \`,
      raid: \`
        <div class="alert-box raid">
          <div class="alert-icon">🚀</div>
          <div class="alert-content">
            <div class="alert-title">RAID!</div>
            <div class="alert-user">\${alert.user.displayName}</div>
            <div class="alert-viewers">\${alert.viewers} Zuschauer!</div>
          </div>
        </div>
      \`,
      donation: \`
        <div class="alert-box donation">
          <div class="alert-icon">💰</div>
          <div class="alert-content">
            <div class="alert-title">Trinkgeld!</div>
            <div class="alert-user">\${alert.user.displayName}</div>
            <div class="alert-amount">\${alert.amount} \${alert.metadata?.currency || 'EUR'}</div>
            \${alert.message ? \`<div class="alert-message">"\${alert.message}"</div>\` : ''}
          </div>
        </div>
      \`
    };

    return templates[alert.type] || templates.follow;
  }

  private formatTier(tier?: string): string {
    const tiers: Record<string, string> = { '1000': '1', '2000': '2', '3000': '3' };
    return tiers[tier || ''] || '1';
  }

  private playSound(soundFile: string): void {
    // Sounds müssen in /assets/sounds/ liegen
    const audio = new Audio(\`/assets/sounds/\${soundFile}\`);
    audio.volume = 0.5;
    audio.play().catch(e => console.warn('Sound play failed:', e));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new AlertOverlay();
});