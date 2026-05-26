import Fastify from 'fastify';
import axios from 'axios';
import { WebSocketBroadcaster } from './websocket/broadcaster.js';
import { DonationAlert } from '@hundekuchenlive/shared';

// --- Config (vereinfacht, für vollwertige App in eigene Datei) ---
const PORT = process.env.PAYPAL_PORT || '9090';
const PAYPAL_API_URL = 'https://api-m.sandbox.paypal.com'; // oder 'https://api-m.paypal.com' für live
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;
const WSS_SERVER_URL = process.env.WSS_SERVER_URL || 'ws://localhost:8080';

// --- PayPal Auth ---
async function getPayPalAccessToken() {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    const response = await axios.post(`${PAYPAL_API_URL}/v1/oauth2/token`, 'grant_type=client_credentials', {
        headers: { 'Authorization': `Basic ${auth}` }
    });
    return response.data.access_token;
}

// --- Webhook Verification ---
async function verifyPayPalWebhook(accessToken, headers, body) {
    try {
        const verificationResponse = await axios.post(
            `${PAYPAL_API_URL}/v1/notifications/verify-webhook-signature`,
            {
                auth_algo: headers['paypal-auth-algo'],
                cert_url: headers['paypal-cert-url'],
                transmission_id: headers['paypal-transmission-id'],
                transmission_sig: headers['paypal-transmission-sig'],
                transmission_time: headers['paypal-transmission-time'],
                webhook_id: PAYPAL_WEBHOOK_ID,
                webhook_event: body,
            },
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        return verificationResponse.data.verification_status === 'SUCCESS';
    } catch (error) {
        console.error('PayPal Webhook verification failed:', error.response?.data || error.message);
        return false;
    }
}

// --- MAIN ---
async function main() {
    const server = Fastify();
    const broadcaster = new WebSocketBroadcaster(WSS_SERVER_URL);
    await broadcaster.connect();

    console.log('🚀 PayPal Service startet...');

    server.post('/webhooks/paypal', async (request, reply) => {
        const accessToken = await getPayPalAccessToken();
        const isValid = await verifyPayPalWebhook(accessToken, request.headers, request.body);

        if (!isValid) {
            console.warn('[PayPal] Ungültiger Webhook empfangen.');
            return reply.code(400).send({ status: 'ignored', reason: 'invalid signature' });
        }

        const event = request.body as any;
        // CHECKOUT.ORDER.COMPLETED ist das Event für eine abgeschlossene Zahlung
        if (event.event_type === 'CHECKOUT.ORDER.COMPLETED' && event.resource?.status === 'COMPLETED') {
            const purchaseUnit = event.resource.purchase_units[0];
            const payer = event.resource.payer;

            const alert: DonationAlert = {
                id: `donation-${event.id}`,
                timestamp: Date.now(),
                type: 'donation',
                from: `${payer.name.given_name} ${payer.name.surname}`,
                amount: parseFloat(purchaseUnit.amount.value),
                currency: purchaseUnit.amount.currency_code,
                message: purchaseUnit.description || 'Spende!', // Oft steht hier eine Nachricht
            };

            console.log(`[PayPal] Spende erhalten: ${alert.from} - ${alert.amount} ${alert.currency}`);
            broadcaster.broadcast('alert:trigger', alert);
        }

        reply.code(200).send({ status: 'received' });
    });

    await server.listen({ port: parseInt(PORT), host: '0.0.0.0' });
    console.log(`✅ PayPal Webhook Listener läuft auf Port ${PORT}`);
}

main().catch(console.error);

// Der WebSocketBroadcaster in 'apps/paypal-service/src/websocket/broadcaster.js' ist identisch
// mit dem aus 'apps/eventsub' und kann wiederverwendet werden.
