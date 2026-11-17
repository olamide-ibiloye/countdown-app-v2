"use client";

import { toast } from "sonner";
import { PresenterToasts } from "./PresenterToasts";
import { presenterButton } from "./styles";

import { AppHeader, AppMenu } from "@/components/AppHeader";
import RichTextEditor from "@/components/editMessage/RichTextEditor";
import {
  ADD_TIME_MS,
  clockFormat,
  parseDuration,
  PRESENTER_KEY,
  readPresenterEvent,
  remainingTime,
  type PresenterCommand,
  type PresenterEvent,
  type QueueItem,
  type Session,
  type StageOutput,
} from "@/lib/presenter";
import { getPresenterImage } from "@/lib/presenter-images";
import { cn } from "@/lib/utils";
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
  Plus,
  Radio,
  Timer,
  Trash2,
  Type,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  KeyboardShortcuts,
  isEndEventShortcut,
  useKeyboardShortcuts,
  useLearningHint,
  dismissHint,
} from "./KeyboardShortcuts";
import { CountdownControls } from "./CountdownControls";
import { CountdownSaveDialog } from "./CountdownSaveDialog";
import { CrewSharing } from "./CrewSharing";
import { DurationInput } from "./DurationInput";
import ImageLibrary from "./ImageLibrary";
import { StageImage } from "./LocalImage";
import QueueMemory from "./QueueMemory";
import { StageContent, StageWindow } from "./Stage";
import { useCrewSharing } from "./useCrewSharing";
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
  const now = useStageClock(
    timer?.phase === "running" ? timer.deadline : undefined,
  );
  const offline = useOffline();
  const crewSharing = useCrewSharing(event);
  const { details, enable, supportsPlacement } = useDisplayDetails(true);
  const stage = useStageConnection(details, now);
  const [editor, setEditor] = useState<Editor>("countdown");
  const [duration, setDuration] = useState("05:00");
  const [saveDialog, setSaveDialog] = useState<{
    duration: string;
    session?: Session;
  }>();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [selectedQueueId, setSelectedQueueId] = useState<string>();
  const presetHint = useLearningHint("aeon:preset-double-click:v1");
  const spaceHint = useLearningHint("aeon:space-tip:v1");
  const [highlightedQueueId, setHighlightedQueueId] = useState<string>();
  const [presets, setPresets] = useState(loadPresets);
  const [twentyFourHours, setTwentyFourHours] = useState(
    output.kind === "clock" ? output.twentyFourHours : true,
  );
  const [message, setMessage] = useState(
    output.kind === "message" ? output.html : "<p></p>",
  );
  const [formError, setFormError] = useState("");
  const [singleScreen, setSingleScreen] = useState(false);
  const [confirm, setConfirm] = useState<
    | { kind: "cue"; session: Session; preset?: boolean }
    | { kind: "end" }
    | { kind: "reset" }
  >();

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

  useEffect(() => {
    if (!highlightedQueueId) return;
    const timeout = window.setTimeout(
      () => setHighlightedQueueId(undefined),
      3000,
    );
    return () => clearTimeout(timeout);
  }, [highlightedQueueId]);

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

  function readDraft(): Session | undefined {
    const durationMs = parseDuration(duration.trim());
    if (!durationMs) {
      setFormError("Enter a duration such as 05:00 or 1:15:00.");
      return;
    }
    setFormError("");
    return {
      id: crypto.randomUUID(),
      name: "Countdown",
      durationMs,
    };
  }

  function showOutput(nextOutput: StageOutput) {
    return dispatch({ type: "output", output: nextOutput });
  }

  async function cue(item: QueueItem, preset = false) {
    if (item.kind !== "image") {
      if (running) setConfirm({ kind: "cue", session: item, preset });
      else if (dispatch({ type: "cue", session: item }) && preset)
        dismissHint("aeon:preset-double-click:v1");
      return;
    }
    try {
      if (!(await getPresenterImage(item.imageId))) {
        toast.error(
          "This image is no longer in the library. Remove this queue item and add the image again.",
        );
        return;
      }
      showOutput({
        kind: "image",
        imageId: item.imageId,
        name: item.name,
        fit: item.fit,
        queueItemId: item.id,
      });
    } catch {
      toast.error("The image couldn’t be opened from this browser’s library.");
    }
  }

  async function restoreOutput() {
    const previous = event.blackoutOutput;
    if (!previous) return;
    if (previous.kind === "image") {
      try {
        if (!(await getPresenterImage(previous.imageId))) {
          toast.error(
            "The previous image is no longer in the library. Import it again or show another output.",
          );
          return;
        }
        const latest = readPresenterEvent(localStorage.getItem(PRESENTER_KEY));
        if (
          latest.output.kind !== "standby" ||
          JSON.stringify(latest.blackoutOutput) !== JSON.stringify(previous)
        )
          return;
      } catch {
        toast.error(
          "The previous image couldn’t be opened. Try showing another output.",
        );
        return;
      }
    }
    dispatch({ type: "restore" });
  }

  function editSession(session: Session) {
    setSaveDialog({
      duration: clockFormat(session.durationMs),
      session,
    });
  }

  function saveCountdownItem(value: {
    name: string;
    durationMs: number;
  }): string | undefined {
    if (!saveDialog) return "Open the save dialog again.";
    const existing = saveDialog.session;
    if (
      existing &&
      !queue.some((item) => item.id === existing.id && item.kind !== "image")
    )
      return "This session is no longer in the queue. Close this dialog and add it again.";
    const session = {
      id: existing?.id ?? crypto.randomUUID(),
      name: value.name,
      durationMs: value.durationMs,
    };
    const saved = existing
      ? dispatch({
          type: "queue",
          queue: queue.map((item) =>
            item.id === existing.id ? session : item,
          ),
        })
      : dispatch({ type: "enqueue", item: session });
    if (!saved)
      return "The session couldn’t be saved. Check that browser storage is available.";

    setHighlightedQueueId(session.id);
    toast.success(
      existing
        ? `Updated “${value.name}” in the queue.`
        : `Added “${value.name}” to the queue.`,
    );
  }

  const quickDurationMs = parseDuration(duration.trim());
  const durationIsPreset =
    quickDurationMs !== undefined &&
    presets.some((preset) => parseDuration(preset) === quickDurationMs);

  function savePreset() {
    if (quickDurationMs === undefined || durationIsPreset) return;
    const preset = clockFormat(quickDurationMs);
    const next = sortPresets([...presets, preset]);
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
      setPresets(next);
      setFormError("");
      toast.success(`${preset} preset saved.`);
    } catch {
      toast.error("Your browser couldn’t save this preset.");
    }
  }

  function moveSession(index: number, offset: number) {
    const reordered = [...queue];
    [reordered[index], reordered[index + offset]] = [
      reordered[index + offset],
      reordered[index],
    ];
    dispatch({ type: "queue", queue: reordered });
  }

  async function openSingleScreen() {
    try {
      await document.documentElement.requestFullscreen();
      toast.dismiss();
      setSingleScreen(true);
    } catch {
      toast.error(
        "Your browser couldn’t enter fullscreen. Try the stage window instead.",
      );
    }
  }

  function resetCountdown() {
    if (output.kind !== "countdown" || !timer || timer.phase === "ready")
      return;
    if (running) setConfirm({ kind: "reset" });
    else dispatch({ type: "reset" });
  }

  useKeyboardShortcuts((key) => {
    if (confirm || saveDialog || shortcutsOpen) return;
    const countdown = output.kind === "countdown" && timer && !finished;
    if (singleScreen && key.code !== "Space") return;
    if (isEndEventShortcut(key)) {
      if (!timer && output.kind === "standby" && !event.blackoutOutput) return;
      key.preventDefault();
      setConfirm({ kind: "end" });
    } else if (key.code === "Space" && countdown) {
      key.preventDefault();
      dispatch({ type: running ? "pause" : "play" });
    } else if (key.key === "?") {
      key.preventDefault();
      setShortcutsOpen(true);
    } else if (
      key.shiftKey &&
      ["Digit1", "Digit2", "Digit3"].includes(key.code)
    ) {
      if (!countdown) return;
      key.preventDefault();
      dispatch({
        type: "extend",
        durationMs: ADD_TIME_MS[Number(key.code.slice(-1)) - 1],
      });
    } else if (!key.shiftKey && ["1", "2", "3", "4"].includes(key.key)) {
      key.preventDefault();
      setEditor(
        (["countdown", "clock", "image", "message"] as const)[
          Number(key.key) - 1
        ],
      );
      setFormError("");
    } else if (key.key.toLowerCase() === "r" && !key.shiftKey) {
      if (output.kind === "countdown" && timer) {
        key.preventDefault();
        resetCountdown();
      }
    } else if (key.key.toLowerCase() === "b" && !key.shiftKey) {
      key.preventDefault();
      if (output.kind === "standby") void restoreOutput();
      else if (dispatch({ type: "blackout" }))
        toast.info("Stage blacked out · B to restore");
    } else if (key.key.toLowerCase() === "f" && !key.shiftKey) {
      key.preventDefault();
      if (stage.connected) stage.fullscreen();
      else toast.info("Open Stage first to use fullscreen.");
    } else if (
      (key.key === "ArrowUp" || key.key === "ArrowDown") &&
      queue.length
    ) {
      key.preventDefault();
      const index = queue.findIndex((item) => item.id === selectedQueueId);
      const next =
        index < 0
          ? key.key === "ArrowDown"
            ? 0
            : queue.length - 1
          : Math.max(
              0,
              Math.min(
                queue.length - 1,
                index + (key.key === "ArrowDown" ? 1 : -1),
              ),
            );
      setSelectedQueueId(queue[next].id);
      const row = document.querySelector<HTMLElement>(
        `[data-queue-id="${CSS.escape(queue[next].id)}"]`,
      );
      row?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: "nearest" });
    } else if (key.key === "Enter") {
      const item = queue.find((item) => item.id === selectedQueueId);
      if (item) {
        key.preventDefault();
        void cue(item);
      }
    }
  });

  if (singleScreen) {
    return (
      <main className="fixed inset-0 z-[100] overflow-hidden bg-white text-white [color-scheme:light] aria-[busy=true]:bg-black dark:bg-dark-2 dark:[color-scheme:dark]">
        <StageContent event={event} now={now} />
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background text-foreground [color-scheme:light] dark:[color-scheme:dark] [&_:focus-visible]:outline [&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-[3px] [&_:focus-visible]:outline-primary dark:[&_:focus-visible]:outline-primary-contrast">
      <PresenterToasts />
      <AppHeader>
        <Link
          className={presenterButton({ variant: "quiet" })}
          href="/classic"
          prefetch={false}
        >
          <span className="max-sm:sr-only">Switch to </span>Classic (v2)
        </Link>
        <CrewSharing
          sharing={crewSharing}
          trigger={(onOpen, label) => (
            <AppMenu
              onShortcuts={() => setShortcutsOpen(true)}
              sharing={{ label, onOpen }}
              offline={
                <span
                  className={
                    offline === "ready"
                      ? "text-green-800 dark:text-green-300"
                      : "text-muted-foreground"
                  }
                >
                  {offline === "ready"
                    ? "Offline ready"
                    : offline === "preparing"
                      ? "Preparing offline access"
                      : "Offline access unavailable"}
                </span>
              }
            />
          )}
        />
      </AppHeader>

      {storageError && (
        <p
          className="mx-[clamp(16px,4vw,56px)] my-3 text-[0.84rem] text-red-700 dark:text-red-300"
          role="alert"
        >
          Your browser couldn’t save event changes. Check that site storage is
          available.
        </p>
      )}

      <div className="mx-auto grid max-w-[1470px] grid-cols-[minmax(0,1.25fr)_minmax(330px,0.92fr)] items-start gap-5 p-[clamp(14px,3vw,38px)] max-[850px]:grid-cols-1">
        <div className="grid min-w-0 gap-4 max-[850px]:order-2">
          <section className="min-w-0 rounded-[14px] border border-border bg-card p-[clamp(15px,2vw,23px)] shadow-[0_1px_3px_hsl(var(--foreground)/0.05)]">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="mb-[3px] flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.095em] text-muted-foreground">
                  <Monitor size={14} /> Private workspace
                </p>
                <h2 className="text-xl font-bold leading-normal tracking-tight">
                  {editor === "countdown"
                    ? "Quick countdown"
                    : "Prepare output"}
                </h2>
              </div>
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
                className="grid justify-items-start gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const draft = readDraft();
                  if (draft) void cue(draft);
                }}
              >
                <div
                  className="grid w-full gap-1.5"
                  role="group"
                  aria-label="Presets"
                >
                  <span className="text-[0.79rem] font-[650] text-muted-foreground">
                    Presets
                  </span>
                  {presetHint && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Double-click a preset to show it on stage.</span>
                      <button
                        type="button"
                        aria-label="Dismiss preset tip"
                        onClick={() =>
                          dismissHint("aeon:preset-double-click:v1")
                        }
                      >
                        ×
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-[9px]">
                    {presets.map((preset) => (
                      <button
                        type="button"
                        className={cn(
                          presenterButton({ size: "small" }),
                          "aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary dark:aria-pressed:text-primary-contrast",
                        )}
                        key={preset}
                        onDoubleClick={() =>
                          void cue(
                            {
                              id: crypto.randomUUID(),
                              name: "Countdown",
                              durationMs: parseDuration(preset)!,
                            },
                            true,
                          )
                        }
                        aria-pressed={
                          parseDuration(duration.trim()) ===
                          parseDuration(preset)
                        }
                        onClick={() => {
                          setDuration(preset);
                          setFormError("");
                        }}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid w-full grid-cols-[minmax(0,220px)_minmax(0,1fr)] items-end gap-3 max-[600px]:grid-cols-1">
                  <DurationInput
                    value={duration}
                    onChange={(value) => {
                      setDuration(value);
                      setFormError("");
                    }}
                  />
                  <div className="flex flex-wrap gap-[9px]">
                    <button
                      type="button"
                      className={presenterButton({ variant: "quiet" })}
                      disabled={
                        quickDurationMs === undefined || durationIsPreset
                      }
                      title={
                        durationIsPreset
                          ? "This duration is already saved as a preset"
                          : undefined
                      }
                      onClick={savePreset}
                    >
                      <Plus size={14} /> Save Preset
                    </button>
                    <button
                      type="button"
                      className={presenterButton()}
                      onClick={() => {
                        setSaveDialog({ duration });
                      }}
                    >
                      <Plus size={16} /> Add to Queue
                    </button>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <button
                    type="submit"
                    className={presenterButton({ variant: "primary" })}
                  >
                    Show Countdown <ArrowUpRight size={15} />
                  </button>
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
                <div className="grid gap-1.5 text-[0.79rem] font-[650] text-muted-foreground">
                  <label htmlFor="presenter-clock-format">Clock format</label>
                  <select
                    id="presenter-clock-format"
                    className="min-w-0 rounded-[7px] border border-border bg-background px-2.5 py-[9px] text-[0.9rem] text-foreground"
                    value={twentyFourHours ? "24" : "12"}
                    onChange={(e) =>
                      setTwentyFourHours(e.target.value === "24")
                    }
                  >
                    <option value="24">24-hour</option>
                    <option value="12">12-hour</option>
                  </select>
                </div>
                <button
                  type="button"
                  className={presenterButton({ variant: "primary" })}
                  onClick={() => showOutput({ kind: "clock", twentyFourHours })}
                >
                  Show Clock <ArrowUpRight size={15} />
                </button>
              </div>
            )}
            {editor === "message" && (
              <div className="grid justify-items-start gap-[13px]">
                <div className="w-full space-y-4 [&_.tiptap]:min-h-[130px] [&_.tiptap]:text-foreground [&_.tiptap_h1]:text-[1.6em] [&_.tiptap_h1]:font-[750] [&_.tiptap_h2]:text-[1.35em] [&_.tiptap_h2]:font-bold [&_.tiptap_h3]:text-[1.15em] [&_.tiptap_h3]:font-bold [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:ps-[1.4em] [&_.tiptap_ul]:ps-[1.4em] [&_button[data-state=on]]:bg-primary/10 [&_button[data-state=on]]:text-primary dark:[&_button[data-state=on]]:text-primary-contrast [&_button]:text-foreground">
                  <RichTextEditor
                    message={message}
                    onChange={setMessage}
                    placeholder="Type your message here"
                  />
                </div>
                <button
                  type="button"
                  className={presenterButton({ variant: "primary" })}
                  disabled={!message.replace(/<[^>]+>/g, "").trim()}
                  onClick={() =>
                    dispatch({
                      type: "output",
                      output: { kind: "message", html: message },
                    })
                  }
                >
                  Show Message <ArrowUpRight size={15} />
                </button>
              </div>
            )}
            {editor === "image" && (
              <ImageLibrary
                output={output}
                dispatch={(command) =>
                  command.type === "output"
                    ? showOutput(command.output)
                    : dispatch(command)
                }
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

                setHighlightedQueueId(undefined);
                return true;
              }}
            />
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
                      data-queue-id={session.id}
                      tabIndex={
                        selectedQueueId === session.id ||
                        (!queue.some((item) => item.id === selectedQueueId) &&
                          index === 0)
                          ? 0
                          : -1
                      }
                      onFocus={() => setSelectedQueueId(session.id)}
                      onClick={() => setSelectedQueueId(session.id)}
                      aria-current={current ? "step" : undefined}
                      className={cn(
                        "flex items-center gap-[11px] rounded-lg border border-border bg-background p-[9px] max-[500px]:flex-wrap",
                        selectedQueueId === session.id &&
                          "ring-2 ring-foreground/50 ring-offset-2 ring-offset-background",
                        current &&
                          "border-primary bg-primary/10 shadow-[inset_3px_0_0] shadow-primary dark:border-primary-contrast dark:shadow-primary-contrast",
                        upNext &&
                          "border-dashed border-primary dark:border-primary-contrast",
                        highlightedQueueId === session.id &&
                          "outline outline-2 outline-offset-2 outline-primary",
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

                            if (highlightedQueueId === session.id)
                              setHighlightedQueueId(undefined);
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

        <aside
          className="sticky top-3 grid min-w-0 gap-4 max-[850px]:static max-[850px]:order-1"
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
            {output.kind === "image" && (
              <fieldset className="mt-3.5 border-t border-border pt-3.5">
                <legend className="text-sm font-semibold">Image display</legend>
                <div className="flex flex-wrap gap-[9px]">
                  {(["fit", "fill"] as const).map((fit) => (
                    <button
                      type="button"
                      key={fit}
                      className={cn(
                        presenterButton(),
                        "aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary dark:aria-pressed:text-primary-contrast",
                      )}
                      aria-pressed={output.fit === fit}
                      onClick={() =>
                        dispatch({
                          type: "image-fit",
                          imageId: output.imageId,
                          fit,
                        })
                      }
                    >
                      {fit === "fit" ? "Fit" : "Fill Screen"}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {output.kind === "countdown" && timer && (
              <CountdownControls
                timer={timer}
                now={now}
                dispatch={dispatch}
                onReset={resetCountdown}
                onMouseToggle={() => {
                  if (!spaceHint) return;
                  dismissHint("aeon:space-tip:v1");
                  toast.info("Tip: press Space to pause or resume.", {
                    action: { label: "Dismiss", onClick: () => {} },
                  });
                }}
              />
            )}
          </section>

          <section
            aria-label="Screen controls and setup"
            className="min-w-0 rounded-[14px] border border-border bg-card p-[clamp(15px,2vw,23px)] shadow-[0_1px_3px_hsl(var(--foreground)/0.05)]"
          >
            <h2 className="mb-3.5 text-xl font-bold leading-normal tracking-tight">
              Screen controls &amp; setup
            </h2>
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
            <div className="mt-3.5 flex flex-wrap gap-[9px] border-t border-border pt-3.5">
              <button
                type="button"
                className={presenterButton({ variant: "quiet" })}
                disabled={output.kind === "standby"}
                onClick={() => {
                  dispatch({ type: "blackout" });
                }}
              >
                Blackout Stage
              </button>
              {output.kind === "standby" && event.blackoutOutput && (
                <button
                  type="button"
                  className={presenterButton()}
                  onClick={() => void restoreOutput()}
                >
                  Restore Previous Output
                </button>
              )}
              <button
                type="button"
                className={presenterButton({ variant: "danger" })}
                disabled={
                  !timer && output.kind === "standby" && !event.blackoutOutput
                }
                onClick={() => setConfirm({ kind: "end" })}
              >
                End Event
              </button>
            </div>
          </section>
        </aside>
      </div>
      {shortcutsOpen && (
        <KeyboardShortcuts onClose={() => setShortcutsOpen(false)} />
      )}
      {saveDialog && (
        <CountdownSaveDialog
          initialDuration={saveDialog.duration}
          initialName={saveDialog.session?.name}
          editing={Boolean(saveDialog.session)}
          onSave={saveCountdownItem}
          onClose={() => setSaveDialog(undefined)}
        />
      )}
      {confirm && (
        <ConfirmAction
          title={
            confirm.kind === "cue"
              ? "Replace the running timer?"
              : confirm.kind === "reset"
                ? "Reset the running timer?"
                : "End this event?"
          }
          description={
            confirm.kind === "cue"
              ? `${confirm.session.name} will be shown ready to start. The current countdown will stop.`
              : confirm.kind === "reset"
                ? "The countdown will stop and return to its original duration, ready to start."
                : "The stage will return to black standby. Your session queue and presets will be saved."
          }
          action={
            confirm.kind === "cue"
              ? "Replace Timer"
              : confirm.kind === "reset"
                ? "Reset Timer"
                : "End Event"
          }
          onClose={() => setConfirm(undefined)}
          onConfirm={() => {
            const saved = dispatch(
              confirm.kind === "cue"
                ? { type: "cue", session: confirm.session }
                : { type: confirm.kind === "reset" ? "reset" : "end" },
            );

            if (saved && confirm.kind === "cue" && confirm.preset)
              dismissHint("aeon:preset-double-click:v1");
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
