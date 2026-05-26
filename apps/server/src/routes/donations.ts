import { Router, Request, Response } from 'express';
import { Logger } from '@twitch-alert/utils';
import type { DonationPageConfig } from '@twitch-alert/types';

const logger = new Logger('Donations');
const router: Router = Router();

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

router.get('/config', (_req: Request, res: Response) => {
  res.json({ success: true, data: donationConfig });
});

router.post('/create-intent', async (req: Request, res: Response) => {
  try {
    const { amount, currency = 'EUR', donorName } = req.body;

    if (!amount || amount < donationConfig.minAmount) {
      return res.status(400).json({
        success: false,
        error: `Mindestbetrag ist ${donationConfig.minAmount} ${donationConfig.currency}`
      });
    }

    logger.info(`Donation intent: ${amount} ${currency} by ${donorName || 'Anonymous'}`);

    res.json({
      success: true,
      data: {
        clientSecret: 'pi_test_secret_' + Date.now(),
        amount,
        currency
      }
    });
  } catch (error) {
    logger.error('Failed to create intent:', error);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

router.get('/recent', async (_req: Request, res: Response) => {
  res.json({ success: true, data: [] });
});

export { router as donationRoutes };