"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { Share2 } from "lucide-react";
import { CREW_STALE_MS } from "@/lib/crew";
import { useCrewSharing } from "./useCrewSharing";
import { presenterButton } from "./styles";

export function CrewSharing({
  sharing,
  trigger,
}: {
  sharing: ReturnType<typeof useCrewSharing>;
  trigger?: (onOpen: () => void, label: string) => ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState(false);
  const [qrError, setQrError] = useState(false);
  const [now, setNow] = useState(0);
  const session = sharing.session;
  const code = session?.code;
  const url =
    code && typeof location !== "undefined"
      ? `${location.origin}/join?code=${code}`
      : "";
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  useEffect(() => {
    if (!canvas.current || !url || !open) return;
    setQrError(false);
    void QRCode.toCanvas(canvas.current, url, {
      width: 200,
      margin: 2,
      errorCorrectionLevel: "M",
    }).catch(() => setQrError(true));
  }, [url, open]);
  const stale =
    !sharing.lastPublished || now - sharing.lastPublished > CREW_STALE_MS;
  const label = session?.pendingStop
    ? "Cancellation pending"
    : session
      ? stale
        ? "Crew sharing reconnecting"
        : "Sharing with crew"
      : "Share with crew";
  return (
    <>
      {trigger ? (
        trigger(() => setOpen(true), label)
      ) : (
        <button
          type="button"
          className={presenterButton({ variant: "quiet" })}
          onClick={() => setOpen(true)}
        >
          <Share2 size={16} />
          {label}
        </button>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="crew-sharing-title"
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
        className="m-auto w-[min(460px,92vw)] rounded-xl border border-border bg-card p-6 text-foreground backdrop:bg-black/60"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="crew-sharing-title" className="text-lg font-bold">
            Share with crew
          </h2>
          <button
            type="button"
            aria-label="Close crew sharing"
            className={presenterButton({ variant: "quiet" })}
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Crew can view the live output and current/up-next items on their
          phones. Internet is needed for sharing; the local timer works offline.
        </p>
        {session && !session.pendingStop ? (
          <div className="grid justify-items-center gap-3">
            <canvas
              ref={canvas}
              aria-label="Scan to join the crew view"
              className="rounded-lg bg-white"
            />
            {qrError && <p role="status">Use the link or event code below.</p>}
            <strong className="font-presenter-mono text-3xl tracking-widest">
              {code}
            </strong>
            <p className="text-center text-sm">
              Open{" "}
              <a
                className="underline"
                href="/join"
                target="_blank"
                rel="noreferrer"
              >
                {typeof location !== "undefined"
                  ? `${location.host}/join`
                  : "/join"}
              </a>{" "}
              and enter this code.
            </p>
            <input
              aria-label="Crew view link"
              readOnly
              value={url}
              className="w-full rounded border border-border bg-background p-2 text-sm"
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className={presenterButton()}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    setCopied(url);
                    setCopyError(false);
                  } catch {
                    setCopyError(true);
                  }
                }}
              >
                {copied === url ? "Link copied" : "Copy link"}
              </button>
              <a
                className={presenterButton()}
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                Open crew view
              </a>
              <button
                type="button"
                className={presenterButton({ variant: "danger" })}
                onClick={sharing.stop}
              >
                Stop Sharing
              </button>
            </div>
            {copyError && (
              <p role="status" className="text-sm">
                Select and copy the link above.
              </p>
            )}
            <p className="text-center text-xs text-muted-foreground">
              Read-only access for anyone with the code. Expires{" "}
              {new Date(session.expiresAt).toLocaleString()}.
            </p>
            <p role="status" className="text-sm">
              {stale ? "Waiting to reconnect…" : "Sharing is up to date"}
            </p>
          </div>
        ) : session?.pendingStop ? (
          <p role="status" className="text-sm">
            Sharing stopped on this device. Cancellation will reach the crew
            view when the connection returns. The code expires automatically
            within 24 hours.
          </p>
        ) : (
          <button
            type="button"
            disabled={sharing.busy}
            className={presenterButton({ variant: "primary" })}
            onClick={sharing.start}
          >
            {sharing.busy ? "Starting sharing…" : "Start Sharing"}
          </button>
        )}
        {sharing.error && (
          <p
            role="alert"
            className="mt-3 text-sm text-red-700 dark:text-red-300"
          >
            {sharing.error}
          </p>
        )}
      </dialog>
    </>
  );
}
