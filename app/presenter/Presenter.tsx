"use client";

import { presenterButton } from "./styles";

import RichTextEditor from "@/components/editMessage/RichTextEditor";
import { cn } from "@/lib/utils";
import {
  ADD_TIME_MS,
  clockFormat,
  formatPresenterClock,
  parseDuration,
  remainingTime,
  type PresenterCommand,
  type PresenterEvent,
  type Session,
  type QueueItem,
  type ImageQueueItem,
  type StageOutput,
} from "@/lib/presenter";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Clock3,
  ImageIcon,
  Maximize,
  Monitor,
  MonitorOff,
  MonitorUp,
  Moon,
  Plus,
  Radio,
  Sun,
  Timer,
  Trash2,
  Type,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import ImageLibrary from "./ImageLibrary";
import { StageImage } from "./LocalImage";
import { getPresenterImage } from "@/lib/presenter-images";
import QueueMemory from "./QueueMemory";
import { StageContent, StageWindow } from "./Stage";
import { useOffline } from "./useOffline";
import { usePresenter, useStageClock } from "./usePresenter";
import { useDisplayDetails, useStageConnection } from "./useStageDisplay";

const PRESETS_KEY = "aeonPresenterPresets:v1";
const DEFAULT_PRESETS = ["03:00", "05:00", "07:00"];

function sortPresets(values: unknown[]): string[] {
  const durations = new Set<number>();
  for (const value of values) {
    const duration =
      typeof value === "string" ? parseDuration(value) : undefined;
    if (duration !== undefined) durations.add(duration);
  }
  return [...durations].sort((a, b) => a - b).map(clockFormat);
}

function addDurationSeparators(value: string): string {
  return value
    .replace(/^(\d{2})(\d{1,4})$/, "$1:$2")
    .replace(/^(\d{2}:\d{2})(\d{1,2})$/, "$1:$2");
}

function loadPresets(): string[] {
  try {
    const saved = localStorage.getItem(PRESETS_KEY);
    let values = JSON.parse(
      saved ?? localStorage.getItem("countdownPresets") ?? "null",
    );
    if (typeof values === "string") values = JSON.parse(values);
    return Array.isArray(values) ? sortPresets(values) : DEFAULT_PRESETS;
  } catch {
    return DEFAULT_PRESETS;
  }
}

type Dispatch = (command: PresenterCommand) => boolean;
type Editor = "countdown" | "clock" | "message" | "image";

