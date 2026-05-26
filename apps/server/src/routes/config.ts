import { Router, Request, Response } from 'express';

const router: Router = Router();

router.get('/themes', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      themes: [{
        id: 'default',
        name: 'Standard',
        variables: { '--alert-bg': '#9147ff', '--alert-text': '#ffffff' }
      }],
      defaultTheme: 'default'
    }
  });
});

export { router as configRoutes };