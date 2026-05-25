import { FastifyInstance } from 'fastify';

export async function overlayRoutes(fastify: FastifyInstance) {
    // Overlay-HTML für OBS Browser-Source
    fastify.get('/overlay', async (request, reply) => {
        const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>hundekuchenlive Alerts</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      width: 1920px;
      height: 1080px;
      background: transparent;
      font-family: 'Inter', system-ui, sans-serif;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    #alert-container {
      position: relative;
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    #alert-container.active {
      transform: translateY(0);
      opacity: 1;
    }
    
    .alert-box {
      background: linear-gradient(135deg, #9146ff 0%, #772ce8 100%);
      padding: 24px 40px;
      border-radius: 16px;
      text-align: center;
      box-shadow: 
        0 20px 60px rgba(145, 70, 255, 0.4),
        0 0 0 2px rgba(255,255,255,0.1) inset;
      min-width: 400px;
    }
    
    .alert-type {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: rgba(255,255,255,0.8);
      margin-bottom: 8px;
    }
    
    .alert-user {
      font-size: 32px;
      font-weight: 700;
      color: white;
      margin-bottom: 4px;
    }
    
    .alert-message {
      font-size: 18px;
      color: rgba(255,255,255,0.9);
    }
    
    .alert-amount {
      font-size: 48px;
      font-weight: 800;
      color: #ffd700;
      text-shadow: 0 2px 20px rgba(255, 215, 0, 0.5);
    }
    
    /* Animation Keyframes */
    @keyframes slideIn {
      from { transform: scale(0.8) translateY(50px); opacity: 0; }
      to { transform: scale(1) translateY(0); opacity: 1; }
    }
    
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    
    .animate-in {
      animation: slideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    
    .animate-pulse {
      animation: pulse 2s ease-in-out infinite;
    }
  </style>
</head>
<body>
  <div id="alert-container">
    <div class="alert-box">
      <div class="alert-type" id="alert-type">FOLLOW</div>
      <div class="alert-user" id="alert-user">Username</div>
      <div class="alert-message" id="alert-message">hat gefolgt!</div>
      <div class="alert-amount" id="alert-amount" style="display: none;"></div>
    </div>
  </div>

  <script>
    const wsUrl = 'ws://' + location.host + '/ws';
    let ws;
    let reconnectTimeout;

    function connect() {
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('[Overlay] Verbunden');
        ws.send(JSON.stringify({ type: 'client:ready' }));
        clearTimeout(reconnectTimeout);
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('[Overlay] Event:', data);
        
        if (data.type === 'event' && data.event === 'alert:trigger') {
          showAlert(data.payload);
        }
      };
      
      ws.onclose = () => {
        console.log('[Overlay] Verbindung verloren, reconnect...');
        reconnectTimeout = setTimeout(connect, 3000);
      };
      
      ws.onerror = (err) => {
        console.error('[Overlay] Fehler:', err);
      };
    }

    function showAlert(payload) {
      const container = document.getElementById('alert-container');
      const typeEl = document.getElementById('alert-type');
      const userEl = document.getElementById('alert-user');
      const msgEl = document.getElementById('alert-message');
      const amountEl = document.getElementById('alert-amount');

      // Typ übersetzen
      const typeNames = {
        'channel.follow': 'Neuer Follower',
        'channel.subscribe': 'Neuer Abonnent',
        'channel.subscription.gift': 'Gift Sub',
        'channel.cheer': 'Bits gespendet',
        'channel.raid': 'Raid'
      };
      
      typeEl.textContent = typeNames[payload.type] || payload.type;
      userEl.textContent = payload.userName || payload.fromBroadcasterName || 'Anonymous';

      // Spezifische Nachrichten
      if (payload.type === 'channel.follow') {
        msgEl.textContent = 'hat gefolgt!';
        amountEl.style.display = 'none';
      } else if (payload.type === 'channel.subscribe') {
        const tierNames = { '1000': 'Tier 1', '2000': 'Tier 2', '3000': 'Tier 3' };
        msgEl.textContent = \`hat \${tierNames[payload.tier] || payload.tier} abonniert!\`;
        amountEl.style.display = 'none';
      } else if (payload.type === 'channel.cheer') {
        msgEl.textContent = 'hat gecheert!';
        amountEl.textContent = payload.bits + ' Bits';
        amountEl.style.display = 'block';
      } else if (payload.type === 'channel.raid') {
        msgEl.textContent = \`raidet mit ${payload.viewers} Zuschauern!\`;
        amountEl.style.display = 'none';
      }

      // Anzeigen
      container.classList.add('active', 'animate-in');
      
      // Nach 5 Sekunden ausblenden
      setTimeout(() => {
        container.classList.remove('active');
        
        // Server informieren
        ws.send(JSON.stringify({ 
          type: 'alert:complete', 
          alertId: payload.id 
        }));
      }, 5000);
    }

    connect();
  </script>
</body>
</html>
    `;

        reply.type('text/html').send(html);
    });

    // Health Check
    fastify.get('/health', async () => {
        return { status: 'ok', timestamp: Date.now() };
    });
}
