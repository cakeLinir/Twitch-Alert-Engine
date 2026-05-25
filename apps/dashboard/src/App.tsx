import { useEffect, useState } from "react";
import {
    ALERT_DEFINITIONS,
    type AlertAssetManifestResponse,
    type AlertDefinition,
    type QueueState,
    type TestAlertInput
} from "@hundekuchen/shared";
import { serverUrl } from "./lib/server-url";
import { socket } from "./lib/socket";

type ConnectionState = "connecting" | "connected" | "disconnected";

interface LogEntry {
    id: string;
    message: string;
    timestamp: string;
}

export function App() {
    const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
    const [queueState, setQueueState] = useState<QueueState>({
        activeAlertId: null,
        waitingCount: 0,
        overlayConnected: false
    });
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [assetManifest, setAssetManifest] = useState<AlertAssetManifestResponse | null>(null);
    const [assetManifestError, setAssetManifestError] = useState<string | null>(null);

    useEffect(() => {
        function addLog(message: string) {
            setLogs((currentLogs) => [
                {
                    id: crypto.randomUUID(),
                    message,
                    timestamp: new Date().toLocaleTimeString("de-DE")
                },
                ...currentLogs
            ]);
        }

        socket.on("connect", () => {
            setConnectionState("connected");
            addLog("Dashboard mit Server verbunden.");
        });

        socket.on("disconnect", () => {
            setConnectionState("disconnected");
            addLog("Dashboard vom Server getrennt.");
        });

        socket.on("system:status", (payload) => {
            addLog(`Serverstatus: ${payload.status} um ${payload.timestamp}`);
        });

        socket.on("alert:queue-state", (payload) => {
            setQueueState(payload);
        });

        void loadAssetManifest();

        return () => {
            socket.removeAllListeners();
        };
    }, []);

    async function loadAssetManifest() {
        try {
            setAssetManifestError(null);

            const response = await fetch(`${serverUrl}/api/alerts/assets`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const manifest = (await response.json()) as AlertAssetManifestResponse;
            setAssetManifest(manifest);
        } catch (error) {
            setAssetManifestError(error instanceof Error ? error.message : "Unknown asset manifest error");
        }
    }

    function triggerTestAlert(definition: AlertDefinition) {
        const input: TestAlertInput = {
            type: definition.type,
            username: createDemoUsername(definition.type),
            title: definition.label,
            message: definition.defaultMessage,
            durationMs: definition.defaultDurationMs,
            ...(definition.type === "donation"
                ? {
                    amount: 5,
                    currency: "EUR"
                }
                : {})
        };

        socket.emit("dashboard:test-alert", input, (response) => {
            setLogs((currentLogs) => [
                {
                    id: crypto.randomUUID(),
                    message: response.ok
                        ? `${definition.label}-Alert erstellt: ${response.alertId}`
                        : `Fehler: ${response.error}`,
                    timestamp: new Date().toLocaleTimeString("de-DE")
                },
                ...currentLogs
            ]);
        });
    }

    return (
        <main className="dashboard-shell">
            <section className="hero-card">
                <p className="eyebrow">hundekuchen-overlay-app</p>
                <h1>Alert Engine Dashboard</h1>
                <p className="description">
                    Phase 2.3: Visual Assets, Sound Assets, Lautstärke und Timing.
                </p>
            </section>

            <section className="grid">
                <article className="panel">
                    <h2>Status</h2>
                    <dl className="status-list">
                        <div>
                            <dt>Realtime</dt>
                            <dd className={`badge badge-${connectionState}`}>{connectionState}</dd>
                        </div>
                        <div>
                            <dt>Overlay</dt>
                            <dd className={`badge ${queueState.overlayConnected ? "badge-connected" : "badge-disconnected"}`}>
                                {queueState.overlayConnected ? "connected" : "missing"}
                            </dd>
                        </div>
                        <div>
                            <dt>Aktiver Alert</dt>
                            <dd>{queueState.activeAlertId ?? "keiner"}</dd>
                        </div>
                        <div>
                            <dt>Warteschlange</dt>
                            <dd>{queueState.waitingCount}</dd>
                        </div>
                    </dl>
                </article>

                <article className="panel">
                    <h2>Asset Manifest</h2>
                    <p>
                        Der Server scannt <code>data/assets/alerts</code> und erkennt visuelle Assets sowie
                        optionale Sounddateien.
                    </p>
                    <button type="button" onClick={() => void loadAssetManifest()}>
                        Asset-Status aktualisieren
                    </button>
                    {assetManifestError ? <p className="error-text">{assetManifestError}</p> : null}
                </article>
            </section>

            <section className="panel">
                <h2>Asset-Status</h2>

                {assetManifest ? (
                    <div className="asset-table-wrapper">
                        <table className="asset-table">
                            <thead>
                                <tr>
                                    <th>Alert</th>
                                    <th>Visual</th>
                                    <th>Aktive Visual-Datei</th>
                                    <th>Sound</th>
                                    <th>Aktive Sound-Datei</th>
                                </tr>
                            </thead>
                            <tbody>
                                {assetManifest.items.map((item) => (
                                    <tr key={item.type}>
                                        <td>
                                            <strong>{item.label}</strong>
                                            <small>{item.expectedBaseName}</small>
                                        </td>
                                        <td>
                                            <span className={`badge ${item.missing ? "badge-disconnected" : "badge-connected"}`}>
                                                {item.missing ? "fehlt" : "gefunden"}
                                            </span>
                                        </td>
                                        <td>
                                            {item.resolvedAsset?.fileName ?? "Fallback-Card"}
                                            <small>{item.availableAssets.length} Datei(en)</small>
                                        </td>
                                        <td>
                                            <span className={`badge ${item.soundMissing ? "badge-connecting" : "badge-connected"}`}>
                                                {item.soundMissing ? "optional fehlt" : "gefunden"}
                                            </span>
                                        </td>
                                        <td>
                                            {item.resolvedSound?.fileName ?? "MP4-Ton oder kein Sound"}
                                            <small>
                                                {item.resolvedSound
                                                    ? `Volume ${Math.round(item.resolvedSound.volume * 100)}%`
                                                    : `${item.availableSoundAssets.length} Sounddatei(en)`}
                                            </small>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p>Asset-Manifest wird geladen.</p>
                )}
            </section>

            <section className="panel">
                <h2>Test-Alerts</h2>
                <div className="alert-test-grid">
                    {ALERT_DEFINITIONS.map((definition) => (
                        <button
                            key={definition.type}
                            type="button"
                            className={`alert-test-button accent-${definition.accent}`}
                            onClick={() => triggerTestAlert(definition)}
                        >
                            <span>{definition.label}</span>
                            <small>Priorität {definition.priority}</small>
                        </button>
                    ))}
                </div>
            </section>

            <section className="panel">
                <h2>Lokale Logs</h2>
                <ul className="log-list">
                    {logs.map((log) => (
                        <li key={log.id}>
                            <span>{log.timestamp}</span>
                            <p>{log.message}</p>
                        </li>
                    ))}
                </ul>
            </section>
        </main>
    );
}

function createDemoUsername(type: AlertDefinition["type"]): string {
    switch (type) {
        case "donation":
            return "SupporterMax";
        case "raid":
            return "RaiderCrew";
        case "gift_sub":
            return "GiftMaster";
        case "prime_sub":
            return "PrimeWolf";
        case "resub":
            return "TreuerSub";
        case "sub":
            return "SubWolf";
        case "cheer":
            return "BitsBomber";
        case "channel_points":
            return "PunkteHeld";
        case "follow":
            return "NeuerFollower";
        case "chat_highlight":
            return "ChatVIP";
        case "test":
            return "hundekuchenlive";
        default:
            return "hundekuchenlive";
    }
}