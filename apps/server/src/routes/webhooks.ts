import { Router, Request, Response, raw } from 'express';
import Stripe from 'stripe';
import axios from 'axios';
import { Logger } from '@twitch-alert/utils';
import { generateId } from '@twitch-alert/utils';
import type { AlertServer } from '../websocket/AlertServer.js';

const logger = new Logger('Webhooks');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20'
});

const PAYPAL_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

export function createWebhookRoutes(alertServer: AlertServer): Router {
  const router = Router();

  // ─── Stripe Webhook ─────────────────────────────────────────────────────
  router.post('/stripe', raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
    } catch (err) {
      logger.error('Stripe Signaturprüfung fehlgeschlagen:', err);
      return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      const donorName = pi.metadata.donorName || 'Anonymous';
      const message = pi.metadata.message || undefined;

      logger.info(`✅ Stripe Donation: ${pi.amount / 100} EUR von ${donorName}`);

      await alertServer.triggerAlert({
        id: generateId(),
        type: 'donation',
        timestamp: new Date().toISOString(),
        user: { name: donorName, displayName: donorName },
        amount: pi.amount / 100,
        message,
        metadata: { currency: 'EUR', provider: 'stripe', paymentIntentId: pi.id }
      });
    }

    res.json({ received: true });
  });

  // ─── PayPal Webhook ──────────────────────────────────────────────────────
  router.post('/paypal', async (req: Request, res: Response) => {
    try {
      // Sandbox: Signatur-Verifikation überspringen (für Produktion aktivieren)
      if (process.env.PAYPAL_MODE === 'live') {
        const valid = await verifyPayPalWebhook(req);
        if (!valid) {
          logger.warn('PayPal Webhook Signatur ungültig');
          return res.status(400).json({ error: 'Invalid signature' });
        }
      }

      const eventType = req.body?.event_type;
      logger.info(`PayPal Event: ${eventType}`);

      if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
        const capture = req.body.resource;
        const amountValue = parseFloat(capture?.amount?.value || '0');
        const customId = capture?.custom_id || '{}';

        let donorName = 'Anonymous';
        let message: string | undefined;

        try {
          const meta = JSON.parse(customId);
          donorName = meta.donorName || 'Anonymous';
          message = meta.message || undefined;
        } catch { /* custom_id war kein JSON */ }

        logger.info(`✅ PayPal Donation: ${amountValue} EUR von ${donorName}`);

        await alertServer.triggerAlert({
          id: generateId(),
          type: 'donation',
          timestamp: new Date().toISOString(),
          user: { name: donorName, displayName: donorName },
          amount: amountValue,
          message,
          metadata: { currency: 'EUR', provider: 'paypal', captureId: capture?.id }
        });
      }

      res.sendStatus(200);
    } catch (error) {
      logger.error('PayPal Webhook Fehler:', error);
      res.status(500).json({ error: 'Internal error' });
    }
  });

  return router;
}

async function verifyPayPalWebhook(req: Request): Promise<boolean> {
  try {
    const token = await getPayPalToken();
    const { data } = await axios.post(
      `${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`,
      {
        auth_algo: req.headers['paypal-auth-algo'],
        cert_url: req.headers['paypal-cert-url'],
        transmission_id: req.headers['paypal-transmission-id'],
        transmission_sig: req.headers['paypal-transmission-sig'],
        transmission_time: req.headers['paypal-transmission-time'],
        webhook_id: process.env.PAYPAL_WEBHOOK_ID || '',
        webhook_event: req.body
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return data.verification_status === 'SUCCESS';
  } catch {
    return false;
  }
}

async function getPayPalToken(): Promise<string> {
  const { data } = await axios.post(
    `${PAYPAL_BASE}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      auth: {
        username: process.env.PAYPAL_CLIENT_ID || '',
        password: process.env.PAYPAL_CLIENT_SECRET || ''
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }
  );
  return data.access_token;
}
