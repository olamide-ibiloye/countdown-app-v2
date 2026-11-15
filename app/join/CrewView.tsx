"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CREW_POLL_MS,
  CREW_STALE_MS,
  crewCode,
  type CrewUpdate,
} from "@/lib/crew";
import { crewRequest, CrewRequestError } from "@/lib/crew-request";
import { clockFormat } from "@/lib/presenter";
import { AppHeader, AppMenu } from "@/components/AppHeader";
import { PresenterMessage } from "@/components/PresenterMessage";
import { presenterButton } from "../presenter/styles";

interface ReceivedUpdate extends CrewUpdate {
  receivedAt: number;
  ageAtReceipt: number;
}
export default function CrewView() {
  const params = useSearchParams();
  const requested = (params.get("code") || "").toUpperCase();
  return <EventView key={requested} requested={requested} />;
}

function EventView({ requested }: { requested: string }) {
  const router = useRouter();
  const code = crewCode.safeParse(requested).success ? requested : "";
  const [input, setInput] = useState("");
  const [formError, setFormError] = useState("");
  const [update, setUpdate] = useState<ReceivedUpdate | null>(null);
  const [error, setError] = useState("");
  const [ended, setEnded] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    let busy = false;
    let terminal = false;
    if (!code) return;
    async function refresh() {
      if (busy || terminal || document.visibilityState !== "visible") return;
      busy = true;
      const start = performance.now();
      try {
        const next = await crewRequest<CrewUpdate>("GET", undefined, code);
        const receivedAt = performance.now();
        if (active) {
          setUpdate({
            ...next,
            receivedAt,
            ageAtReceipt:
              Math.max(0, next.serverNow - next.updatedAt) +
              (receivedAt - start) / 2,
          });
          setError("");
          setTick(receivedAt);
        }
      } catch (cause) {
        if (active) {
          if (cause instanceof CrewRequestError && cause.status === 404) {
            terminal = true;
            setUpdate(null);
            setEnded(true);
          }
          setError(
            cause instanceof CrewRequestError
              ? cause.message
              : "Connection lost — time may have changed.",
          );
        }
      } finally {
        busy = false;
      }
    }
    const interval = window.setInterval(() => void refresh(), CREW_POLL_MS);
    const clock = window.setInterval(() => setTick(performance.now()), 250);
    const wake = () => {
      setTick(performance.now());
      void refresh();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    window.addEventListener("pageshow", wake);
    void refresh();
    return () => {
      active = false;
      clearInterval(interval);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("pageshow", wake);
    };
  }, [code]);

  const elapsed = update ? Math.max(0, tick - update.receivedAt) : 0;
  const age = update ? update.ageAtReceipt + elapsed : Infinity;
  const expired = Boolean(
    update && update.serverNow + elapsed >= update.expiresAt,
  );
  const stale = Boolean(update && (error || age > CREW_STALE_MS));
  const timer = update?.snapshot.timer;
  const remaining = timer
    ? Math.max(0, timer.remainingMs - (timer.phase === "running" ? age : 0))
    : 0;
  const status = timer
    ? remaining === 0
      ? "Time’s Up"
      : timer.phase === "running"
        ? "Running"
        : timer.phase === "paused"
          ? "Paused"
          : "Ready"
    : "No countdown active";
  const next = update?.snapshot.next;
  const output = update?.snapshot.output || {
    kind: timer ? "countdown" : "standby",
  };
  const clock =
    output.kind === "clock"
      ? new Date(output.timeMs + age).toLocaleTimeString("en-GB", {
          timeZone: output.timeZone,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: !output.twentyFourHours,
        })
      : "";
  const showJoin = !code || ended || expired;

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <AppHeader label="Crew view · Read only">
        <AppMenu changeEvent={Boolean(code)} />
      </AppHeader>
      <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
        {showJoin ? (
          <section className="mx-auto grid max-w-sm gap-4 rounded-xl border border-border bg-card p-6">
            <h1 className="text-2xl font-bold">Join an event</h1>
            {(ended || expired) && (
              <p role="status">
                {expired ? "This event code has expired." : error} Ask the
                operator for a new code.
              </p>
            )}
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const normalized = input.toUpperCase().replace(/[\s-]/g, "");
                if (!crewCode.safeParse(normalized).success) {
                  setFormError(
                    "Enter the eight-character event code from the operator.",
                  );
                  return;
                }
                setFormError("");
                router.replace(`/join?code=${normalized}`);
              }}
            >
              <label htmlFor="event-code" className="text-sm">
                Event code
              </label>
              <input
                id="event-code"
                value={input}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={12}
                placeholder="ABCDEFGH"
                onChange={(event) => setInput(event.target.value)}
                className="min-w-0 rounded-md border border-border bg-background p-3 font-presenter-mono text-xl uppercase tracking-widest"
              />
              <button
                className={presenterButton({ variant: "primary" })}
                type="submit"
              >
                Join event
              </button>
              {(formError || (requested && !code)) && (
                <p
                  role="alert"
                  className="text-sm text-red-700 dark:text-red-300"
                >
                  {formError || "That event code is not valid."}
                </p>
              )}
            </form>
            <p className="text-sm text-muted-foreground">
              No account needed. Keep this page open to receive updates.
            </p>
          </section>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-presenter-mono tracking-widest">
                {code}
              </span>
              <Link href="/join" className="underline">
                Change event
              </Link>
            </div>
            {!update ? (
              <p role="status" className="py-12 text-center">
                {error || "Connecting to event…"}
              </p>
            ) : (
              <>
                <div
                  role="status"
                  className={
                    stale
                      ? "mb-5 rounded-lg border border-amber-500 bg-amber-500/10 p-3 text-sm"
                      : "mb-5 text-sm text-green-800 dark:text-green-300"
                  }
                >
                  {stale
                    ? `Connection lost — time may have changed. Last updated ${Math.floor(age / 1000)} seconds ago.`
                    : "Connected · Updates every 3 seconds"}
                </div>
                <section
                  aria-label="Live output"
                  className="rounded-xl border border-border bg-card px-4 py-8 text-center"
                >
                  {output.kind === "countdown" ? (
                    <>
                      <h1 className="mb-3 break-words text-lg font-semibold">
                        {timer?.name || "Countdown"}
                      </h1>
                      <div
                        className="font-presenter-mono text-[clamp(2rem,14vw,7rem)] font-extrabold tabular-nums leading-none tracking-[-0.055em]"
                        aria-label="Time remaining"
                      >
                        {timer ? clockFormat(remaining) : "—"}
                      </div>
                      <p className="mt-5 text-lg font-semibold">{status}</p>
                    </>
                  ) : output.kind === "clock" ? (
                    <>
                      <h1 className="mb-5 text-sm text-muted-foreground">
                        Clock
                      </h1>
                      <div
                        aria-label="Live clock"
                        className="font-presenter-mono text-[clamp(1.5rem,9vw,5rem)] font-extrabold tabular-nums tracking-[-0.055em]"
                      >
                        {clock}
                      </div>
                    </>
                  ) : output.kind === "message" ? (
                    <>
                      <h1 className="mb-5 text-sm text-muted-foreground">
                        Message
                      </h1>
                      <div
                        aria-label="Live message"
                        className="font-presenter-mono text-xl leading-relaxed [overflow-wrap:anywhere] [&_blockquote]:border-s-2 [&_blockquote]:ps-3 [&_h1]:text-3xl [&_h1]:font-extrabold [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:font-bold [&_ol]:mx-auto [&_ol]:w-fit [&_ol]:list-decimal [&_ol]:ps-5 [&_ol]:text-left [&_pre]:whitespace-pre-wrap [&_ul]:mx-auto [&_ul]:w-fit [&_ul]:list-disc [&_ul]:ps-5 [&_ul]:text-left"
                      >
                        <PresenterMessage html={output.html} />
                      </div>
                    </>
                  ) : output.kind === "image" ? (
                    <>
                      <h1 className="mb-3 text-sm text-muted-foreground">
                        Image on stage
                      </h1>
                      <p className="break-words font-presenter-mono text-2xl font-bold">
                        {output.name}
                      </p>
                    </>
                  ) : (
                    <>
                      <h1 className="text-lg font-semibold">
                        Stage on standby
                      </h1>
                      {!timer && (
                        <p className="mt-3 text-muted-foreground">
                          No countdown active
                        </p>
                      )}
                    </>
                  )}
                </section>
                {output.kind !== "countdown" && timer && (
                  <section
                    aria-label="Countdown"
                    className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4"
                  >
                    <div className="min-w-0">
                      <h2 className="break-words text-sm font-semibold">
                        {timer.name}
                      </h2>
                      <p className="text-sm text-muted-foreground">{status}</p>
                    </div>
                    <span
                      aria-label="Time remaining"
                      className="font-presenter-mono text-3xl font-bold tabular-nums"
                    >
                      {clockFormat(remaining)}
                    </span>
                  </section>
                )}
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <section className="min-w-0 rounded-xl border border-border bg-card p-5">
                    <h2 className="mb-2 text-sm text-muted-foreground">
                      Current
                    </h2>
                    <p className="break-words font-semibold">
                      {update.snapshot.current?.name || "No current session"}
                    </p>
                    {update.snapshot.current?.kind === "image" && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Image
                      </p>
                    )}
                  </section>
                  <section className="min-w-0 rounded-xl border border-border bg-card p-5">
                    <h2 className="mb-2 text-sm text-muted-foreground">
                      Up next
                    </h2>
                    <p className="break-words font-semibold">
                      {next?.name || "Nothing queued"}
                    </p>
                    {next && (
                      <p className="mt-1 font-presenter-mono text-sm text-muted-foreground">
                        {next.kind === "image"
                          ? "Image"
                          : clockFormat(next.durationMs || 0)}
                      </p>
                    )}
                  </section>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