function Console({
  event,
  dispatch,
  storageError,
}: {
  event: PresenterEvent;
  dispatch: Dispatch;
  storageError: boolean;
}) {
  const { timer, output, queue } = event;
  const { resolvedTheme, setTheme } = useTheme();
  const now = useStageClock(
    timer?.phase === "running" ? timer.deadline : undefined,
  );
  const offline = useOffline();
  const { details, enable, supportsPlacement } = useDisplayDetails(true);
  const stage = useStageConnection(details, now);
  const [editor, setEditor] = useState<Editor>("countdown");
  const [queuedImagePreview, setQueuedImagePreview] = useState<{
    item: ImageQueueItem;
    request: number;
  }>();
  const [imagePreviewTarget, setImagePreviewTarget] =
    useState<HTMLDivElement | null>(null);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("05:00");
  const [editing, setEditing] = useState<string>();
  const [presets, setPresets] = useState(loadPresets);
  const [twentyFourHours, setTwentyFourHours] = useState(
    output.kind === "clock" ? output.twentyFourHours : true,
  );
  const [message, setMessage] = useState(
    output.kind === "message" ? output.html : "<p></p>",
  );
  const previewOutput: StageOutput | undefined =
    editor === "clock"
      ? { kind: "clock", twentyFourHours }
      : editor === "message"
        ? { kind: "message", html: message }
        : undefined;
  const [formError, setFormError] = useState("");
  const [queueError, setQueueError] = useState("");
  const [singleScreen, setSingleScreen] = useState(false);
  const [confirm, setConfirm] = useState<
    { kind: "cue"; session: Session } | { kind: "end" }
  >();
  const [fullscreenError, setFullscreenError] = useState("");

  useEffect(() => {
    try {
      if (!localStorage.getItem(PRESETS_KEY))
        localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    } catch {
      // Presets can still be selected when storage is unavailable.
    }
  }, [presets]);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setSingleScreen(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const remaining = timer && now ? remainingTime(timer, now) : 0;
  const running = Boolean(timer?.phase === "running" && remaining > 0);
  const finished = Boolean(
    timer?.phase === "running" && remaining === 0 && now,
  );
  const currentQueueItemId =
    output.kind === "image" && output.queueItemId
      ? output.queueItemId
      : timer?.id;
  const nextIndex =
    queue.findIndex((item) => item.id === currentQueueItemId) + 1;
  const applied = stage.connected && stage.report?.revision === event.revision;
  const live =
    !stage.disconnecting &&
    applied &&
    stage.report?.fullscreen &&
    stage.onExtendedDisplay;
  const status = stage.disconnecting
    ? "Disconnecting stage"
    : live
      ? "Stage live"
      : applied
        ? stage.report?.fullscreen
          ? "Fullscreen · placement unverified"
          : "Connected · windowed"
        : stage.connected
          ? "Waiting for stage update"
          : stage.lastConfirmedAt
            ? "Stage disconnected"
            : "Stage not open";

  useEffect(() => {
    if (!singleScreen || !timer || finished) return;
    const toggle = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();
      dispatch({ type: running ? "pause" : "play" });
    };
    window.addEventListener("keydown", toggle);
    return () => window.removeEventListener("keydown", toggle);
  }, [singleScreen, timer, finished, running, dispatch]);

  function readDraft(): Session | undefined {
    const durationMs = parseDuration(duration.trim());
    if (!durationMs) {
      setFormError("Enter a duration such as 05:00 or 1:15:00.");
      return;
    }
    setFormError("");
    return {
      id: editing ?? crypto.randomUUID(),
      name: name.trim() || "Countdown",
      durationMs,
    };
  }

  async function cue(item: QueueItem) {
    setQueueError("");
    if (item.kind !== "image") {
      if (running) setConfirm({ kind: "cue", session: item });
      else dispatch({ type: "cue", session: item });
      return;
    }
    try {
      if (!(await getPresenterImage(item.imageId))) {
        setQueueError(
          "This image is no longer in the library. Remove this queue item and add the image again.",
        );
        return;
      }
      dispatch({
        type: "output",
        output: {
          kind: "image",
          imageId: item.imageId,
          name: item.name,
          fit: item.fit,
          queueItemId: item.id,
        },
      });
    } catch {
      setQueueError(
        "The image couldn’t be opened from this browser’s library.",
      );
    }
  }

  function saveSession(e: FormEvent) {
    e.preventDefault();
    const session = readDraft();
    if (!session) return;
    dispatch({
      type: "queue",
      queue: editing
        ? queue.map((item) => (item.id === editing ? session : item))
        : [...queue, session],
    });
    setEditing(undefined);
    setName("");
  }

  function editSession(session: Session) {
    setEditor("countdown");
    setEditing(session.id);
    setName(session.name);
    setDuration(clockFormat(session.durationMs));
    setFormError("");
  }

  function moveSession(index: number, offset: number) {
    const reordered = [...queue];
    [reordered[index], reordered[index + offset]] = [
      reordered[index + offset],
      reordered[index],
    ];
    dispatch({ type: "queue", queue: reordered });
  }

  function savePreset() {
    const value = parseDuration(duration.trim());
    if (!value) {
      setFormError("Enter a valid duration before saving a preset.");
      return;
    }
    const next = sortPresets([...presets, clockFormat(value)]);
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
      setPresets(next);
      setFormError("");
    } catch {
      setFormError("Your browser couldn’t save this preset.");
    }
  }

  async function openSingleScreen() {
    try {
      await document.documentElement.requestFullscreen();
      setSingleScreen(true);
      setFullscreenError("");
    } catch {
      setFullscreenError(
        "Your browser couldn’t enter fullscreen. Try the stage window instead.",
      );
    }
  }

  if (singleScreen) {
    return (
      <main className="fixed inset-0 z-[100] overflow-hidden bg-white text-white [color-scheme:light] aria-[busy=true]:bg-black dark:bg-dark-2 dark:[color-scheme:dark]">
        <StageContent event={event} now={now} />
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background text-foreground [color-scheme:light] dark:[color-scheme:dark] [&_:focus-visible]:outline [&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-[3px] [&_:focus-visible]:outline-primary dark:[&_:focus-visible]:outline-primary-contrast">
      <header className="flex min-h-[68px] flex-wrap items-center justify-between gap-3.5 border-b border-border bg-background px-[clamp(16px,4vw,56px)] py-3">
        <div className="flex flex-wrap items-center gap-[11px]">
          <span
            className="grid size-[38px] place-items-center bg-[url('../public/logo512.png')] bg-contain bg-center bg-no-repeat"
            aria-hidden="true"
          />
          <div>
            <strong>
              Aeon
              <span className="text-primary dark:text-primary-contrast">
                Timer
              </span>
            </strong>
            <span className="ml-[11px] text-[0.8rem] text-muted-foreground">
              v3
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-[9px]">
          <span
            className={cn(
              "rounded-md bg-muted px-[9px] py-[5px] text-xs font-[650] leading-normal text-muted-foreground",
              offline === "ready" &&
                "bg-[hsl(142_65%_45%/0.14)] text-green-800 dark:text-green-300",
            )}
            role="status"
          >
            {offline === "ready"
              ? "Offline ready"
              : offline === "preparing"
                ? "Preparing offline access"
                : "Offline access unavailable"}
          </span>
          <button
            type="button"
            className={presenterButton({ variant: "quiet" })}
            aria-label={
              resolvedTheme === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            {resolvedTheme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <Link
            className={presenterButton({ variant: "quiet" })}
            href="/classic"
            prefetch={false}
          >
            Switch to Classic Timer (v2)
          </Link>
        </div>
      </header>

      {storageError && (
        <p
          className="mx-[clamp(16px,4vw,56px)] my-3 text-[0.84rem] text-red-700 dark:text-red-300"
          role="alert"
        >
          Your browser couldn’t save event changes. Check that site storage is
          available.
        </p>
      )}

      <div className="mx-auto grid max-w-[1470px] grid-cols-[minmax(330px,0.92fr)_minmax(0,1.25fr)] items-start gap-5 p-[clamp(14px,3vw,38px)] max-[850px]:grid-cols-1">
        <aside
          className="sticky top-3 grid min-w-0 gap-4 max-[850px]:static"
          aria-label="Stage monitoring and live controls"
        >
          <section className="min-w-0 rounded-[14px] border border-border bg-card p-[clamp(15px,2vw,23px)] shadow-[0_1px_3px_hsl(var(--foreground)/0.05)]">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="mb-[3px] flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.095em] text-muted-foreground">
                  <Radio size={14} /> Program output
                </p>
                <h1 className="text-xl font-bold leading-normal tracking-tight">
                  On Stage
                </h1>
              </div>
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-md bg-muted px-[9px] py-[5px] text-xs font-[650] leading-normal text-muted-foreground",
                  live &&
                    "bg-[hsl(142_65%_45%/0.14)] text-green-800 dark:text-green-300",
                )}
                role="status"
              >
                <i className="size-[7px] rounded-full bg-current" />
                {status}
              </span>
            </div>
            <div
              className="relative aspect-video overflow-hidden rounded-[10px] border border-border bg-white dark:bg-dark-2"
              style={
                stage.connected && stage.report?.width && stage.report.height
                  ? {
                      aspectRatio: `${stage.report.width} / ${stage.report.height}`,
                    }
                  : undefined
              }
            >
              <StageContent event={event} now={now} preview />
              {output.kind === "standby" && (
                <span className="absolute bottom-2.5 left-2.5 text-[0.65rem] tracking-[0.12em] text-[#98a4b2]">
                  BLACK STANDBY
                </span>
              )}
            </div>
            <div className="mb-3.5 mt-[9px] flex justify-between gap-2 text-xs leading-normal text-muted-foreground">
              <span>
                {output.kind === "standby"
                  ? "Standby"
                  : output.kind === "countdown"
                    ? timer?.name
                    : output.kind === "clock"
                      ? "Clock"
                      : output.kind === "image"
                        ? output.name
                        : "Message"}
              </span>
              {stage.lastConfirmedAt && (
                <span>
                  Last confirmed{" "}
                  {new Date(stage.lastConfirmedAt).toLocaleTimeString("en-GB")}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-[9px]">
              <button
                type="button"
                className={presenterButton({ variant: "primary" })}
                disabled={stage.disconnecting}
                onClick={stage.open}
              >
                <MonitorUp size={16} /> Open Stage
              </button>
              {stage.connected && !stage.report?.fullscreen && (
                <button
                  type="button"
                  className={presenterButton()}
                  disabled={stage.disconnecting}
                  onClick={stage.fullscreen}
                >
                  <Maximize size={15} /> Fullscreen Stage
                </button>
              )}
              {(stage.connected || stage.disconnecting) && (
                <button
                  type="button"
                  className={presenterButton()}
                  disabled={stage.disconnecting}
                  onClick={stage.disconnect}
                >
                  <MonitorOff size={15} /> Disconnect Stage
                </button>
              )}
              <button
                type="button"
                className={presenterButton()}
                onClick={openSingleScreen}
                title="Space plays or pauses the timer. Escape returns to the console."
              >
                <Maximize size={15} /> Single Screen
              </button>
            </div>
            {supportsPlacement && !details && (
              <button
                type="button"
                className={presenterButton({ variant: "text" })}
                onClick={async () => {
                  if (!(await enable()))
                    stage.setHint(
                      "Display access is unavailable. You can still drag the stage window to the HDMI display.",
                    );
                }}
              >
                Enable automatic display placement
              </button>
            )}
            {!supportsPlacement && !stage.hint && (
              <p className="mt-2 text-[0.84rem] text-muted-foreground">
                This browser uses manual display placement. Open the stage, drag
                it to your extended display, and select Fullscreen there.
              </p>
            )}
            {stage.hint && !live && (
              <p className="mt-2 text-[0.84rem] text-muted-foreground">
                {stage.hint}
              </p>
            )}
            {fullscreenError && (
              <p
                className="text-[0.84rem] text-red-700 dark:text-red-300"
                role="alert"
              >
                {fullscreenError}
              </p>
            )}
          </section>

          <section className="min-w-0 rounded-[14px] border border-border bg-card p-[clamp(15px,2vw,23px)] shadow-[0_1px_3px_hsl(var(--foreground)/0.05)]">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                {editor === "countdown" && (
                  <p className="mb-[3px] flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.095em] text-muted-foreground">
                    <Timer size={14} /> Countdown
                  </p>
                )}
                <h2 className="text-xl font-bold leading-normal tracking-tight">
                  Live controls
                </h2>
              </div>
              {editor === "countdown" && timer && (
                <span className="rounded-md bg-muted px-[9px] py-[5px] text-xs font-[650] leading-normal text-muted-foreground">
                  {finished
                    ? "Finished"
                    : running
                      ? "Running"
                      : timer.phase === "paused"
                        ? "Paused"
                        : "Ready"}
                </span>
              )}
            </div>
            {editor === "countdown" &&
              (!timer ? (
                <p className="mt-2 text-[0.84rem] text-muted-foreground">
                  Send a countdown to stage to make its controls available.
                </p>
              ) : (
                <>
                  <div className="mb-[13px] mt-[9px] grid gap-0.5">
                    <span>{timer.name}</span>
                    <strong className="font-presenter-mono text-[clamp(1.7rem,4vw,2.6rem)] tabular-nums leading-[1.15] tracking-[-0.04em] text-primary dark:text-primary-foreground">
                      {finished ? "Time’s Up" : clockFormat(remaining)}
                    </strong>
                    {output.kind !== "countdown" && (
                      <span className="text-[0.84rem] text-muted-foreground">
                        Off stage
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-[9px]">
                    <button
                      type="button"
                      className={presenterButton({ variant: "primary" })}
                      disabled={finished}
                      onClick={() =>
                        dispatch({ type: running ? "pause" : "play" })
                      }
                    >
                      {running ? "Pause" : "Play"}
                    </button>
                    <button
                      type="button"
                      className={presenterButton()}
                      onClick={() => dispatch({ type: "reset" })}
                    >
                      Reset
                    </button>
                  </div>
                  <div className="mt-[11px] flex flex-wrap items-center gap-[9px] text-[0.78rem] text-muted-foreground">
                    <span>Add Time</span>
                    {ADD_TIME_MS.map((durationMs, index) => (
                      <button
                        type="button"
                        key={durationMs}
                        className={presenterButton({ size: "small" })}
                        disabled={finished}
                        onClick={() => dispatch({ type: "extend", durationMs })}
                      >
                        {["+30 sec", "+1 min", "+5 min"][index]}
                      </button>
                    ))}
                  </div>
                </>
              ))}
            {editor === "image" && <div ref={setImagePreviewTarget} />}
            {previewOutput && (
              <figure className="mt-3.5 w-[min(100%,320px)]">
                <figcaption className="mb-[3px] flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.095em] text-muted-foreground">
                  {previewOutput.kind === "clock"
                    ? "Clock preview"
                    : "Message preview"}
                </figcaption>
                {previewOutput.kind === "clock" ? (
                  <div className="mb-[13px] mt-[9px] grid gap-0.5">
                    <strong className="font-presenter-mono text-[clamp(1.7rem,4vw,2.6rem)] tabular-nums leading-[1.15] tracking-[-0.04em] text-primary dark:text-primary-foreground">
                      {now
                        ? formatPresenterClock(
                            now,
                            previewOutput.twentyFourHours,
                          )
                        : ""}
                    </strong>
                  </div>
                ) : (
                  <div className="relative aspect-video overflow-hidden rounded-[10px] border border-border bg-white dark:bg-dark-2">
                    <StageContent
                      event={{ ...event, output: previewOutput }}
                      now={now}
                      preview
                    />
                  </div>
                )}
                <button
                  type="button"
                  className={cn(
                    presenterButton({ variant: "primary" }),
                    "mt-2.5",
                  )}
                  disabled={
                    previewOutput.kind === "message" &&
                    !message.replace(/<[^>]+>/g, "").trim()
                  }
                  onClick={() =>
                    dispatch({ type: "output", output: previewOutput })
                  }
                >
                  {previewOutput.kind === "clock"
                    ? "Send Clock to Stage"
                    : "Send Message to Stage"}
                  <ArrowUpRight size={15} />
                </button>
              </figure>
            )}
            <div className="mt-3.5 flex flex-wrap items-center gap-[9px] border-t border-border pt-[13px]">
              {timer && output.kind !== "countdown" && (
                <button
                  type="button"
                  className={presenterButton()}
                  onClick={() =>
                    dispatch({
                      type: "output",
                      output: { kind: "countdown" },
                    })
                  }
                >
                  Return Timer to Stage
                </button>
              )}
              <button
                type="button"
                className={presenterButton({ variant: "quiet" })}
                disabled={output.kind === "standby"}
                onClick={() =>
                  dispatch({ type: "output", output: { kind: "standby" } })
                }
              >
                Blackout Stage
              </button>
              <button
                type="button"
                className={presenterButton({ variant: "danger" })}
                disabled={!timer && output.kind === "standby"}
                onClick={() => setConfirm({ kind: "end" })}
              >
                End Event
              </button>
            </div>
          </section>
        </aside>

        <div className="grid min-w-0 gap-4">
          <section className="min-w-0 rounded-[14px] border border-border bg-card p-[clamp(15px,2vw,23px)] shadow-[0_1px_3px_hsl(var(--foreground)/0.05)]">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="mb-[3px] flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.095em] text-muted-foreground">
                  <Monitor size={14} /> Private workspace
                </p>
                <h2 className="text-xl font-bold leading-normal tracking-tight">
                  Prepare output
                </h2>
              </div>
              <span className="rounded-md bg-muted px-[9px] py-[5px] text-xs font-[650] leading-normal text-muted-foreground">
                Off stage
              </span>
            </div>
            <div
              className="mb-4 mt-0.5 flex flex-wrap gap-[5px] rounded-[9px] bg-background p-1"
              aria-label="Output type"
            >
              {(
                [
                  { kind: "countdown", label: "Countdown", Icon: Timer },
                  { kind: "clock", label: "Clock", Icon: Clock3 },
                  { kind: "image", label: "Image", Icon: ImageIcon },
                  { kind: "message", label: "Message", Icon: Type },
                ] as const
              ).map(({ kind, label, Icon }) => (
                <button
                  type="button"
                  key={kind}
                  className={presenterButton({ variant: "tab" })}
                  aria-pressed={editor === kind}
                  onClick={() => {
                    setQueuedImagePreview(undefined);
                    setEditor(kind);
                    setFormError("");
                  }}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
            {editor === "countdown" && (
              <form
                className="grid justify-items-start gap-[13px]"
                onSubmit={saveSession}
              >
                <div className="grid w-full grid-cols-[minmax(0,2fr)_minmax(100px,1fr)] gap-3">
                  <label className="grid gap-1.5 text-[0.79rem] font-[650] text-muted-foreground">
                    Session name
                    <input
                      className="min-w-0 rounded-[7px] border border-border bg-background px-2.5 py-[9px] text-[0.9rem] text-foreground"
                      value={name}
                      maxLength={80}
                      placeholder="e.g. Opening remarks"
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <div>
                    <label className="grid gap-1.5 text-[0.79rem] font-[650] text-muted-foreground">
                      Duration
                      <input
                        className="min-w-0 rounded-[7px] border border-border bg-background px-2.5 py-[9px] text-[0.9rem] text-foreground"
                        value={duration}
                        placeholder="MM:SS or HH:MM:SS"
                        inputMode="numeric"
                        aria-describedby="aeon-duration-help"
                        onChange={(e) => {
                          const { value, selectionStart } = e.currentTarget;
                          const inputType = (e.nativeEvent as InputEvent)
                            .inputType;
                          const enteringAtEnd =
                            selectionStart === value.length &&
                            !inputType?.startsWith("delete");
                          setDuration(
                            enteringAtEnd
                              ? addDurationSeparators(value)
                              : value,
                          );
                          setFormError("");
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-[9px] text-[0.8rem] text-muted-foreground">
                  <span>Presets</span>
                  {presets.map((preset) => (
                    <button
                      type="button"
                      className={presenterButton({ size: "small" })}
                      key={preset}
                      onClick={() => setDuration(preset)}
                    >
                      {preset}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={presenterButton({ variant: "text" })}
                    onClick={savePreset}
                  >
                    <Plus size={14} /> Save preset
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-[9px]">
                  <button type="submit" className={presenterButton()}>
                    <Plus size={16} />{" "}
                    {editing ? "Save Session" : "Add to Queue"}
                  </button>
                  <button
                    type="button"
                    className={presenterButton({ variant: "primary" })}
                    onClick={() => {
                      const draft = readDraft();
                      if (draft) cue(draft);
                    }}
                  >
                    Send to Stage <ArrowUpRight size={15} />
                  </button>
                  {editing && (
                    <button
                      type="button"
                      className={presenterButton({ variant: "text" })}
                      onClick={() => {
                        setEditing(undefined);
                        setName("");
                      }}
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
                {formError && (
                  <p
                    className="text-[0.84rem] text-red-700 dark:text-red-300"
                    role="alert"
                  >
                    {formError}
                  </p>
                )}
              </form>
            )}
            {editor === "clock" && (
              <div className="grid justify-items-start gap-[13px]">
                <label className="grid gap-1.5 text-[0.79rem] font-[650] text-muted-foreground">
                  Clock format
                  <select
                    className="min-w-0 rounded-[7px] border border-border bg-background px-2.5 py-[9px] text-[0.9rem] text-foreground"
                    value={twentyFourHours ? "24" : "12"}
                    onChange={(e) =>
                      setTwentyFourHours(e.target.value === "24")
                    }
                  >
                    <option value="24">24-hour</option>
                    <option value="12">12-hour</option>
                  </select>
                </label>
              </div>
            )}
            {editor === "message" && (
              <div className="grid justify-items-start gap-[13px]">
                <div className="w-full [&_.tiptap]:min-h-[130px] [&_.tiptap]:text-foreground [&_.tiptap_h1]:text-[1.6em] [&_.tiptap_h1]:font-[750] [&_.tiptap_h2]:text-[1.35em] [&_.tiptap_h2]:font-bold [&_.tiptap_h3]:text-[1.15em] [&_.tiptap_h3]:font-bold [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:ps-[1.4em] [&_.tiptap_ul]:ps-[1.4em] [&_button[data-state=on]]:bg-primary/10 [&_button[data-state=on]]:text-primary dark:[&_button[data-state=on]]:text-primary-contrast [&_button]:text-foreground">
                  <RichTextEditor
                    message={message}
                    onChange={setMessage}
                    placeholder="Type your message here"
                  />
                </div>
              </div>
            )}
            {editor === "image" && (
              <ImageLibrary
                key={queuedImagePreview?.request ?? "library"}
                output={output}
                dispatch={dispatch}
                previewTarget={imagePreviewTarget}
                initialSelection={queuedImagePreview?.item}
              />
            )}
          </section>

          <section className="min-w-0 rounded-[14px] border border-border bg-card p-[clamp(15px,2vw,23px)] shadow-[0_1px_3px_hsl(var(--foreground)/0.05)]">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="mb-[3px] flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.095em] text-muted-foreground">
                  Run of show
                </p>
                <h2 className="text-xl font-bold leading-normal tracking-tight">
                  Session Queue
                </h2>
              </div>
              <span className="rounded-md bg-muted px-[9px] py-[5px] text-xs font-[650] leading-normal text-muted-foreground">
                {queue.length} {queue.length === 1 ? "item" : "items"}
              </span>
            </div>
            <QueueMemory
              queue={queue}
              onLoad={(loadedQueue) => {
                if (!dispatch({ type: "queue", queue: loadedQueue }))
                  return false;
                setQueueError("");
                if (editing) {
                  setEditing(undefined);
                  setName("");
                  setFormError("");
                }
                return true;
              }}
            />
            {queueError && (
              <p
                className="mb-3 text-[0.84rem] text-red-700 dark:text-red-300"
                role="alert"
              >
                {queueError}
              </p>
            )}
            {!queue.length ? (
              <div className="grid justify-items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-5 text-center text-[0.84rem] text-muted-foreground">
                <Timer size={21} />
                <strong className="text-foreground">Your queue is empty</strong>
                <span>
                  Add countdowns or library images to plan your event.
                </span>
              </div>
            ) : (
              <ol className="grid gap-2">
                {queue.map((session, index) => {
                  const current = session.id === currentQueueItemId;
                  const upNext = !current && index === nextIndex;
                  return (
                    <li
                      key={session.id}
                      aria-current={current ? "step" : undefined}
                      className={cn(
                        "flex items-center gap-[11px] rounded-lg border border-border bg-background p-[9px] max-[500px]:flex-wrap",
                        current &&
                          "border-primary bg-primary/10 shadow-[inset_3px_0_0] shadow-primary dark:border-primary-contrast dark:shadow-primary-contrast",
                        upNext &&
                          "border-dashed border-primary dark:border-primary-contrast",
                      )}
                    >
                      <span className="font-presenter-mono text-[0.8rem] tabular-nums text-primary dark:text-primary-contrast">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {session.kind === "image" && (
                        <div className="h-12 w-20 shrink-0 overflow-hidden rounded border border-border bg-black">
                          <StageImage
                            imageId={session.imageId}
                            name={session.name}
                            fit={session.fit}
                            preview
                          />
                        </div>
                      )}
                      <div className="grid min-w-0 flex-1 text-[0.87rem] [overflow-wrap:anywhere]">
                        <div className="flex flex-wrap items-center gap-[7px]">
                          <strong>{session.name}</strong>
                          {(current || upNext) && (
                            <span
                              className={cn(
                                "rounded border border-primary px-1.5 py-0.5 text-[0.68rem] font-bold text-primary dark:border-primary-contrast dark:text-primary-contrast",
                                current &&
                                  "border-transparent bg-primary text-primary-foreground dark:border-transparent dark:text-primary-foreground",
                              )}
                            >
                              {current ? "Current" : "Up next"}
                            </span>
                          )}
                        </div>
                        <span className="font-presenter-mono tabular-nums text-muted-foreground">
                          {session.kind === "image"
                            ? `Image · ${session.fit === "fit" ? "Fit" : "Fill Screen"}`
                            : clockFormat(session.durationMs)}
                        </span>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1 max-[500px]:basis-full max-[500px]:justify-start">
                        <button
                          type="button"
                          className={presenterButton({ size: "queue" })}
                          aria-label={`Move ${session.name} up`}
                          disabled={index === 0}
                          onClick={() => moveSession(index, -1)}
                        >
                          <ArrowUp size={15} />
                        </button>
                        <button
                          type="button"
                          className={presenterButton({ size: "queue" })}
                          aria-label={`Move ${session.name} down`}
                          disabled={index === queue.length - 1}
                          onClick={() => moveSession(index, 1)}
                        >
                          <ArrowDown size={15} />
                        </button>
                        <button
                          type="button"
                          className={presenterButton({ size: "queue" })}
                          aria-label={`Remove ${session.name}`}
                          onClick={() => {
                            dispatch({
                              type: "queue",
                              queue: queue.filter(
                                (item) => item.id !== session.id,
                              ),
                            });
                            setQueueError("");
                            if (editing === session.id) {
                              setEditing(undefined);
                              setName("");
                            }
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                        {session.kind !== "image" && (
                          <button
                            type="button"
                            className={presenterButton({ size: "queue" })}
                            onClick={() => editSession(session)}
                          >
                            Edit
                          </button>
                        )}
                        {session.kind === "image" && (
                          <button
                            type="button"
                            className={presenterButton({ size: "queue" })}
                            aria-label={`Preview ${session.name}`}
                            onClick={() => {
                              setQueuedImagePreview((previous) => ({
                                item: session,
                                request: (previous?.request ?? 0) + 1,
                              }));
                              setEditor("image");
                            }}
                          >
                            Preview
                          </button>
                        )}
                        <button
                          type="button"
                          className={presenterButton({ size: "queue" })}
                          aria-label={`Send ${session.name} to stage`}
                          onClick={() => cue(session)}
                        >
                          Send <ArrowUpRight size={14} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      </div>
      {confirm && (
        <ConfirmAction
          title={
            confirm.kind === "cue"
              ? "Replace the running timer?"
              : "End this event?"
          }
          description={
            confirm.kind === "cue"
              ? `${confirm.session.name} will go to stage paused. The current countdown will stop.`
              : "The stage will return to black standby. Your session queue and presets will be saved."
          }
          action={confirm.kind === "cue" ? "Replace Timer" : "End Event"}
          onClose={() => setConfirm(undefined)}
          onConfirm={() => {
            dispatch(
              confirm.kind === "cue"
                ? { type: "cue", session: confirm.session }
                : { type: "end" },
            );
            setConfirm(undefined);
          }}
        />
      )}
    </main>
  );
}

function ConfirmAction({
  title,
  description,
  action,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  action: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <dialog
      className="m-auto w-[min(430px,90vw)] rounded-xl border border-border bg-card p-[22px] text-foreground backdrop:bg-black/60"
      aria-labelledby="aeon-dialog-title"
      ref={(dialog) => {
        if (dialog && !dialog.open) dialog.showModal();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2
        className="text-xl font-bold leading-normal tracking-tight"
        id="aeon-dialog-title"
      >
        {title}
      </h2>
      <p className="mb-4 mt-2.5 text-muted-foreground">{description}</p>
      <div className="flex flex-wrap items-center gap-[9px]">
        <button type="button" className={presenterButton()} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={presenterButton({ variant: "primary" })}
          onClick={onConfirm}
        >
          {action}
        </button>
      </div>
    </dialog>
  );
}

export default function Presenter() {
  const { event, mode, dispatch, storageError } = usePresenter();
  if (!mode)
    return (
      <main
        className="fixed inset-0 z-[100] overflow-hidden bg-white text-white [color-scheme:light] aria-[busy=true]:bg-black dark:bg-dark-2 dark:[color-scheme:dark]"
        aria-busy="true"
      />
    );
  return mode === "stage" ? (
    <StageWindow event={event} storageError={storageError} />
  ) : (
    <Console event={event} dispatch={dispatch} storageError={storageError} />
  );
}
