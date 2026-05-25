import { useEffect, useRef, useState } from "react";
import {
    ALERT_DEFINITION_BY_TYPE,
    type AlertEvent,
    type AlertMediaAsset,
    type QueueState
} from "@hundekuchen/shared";
import { socket } from "../lib/socket";

export function AlertsOverlay() {
    const [currentAlert, setCurrentAlert] = useState<AlertEvent | null>(null);
    const [queueState, setQueueState] = useState<QueueState>({
        activeAlertId: null,
        waitingCount: 0,
        overlayConnected: false
    });

    const finishTimeoutRef = useRef<number | null>(null);
    const soundDelayTimeoutRef = useRef<number | null>(null);
    const activeAudioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        socket.on("connect", () => {
            console.info("Overlay connected to server.");
        });

        socket.on("disconnect", () => {
            console.warn("Overlay disconnected from server.");
        });

        socket.on("alert:queue-state", (payload) => {
            setQueueState(payload);
        });

        socket.on("alert:show", (alert) => {
            clearAlertTimersAndAudio();

            setCurrentAlert(alert);
            playAlertSound(alert);

            finishTimeoutRef.current = window.setTimeout(() => {
                socket.emit("overlay:alert-finished", {
                    alertId: alert.id,
                    finishedAt: new Date().toISOString()
                });

                clearAlertTimersAndAudio();
                setCurrentAlert(null);
            }, alert.durationMs);
        });

        return () => {
            clearAlertTimersAndAudio();
            socket.removeAllListeners();
        };
    }, []);

    function clearAlertTimersAndAudio() {
        if (finishTimeoutRef.current) {
            window.clearTimeout(finishTimeoutRef.current);
            finishTimeoutRef.current = null;
        }

        if (soundDelayTimeoutRef.current) {
            window.clearTimeout(soundDelayTimeoutRef.current);
            soundDelayTimeoutRef.current = null;
        }

        if (activeAudioRef.current) {
            activeAudioRef.current.pause();
            activeAudioRef.current.currentTime = 0;
            activeAudioRef.current = null;
        }
    }

    function playAlertSound(alert: AlertEvent) {
        if (!alert.sound) {
            return;
        }

        const play = () => {
            const audio = new Audio(alert.sound?.url);
            audio.volume = clampVolume(alert.sound?.volume ?? 0.8);
            activeAudioRef.current = audio;

            audio.play().catch((error: unknown) => {
                console.warn("Alert sound playback was blocked or failed.", error);
            });
        };

        if (alert.sound.startDelayMs > 0) {
            soundDelayTimeoutRef.current = window.setTimeout(play, alert.sound.startDelayMs);
            return;
        }

        play();
    }

    const definition = currentAlert ? ALERT_DEFINITION_BY_TYPE[currentAlert.type] : null;
    const muteVideoAudio = Boolean(currentAlert?.sound);

    return (
        <main className="overlay-stage">
            <div className="debug-pill">
                Queue: {queueState.waitingCount} | Active: {queueState.activeAlertId ? "yes" : "no"}
            </div>

            {currentAlert && definition ? (
                <section className={`alert-card alert-${definition.accent}`}>
                    <div className="alert-border" />

                    {currentAlert.asset ? (
                        <AlertMedia asset={currentAlert.asset} muteVideoAudio={muteVideoAudio} />
                    ) : null}

                    <div className="alert-content">
                        <p className="alert-type">{definition.label}</p>

                        <h1>{currentAlert.title}</h1>

                        {currentAlert.username ? <h2>{currentAlert.username}</h2> : null}

                        {currentAlert.amount && currentAlert.currency ? (
                            <p className="alert-amount">
                                {currentAlert.amount.toFixed(2)} {currentAlert.currency}
                            </p>
                        ) : null}

                        {currentAlert.message ? <p className="alert-message">{currentAlert.message}</p> : null}

                        <p className="alert-priority">
                            Priorität {currentAlert.priority}
                            {currentAlert.sound ? ` · Sound ${Math.round(currentAlert.sound.volume * 100)}%` : ""}
                        </p>
                    </div>
                </section>
            ) : null}
        </main>
    );
}

function AlertMedia({
    asset,
    muteVideoAudio
}: {
    asset: AlertMediaAsset;
    muteVideoAudio: boolean;
}) {
    if (asset.mediaType === "video") {
        return (
            <video
                key={asset.url}
                className="alert-media"
                src={asset.url}
                autoPlay
                playsInline
                controls={false}
                muted={muteVideoAudio}
            />
        );
    }

    return <img className="alert-media" src={asset.url} alt="" />;
}

function clampVolume(volume: number): number {
    if (Number.isNaN(volume)) {
        return 0.8;
    }

    return Math.min(1, Math.max(0, volume));
}