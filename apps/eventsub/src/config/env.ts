import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    // Twitch App Credentials
    TWITCH_CLIENT_ID: z.string().min(1),
    TWITCH_CLIENT_SECRET: z.string().min(1),

    // Twitch Channel (hundekuchenlive)
    TWITCH_BROADCASTER_ID: z.string().min(1),

    // Verbindung zum WebSocket-Server
    WSS_SERVER_URL: z.string().url().default('ws://localhost:8080'),

    // Optional: Login-Token für erweiterte Rechte
    TWITCH_ACCESS_TOKEN: z.string().optional(),
});

export const env = envSchema.parse(process.env);
