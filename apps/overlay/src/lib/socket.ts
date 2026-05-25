import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@hundekuchen/shared";

const serverUrl = import.meta.env.VITE_SERVER_URL ?? "http://127.0.0.1:3000";

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(serverUrl, {
    auth: {
        clientType: "overlay"
    },
    transports: ["websocket"]
});