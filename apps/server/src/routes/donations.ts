import { Router } from 'express';
import { Logger } from '@twitch-alert/utils';
import type { DonationData, DonationPageConfig } from '@twitch-alert/types';

const logger = new Logger('Donations');
const router = Router();

// Config für die Donation-Page
const donationConfig: DonationPageConfig = {
    streamerName: 'hundekuchenlive',
    minAmount: 1,
    suggestedAmounts: [5, 10, 25, 50, 100],
    currency: 'EUR',
    messageEnabled: true,
    messageMaxLength: 200,
    thankYouMessage: 'Vielen Dank für deine Unterstützung! 🐕🧁'
};

// GET /api/donations/config
router.get('/config', (req, res) => {
    res.json({
        success: true,
        data: donationConfig
    });
});

// POST /api/donations/create-intent (für Stripe)
router.post('/create-intent', async (req, res) => {
    try {
        const { amount, currency = 'EUR', message, donorName, donorEmail } = req.body;

        // Validierung
        if (!amount || amount < donationConfig.minAmount) {
            return res.status(400).json({
                success: false,
                error: `Mindestbetrag ist ${donationConfig.minAmount} ${donationConfig.currency}`
            });
        }

        // Hier würde Stripe Payment Intent erstellt werden
        // Stripe-Integration kommt im Webhook-Handler

        logger.info(`Donation intent created: ${amount} ${currency} by ${donorName}`);

        res.json({
            success: true,
            data: {
                clientSecret: 'pi_xxx_secret_xxx', // Von Stripe
                amount,
                currency
            }
        });
    } catch (error) {
        logger.error('Failed to create donation intent:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// GET /api/donations/recent
router.get('/recent', async (req, res) => {
    // Später: Aus Datenbank laden
    const recentDonations: DonationData[] = [];

    res.json({
        success: true,
        data: recentDonations
    });
});

export { router as donationRoutes };
