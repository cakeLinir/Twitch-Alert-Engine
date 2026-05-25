import pino from "pino";

export const logger = pino({
    level: process.env.LOG_LEVEL ?? "info",
    base: {
        app: "hundekuchen-overlay-app"
    },
    timestamp: pino.stdTimeFunctions.isoTime
});