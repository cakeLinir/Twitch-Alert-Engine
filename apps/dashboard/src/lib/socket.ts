import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@hundekuchen/shared";
import { serverUrl } from "./server-url";

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(serverUrl, {
    auth: {
        clientType: "dashboard"
    },
    transports: ["websocket"]
});