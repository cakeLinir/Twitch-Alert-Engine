import { Router } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

// GET /api/config/themes
router.get('/themes', (req, res) => {
    try {
        const themesPath = join(__dirname, '../../../../data/assets/themes/manifest.json');
        const manifest = JSON.parse(readFileSync(themesPath, 'utf-8'));

        res.json({
            success: true,
            data: manifest
        });
    } catch (error) {
        res.json({
            success: true,
            data: {
                themes: [
                    {
                        id: 'default',
                        name: 'Standard',
                        version: '1.0.0',
                        variables: {
                            '--alert-bg': 'rgba(145, 71, 255, 0.95)',
                            '--alert-text': '#ffffff',
                            '--accent-color': '#00d4aa'
                        }
                    }
                ],
                defaultTheme: 'default'
            }
        });
    }
});

export { router as configRoutes };
