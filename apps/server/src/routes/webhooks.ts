import { Router, raw, Request, Response } from 'express';
import { Logger } from '@twitch-alert/utils';

const logger = new Logger('Webhooks');
const router: Router = Router();

router.post('/stripe', raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    logger.info('Stripe webhook received');
    res.json({ received: true });
  } catch (error) {
    logger.error('Stripe webhook error:', error);
    res.status(400).send('Webhook Error');
  }
});

router.post('/paypal', async (req: Request, res: Response) => {
  try {
    logger.info('PayPal webhook received:', req.body.event_type);
    res.sendStatus(200);
  } catch (error) {
    logger.error('PayPal webhook error:', error);
    res.status(500).send('Error');
  }
});

export { router as webhookRoutes };