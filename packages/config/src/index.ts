import { z } from "zod";

const configSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    SERVER_HOST: z.string().default("127.0.0.1"),
    SERVER_PORT: z.coerce.number().int().positive().default(3000),
    PUBLIC_BASE_URL: z.string().url().default("http://127.0.0.1:3000"),

    DASHBOARD_ORIGIN: z.string().url().default("http://127.0.0.1:5173"),
    OVERLAY_ORIGIN: z.string().url().default("http://127.0.0.1:5174"),

    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info")
});

function loadConfigFromEnv() {
    const parsedConfig = configSchema.safeParse(process.env);

    if (!parsedConfig.success) {
        const formattedErrors = JSON.stringify(parsedConfig.error.flatten().fieldErrors, null, 2);

        throw new Error(`Invalid environment configuration:\n${formattedErrors}`);
    }

    return parsedConfig.data;
}

const env = loadConfigFromEnv();

export const config = {
    nodeEnv: env.NODE_ENV,
    publicBaseUrl: env.PUBLIC_BASE_URL,
    server: {
        host: env.SERVER_HOST,
        port: env.SERVER_PORT
    },
    cors: {
        dashboardOrigin: env.DASHBOARD_ORIGIN,
        overlayOrigin: env.OVERLAY_ORIGIN
    },
    logging: {
        level: env.LOG_LEVEL
    }
} as const;

export type AppConfig = typeof config;