import { FastifyInstance } from 'fastify';

export async function overlayRoutes(fastify: FastifyInstance) {
  fastify.get('/overlay', async (request, reply) => {
    const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>hundekuchenlive Alerts</title>
  <style>
    body, html { margin: 0; padding: 0; width: 1920px; height: 1080px; overflow: hidden; background: transparent; }
    #video-container { width: 100%; height: 100%; position: relative; }
    video { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; }
  </style>
</head>
<body>
  <div id="video-container"></div>
  <script>
    const videoMap = {
      'channel.follow': '/assets/alerts/Alert_Follower.mp4',
      'channel.subscribe': '/assets/alerts/Alert_Subscriber.mp4',
      'channel.raid': '/assets/alerts/Alert_Raid.mp4',
      'donation': '/assets/alerts/Alert_Donation.mp4',
      // Ergänze hier weitere, z.B. für Cheer, Gift etc.
      'channel.cheer': '/assets/alerts/Alert_Bits.mp4', // Annahme
      'channel.subscription.gift': '/assets/alerts/Alert_GiftedSub.mp4', // Annahme
    };
    
    // ... (der WebSocket-Verbindungscode von vorher bleibt identisch) ...
    function connect() {
        const ws = new WebSocket('ws://' + location.host + '/ws');
        ws.onopen = () => ws.send(JSON.stringify({ type: 'client:ready' }));
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'event' && data.event === 'alert:trigger') {
                playAlertVideo(data.payload);
            }
        };
        ws.onclose = () => setTimeout(connect, 3000);
    }

    function playAlertVideo(payload) {
      const videoSrc = videoMap[payload.type];
      if (!videoSrc) {
        console.warn('Kein Video für Alert-Typ gefunden:', payload.type);
        return;
      }
      
      const container = document.getElementById('video-container');
      const video = document.createElement('video');
      video.src = videoSrc;
      video.autoplay = true;
      
      video.onended = () => {
        container.removeChild(video);
        // Optional: Server informieren, dass Alert fertig ist
        // ws.send(JSON.stringify({ type: 'alert:complete', alertId: payload.id }));
      };

      container.innerHTML = ''; // Altes Video entfernen, falls eines hängt
      container.appendChild(video);
    }

    connect();
  </script>
</body>
</html>`;
    reply.type('text/html').send(html);
  });
}
