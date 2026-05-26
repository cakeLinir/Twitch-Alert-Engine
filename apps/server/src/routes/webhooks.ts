import { Router, raw } from 'express';
import Stripe from 'stripe';
import crypto from 'crypto';
import { Logger } from '@twitch-alert/utils';
import type { AlertData, DonationData } from '@twitch-alert/types';
import { randomUUID } from 'crypto';

const logger = new Logger('Webhooks');
const router = Router();

// Stripe initialisieren
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2024-04-10'
});

// ============================================
// STRIPE WEBHOOK
// ============================================

// WICHTIG: raw body für Stripe Signature Verification
router.post(
    '/stripe',
    raw({ type: 'application/json' }),
    async (req, res) => {
        const sig = req.headers['stripe-signature'] as string;
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

        let event: Stripe.Event;

        try {
            if (!endpointSecret) {
                throw new Error('STRIPE_WEBHOOK_SECRET nicht konfiguriert');
            }

            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } catch (err: any) {
            logger.error('Stripe Webhook Error:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        // Handle events
        switch (event.type) {
            case 'payment_intent.succeeded':
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                await handleSuccessfulPayment(paymentIntent, 'stripe');
                break;

            case 'payment_intent.payment_failed':
                const failedPayment = event.data.object as Stripe.PaymentIntent;
                logger.warn(`Payment failed: ${failedPayment.id}`);
                break;

            default:
                logger.debug(`Unhandled Stripe event type: ${event.type}`);
        }

        res.json({ received: true });
    }
);

// ============================================
// PAYPAL WEBHOOK
// ============================================

router.post('/paypal', express.json(), async (req, res) => {
    try {
        // PayPal Webhook Verification
        const transmissionId = req.headers['paypal-transmission-id'] as string;
        const certId = req.headers['paypal-cert-id'] as string;
        const authAlgo = req.headers['paypal-auth-algo'] as string;
        const transmissionTime = req.headers['paypal-transmission-time'] as string;
        const signature = req.headers['paypal-transmission-sig'] as string;

        const webhookId = process.env.PAYPAL_WEBHOOK_ID;

        if (!webhookId) {
            throw new Error('PAYPAL_WEBHOOK_ID nicht konfiguriert');
        }

        // PayPal Webhook Verifikation (vereinfacht - in Produktion: API-Call zu PayPal)
        const isValid = await verifyPayPalWebhook(req.body, {
            transmissionId,
            certId,
            authAlgo,
            transmissionTime,
            signature,
            webhookId
        });

        if (!isValid) {
            logger.error('PayPal webhook verification failed');
            return res.status(400).send('Invalid signature');
        }

        const eventType = req.body.event_type;

        switch (eventType) {
            case 'PAYMENT.CAPTURE.COMPLETED':
                await handlePayPalPaymentCompleted(req.body.resource);
                break;

            case 'PAYMENT.CAPTURE.DENIED':
                logger.warn('PayPal payment denied:', req.body.resource.id);
                break;

            default:
                logger.debug(`Unhandled PayPal event: ${eventType}`);
        }

        res.sendStatus(200);
    } catch (error) {
        logger.error('PayPal webhook error:', error);
        res.status(500).send('Internal error');
    }
});

// ============================================
// HANDLER FUNCTIONS
// ============================================

async function handleSuccessfulPayment(
    paymentIntent: Stripe.PaymentIntent,
    provider: 'stripe' | 'paypal'
): Promise<void> {
    // Metadaten aus Payment Intent extrahieren
    const metadata = paymentIntent.metadata;

    const donation: DonationData = {
        id: randomUUID(),
        provider,
        amount: paymentIntent.amount / 100, // Cent zu Euro
        currency: paymentIntent.currency.toUpperCase(),
        donorName: metadata.donor_name || 'Anonymous',
        donorEmail: metadata.donor_email,
        message: metadata.message || undefined,
        isAnonymous: metadata.is_anonymous === 'true',
        timestamp: new Date().toISOString(),
        status: 'completed'
    };

    // Alert erstellen
    const alert: AlertData = {
        id: donation.id,
        type: 'donation',
        timestamp: donation.timestamp,
        user: {
            name: donation.donorName.toLowerCase().replace(/\s/g, ''),
            displayName: donation.donorName,
            avatar: 'https://static-cdn.jtvnw.net/user-default-pictures-uv/998f01ae-def8-11e9-b95c-784f43822e80-profile_image-300x300.png'
        },
        amount: donation.amount,
        message: donation.message,
        metadata: { currency: donation.currency }
    };

    // Alert triggern (über globalen AlertServer oder Event Emitter)
    // In der Praxis: Event Emitter oder direkter Import
    logger.info(`🎉 Donation received: ${donation.amount} ${donation.currency} from ${donation.donorName}`);

    // Hier: AlertServer.triggerAlert(alert) aufrufen
    // Dazu brauchen wir eine Referenz zum AlertServer
}

async function handlePayPalPaymentCompleted(resource: any): Promise<void> {
    // Ähnlich wie Stripe Handler
    const amount = parseFloat(resource.amount.value);
    const currency = resource.amount.currency_code;

    // Custom ID für Metadaten
    const customId = resource.custom_id;
    const metadata = customId ? JSON.parse(Buffer.from(customId, 'base64').toString()) : {};

    const donation: DonationData = {
        id: randomUUID(),
        provider: 'paypal',
        amount,
        currency,
        donorName: metadata.donor_name || 'Anonymous',
        donorEmail: metadata.donor_email,
        message: metadata.message,
        isAnonymous: metadata.is_anonymous === 'true',
        timestamp: new Date().toISOString(),
        status: 'completed'
    };

    logger.info(`🎉 PayPal Donation: ${amount} ${currency}`);

    // Alert triggern...
}

async function verifyPayPalWebhook(
    body: any,
    headers: any
): Promise<boolean> {
    // In Produktion: POST zu https://api.paypal.com/v1/notifications/verify-webhook-signature
    // Für Entwicklung: simulierte Validierung
    return true;
}

export { router as webhookRoutes };
