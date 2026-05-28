import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import axios from 'axios';
import { Logger } from '@twitch-alert/utils';
import type { DonationPageConfig } from '@twitch-alert/types';

const logger = new Logger('Donations');
const router: Router = Router();

// ─── Stripe ───────────────────────────────────────────────────────────────
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20'
});

// ─── PayPal ───────────────────────────────────────────────────────────────
const PAYPAL_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

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

// ─── Donation Config ──────────────────────────────────────────────────────
const donationConfig: DonationPageConfig = {
  streamerName: 'hundekuchenlive',
  streamerAvatar: 'https://static-cdn.jtvnw.net/user-default-pictures-uv/998f01ae-def8-11e9-b95c-784f43822e80-profile_image-300x300.png',
  minAmount: 1,
  suggestedAmounts: [5, 10, 25, 50, 100],
  currency: 'EUR',
  messageEnabled: true,
  messageMaxLength: 200,
  thankYouMessage: 'Vielen Dank fuer deine Unterstuetzung!'
};

// ─── Routes ───────────────────────────────────────────────────────────────

router.get('/config', (_req: Request, res: Response) => {
  res.json({ success: true, data: donationConfig });
});

router.get('/stripe-key', (_req: Request, res: Response) => {
  const key = process.env.STRIPE_PUBLISHABLE_KEY || '';
  if (!key) return res.status(500).json({ success: false, error: 'Stripe nicht konfiguriert' });
  res.json({ success: true, publishableKey: key });
});

router.get('/paypal-client-id', (_req: Request, res: Response) => {
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  if (!clientId) return res.status(500).json({ success: false, error: 'PayPal nicht konfiguriert' });
  res.json({ success: true, clientId });
});

// Stripe: Payment Intent erstellen
router.post('/create-intent', async (req: Request, res: Response) => {
  try {
    const { amount, currency = 'EUR', donorName, donorEmail, message } = req.body;
    const amountInCents = Math.round(Number(amount));

    if (!amountInCents || amountInCents < donationConfig.minAmount * 100) {
      return res.status(400).json({
        success: false,
        error: `Mindestbetrag ist ${donationConfig.minAmount} ${donationConfig.currency}`
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency.toLowerCase(),
      metadata: { donorName: donorName || 'Anonymous', donorEmail: donorEmail || '', message: message || '' },
      receipt_email: donorEmail || undefined,
      description: `Trinkgeld für hundekuchenlive von ${donorName || 'Anonymous'}`
    });

    logger.info(`Stripe Intent: ${paymentIntent.id} | ${amountInCents / 100} ${currency} | ${donorName || 'Anonymous'}`);

    res.json({ success: true, data: { clientSecret: paymentIntent.client_secret, amount: amountInCents, currency } });
  } catch (error) {
    logger.error('Stripe Intent Fehler:', error);
    res.status(500).json({ success: false, error: 'Interner Fehler' });
  }
});

// PayPal: Order erstellen
router.post('/paypal/create-order', async (req: Request, res: Response) => {
  try {
    const { amount, currency = 'EUR', donorName, message } = req.body;
    const amountValue = (Math.round(Number(amount)) / 100).toFixed(2);

    const token = await getPayPalToken();

    const { data } = await axios.post(
      `${PAYPAL_BASE}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: currency.toUpperCase(),
            value: amountValue
          },
          description: `Trinkgeld für hundekuchenlive von ${donorName || 'Anonymous'}`,
          custom_id: JSON.stringify({ donorName: donorName || 'Anonymous', message: message || '' })
        }],
        application_context: {
          brand_name: 'hundekuchenlive',
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING'
        }
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    logger.info(`PayPal Order erstellt: ${data.id} | ${amountValue} ${currency}`);
    res.json({ success: true, orderId: data.id });
  } catch (error) {
    logger.error('PayPal Order Fehler:', error);
    res.status(500).json({ success: false, error: 'PayPal Order konnte nicht erstellt werden' });
  }
});

// PayPal: Zahlung erfassen (capture)
router.post('/paypal/capture', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ success: false, error: 'Keine Order ID' });

    const token = await getPayPalToken();

    const { data } = await axios.post(
      `${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`,
      {},
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    if (data.status === 'COMPLETED') {
      logger.info(`PayPal Capture erfolgreich: ${orderId}`);
      res.json({ success: true, data });
    } else {
      throw new Error(`Unerwarteter Status: ${data.status}`);
    }
  } catch (error) {
    logger.error('PayPal Capture Fehler:', error);
    res.status(500).json({ success: false, error: 'PayPal Capture fehlgeschlagen' });
  }
});

router.get('/recent', async (_req: Request, res: Response) => {
  res.json({ success: true, data: [] });
});

export { router as donationRoutes };
