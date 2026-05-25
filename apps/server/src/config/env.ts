import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    PORT: z.string().default('8080'),
    HOST: z.string().default('0.0.0.0'),
    CORS_ORIGIN: z.string().default('*'),
    STATIC_PATH: z.string().default('../../data/assets/alerts'),
});

export const env = envSchema.parse(process.env);
