import { AlertsOverlay } from "./routes/AlertsOverlay";
import { ChatOverlay } from "./routes/ChatOverlay";
import { GoalsOverlay } from "./routes/GoalsOverlay";

export function App() {
    const pathname = window.location.pathname;

    if (pathname.includes("/overlay/chat")) {
        return <ChatOverlay />;
    }

    if (pathname.includes("/overlay/goals")) {
        return <GoalsOverlay />;
    }

    return <AlertsOverlay />;
}