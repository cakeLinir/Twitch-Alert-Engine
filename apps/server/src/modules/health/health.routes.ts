import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
    app.get("/health", async () => {
        return {
            status: "ok",
            service: "hundekuchen-overlay-app",
            uptimeSeconds: Math.round(process.uptime()),
            timestamp: new Date().toISOString()
        };
    });
};