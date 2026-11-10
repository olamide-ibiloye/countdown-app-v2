"use client";

import RichTextEditor from "@/components/editMessage/RichTextEditor";
import {
    ADD_TIME_MS,
    clockFormat,
    parseDuration,
    remainingTime,
    type PresenterCommand,
    type PresenterEvent,
    type Session,
} from "@/lib/presenter";
import {
    ArrowDown,
    ArrowUp,
    ArrowUpRight,
    Clock3,
    Maximize,
    Monitor,
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
import "./presenter.css";
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
type Editor = "countdown" | "clock" | "message";

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
  const { details, enable } = useDisplayDetails(true);
  const stage = useStageConnection(details, now);
  const [editor, setEditor] = useState<Editor>("countdown");
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
  const [formError, setFormError] = useState("");
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
  const nextIndex = queue.findIndex((session) => session.id === timer?.id) + 1;
  const applied = stage.connected && stage.report?.revision === event.revision;
  const live = applied && stage.report?.fullscreen && stage.onExtendedDisplay;
  const status = live
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

  function cue(session: Session) {
    if (running) setConfirm({ kind: "cue", session });
    else dispatch({ type: "cue", session });
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
      setFormError("Chrome could not save this preset.");
    }
  }

  async function openSingleScreen() {
    try {
      await document.documentElement.requestFullscreen();
      setSingleScreen(true);
      setFullscreenError("");
    } catch {
      setFullscreenError(
        "Chrome couldn’t enter fullscreen. Try the stage window instead.",
      );
    }
  }

  if (singleScreen) {
    return (
      <main className="aeon-stage-window">
        <StageContent event={event} now={now} />
      </main>
    );
  }

  return (
    <main className="aeon-presenter">
      <header className="aeon-header">
        <div className="aeon-brand">
          <span className="aeon-brand-mark" aria-hidden="true" />
          <div>
            <strong>
              Aeon<span className="aeon-brand-accent">Timer</span>
            </strong>
            <span className="aeon-version">v3</span>
          </div>
        </div>
        <div className="aeon-header-actions">
          <span
            className={`aeon-offline ${offline === "ready" ? "aeon-online" : ""}`}
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
            className="aeon-button aeon-quiet"
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
          <Link className="aeon-button aeon-quiet" href="/" prefetch={false}>
            Classic v2 <ArrowUpRight size={14} />
          </Link>
        </div>
      </header>

      {storageError && (
        <p className="aeon-error aeon-global-error" role="alert">
          Chrome could not save event changes. Check that site storage is
          available.
        </p>
      )}

      <div className="aeon-workspace">
        <aside
          className="aeon-live-column"
          aria-label="Stage monitoring and live controls"
        >
          <section className="aeon-panel">
            <div className="aeon-panel-heading">
              <div>
                <p className="aeon-kicker">
                  <Radio size={14} /> Program output
                </p>
                <h1>On Stage</h1>
              </div>
              <span
                className={`aeon-status ${live ? "aeon-online" : ""}`}
                role="status"
              >
                <i />
                {status}
              </span>
            </div>
            <div
              className="aeon-preview"
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
                <span className="aeon-standby-label">BLACK STANDBY</span>
              )}
            </div>
            <div className="aeon-preview-caption">
              <span>
                {output.kind === "standby"
                  ? "Standby"
                  : output.kind === "countdown"
                    ? timer?.name
                    : output.kind === "clock"
                      ? "Clock"
                      : "Message"}
              </span>
              {stage.lastConfirmedAt && (
                <span>
                  Last confirmed{" "}
                  {new Date(stage.lastConfirmedAt).toLocaleTimeString("en-GB")}
                </span>
              )}
            </div>
            <div className="aeon-actions">
              <button
                type="button"
                className="aeon-button aeon-primary"
                onClick={stage.open}
              >
                <MonitorUp size={16} /> Open Stage Display
              </button>
              <button
                type="button"
                className="aeon-button"
                onClick={openSingleScreen}
                title="Space plays or pauses the timer. Escape returns to the console."
              >
                <Maximize size={15} /> Single Screen
              </button>
            </div>
            {!details && (
              <button
                type="button"
                className="aeon-text-button"
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
            {stage.hint && !live && <p className="aeon-note">{stage.hint}</p>}
            {fullscreenError && (
              <p className="aeon-error" role="alert">
                {fullscreenError}
              </p>
            )}
          </section>

          <section className="aeon-panel">
            <div className="aeon-panel-heading">
              <div>
                <p className="aeon-kicker">
                  <Timer size={14} /> Countdown
                </p>
                <h2>Live controls</h2>
              </div>
              {timer && (
                <span className="aeon-chip">
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
            {!timer ? (
              <p className="aeon-note">
                Send a countdown to stage to make its controls available.
              </p>
            ) : (
              <>
                <div className="aeon-live-timer">
                  <span>{timer.name}</span>
                  <strong>
                    {finished ? "Time’s Up" : clockFormat(remaining)}
                  </strong>
                  {output.kind !== "countdown" && (
                    <span className="aeon-muted">Off stage</span>
                  )}
                </div>
                <div className="aeon-actions">
                  <button
                    type="button"
                    className="aeon-button aeon-primary"
                    disabled={finished}
                    onClick={() =>
                      dispatch({ type: running ? "pause" : "play" })
                    }
                  >
                    {running ? "Pause" : "Play"}
                  </button>
                  <button
                    type="button"
                    className="aeon-button"
                    onClick={() => dispatch({ type: "reset" })}
                  >
                    Reset
                  </button>
                  {output.kind !== "countdown" && (
                    <button
                      type="button"
                      className="aeon-button"
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
                </div>
                <div className="aeon-add-time">
                  <span>Add Time</span>
                  {ADD_TIME_MS.map((durationMs, index) => (
                    <button
                      type="button"
                      key={durationMs}
                      className="aeon-button"
                      disabled={!running}
                      onClick={() => dispatch({ type: "extend", durationMs })}
                    >
                      {["+30 sec", "+1 min", "+5 min"][index]}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="aeon-actions aeon-safety-actions">
              <button
                type="button"
                className="aeon-button aeon-quiet"
                disabled={output.kind === "standby"}
                onClick={() =>
                  dispatch({ type: "output", output: { kind: "standby" } })
                }
              >
                Blackout Stage
              </button>
              <button
                type="button"
                className="aeon-button aeon-danger"
                disabled={!timer && output.kind === "standby"}
                onClick={() => setConfirm({ kind: "end" })}
              >
                End Event
              </button>
            </div>
          </section>
        </aside>

        <div className="aeon-planning-column">
          <section className="aeon-panel">
            <div className="aeon-panel-heading">
              <div>
                <p className="aeon-kicker">
                  <Monitor size={14} /> Private workspace
                </p>
                <h2>Prepare output</h2>
              </div>
              <span className="aeon-chip">Off stage</span>
            </div>
            <div className="aeon-tabs" aria-label="Output type">
              {(
                [
                  { kind: "countdown", label: "Countdown", Icon: Timer },
                  { kind: "clock", label: "Clock", Icon: Clock3 },
                  { kind: "message", label: "Message", Icon: Type },
                ] as const
              ).map(({ kind, label, Icon }) => (
                <button
                  type="button"
                  key={kind}
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
              <form className="aeon-editor" onSubmit={saveSession}>
                <div className="aeon-fields">
                  <label>
                    Session name
                    <input
                      value={name}
                      maxLength={80}
                      placeholder="e.g. Opening remarks"
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <div>
                    <label>
                      Duration
                      <input
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
                <div className="aeon-presets">
                  <span>Presets</span>
                  {presets.map((preset) => (
                    <button
                      type="button"
                      className="aeon-button"
                      key={preset}
                      onClick={() => setDuration(preset)}
                    >
                      {preset}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="aeon-text-button"
                    onClick={savePreset}
                  >
                    <Plus size={14} /> Save preset
                  </button>
                </div>
                <div className="aeon-actions">
                  <button type="submit" className="aeon-button">
                    <Plus size={16} />{" "}
                    {editing ? "Save Session" : "Add to Queue"}
                  </button>
                  <button
                    type="button"
                    className="aeon-button aeon-primary"
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
                      className="aeon-text-button"
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
                  <p className="aeon-error" role="alert">
                    {formError}
                  </p>
                )}
              </form>
            )}
            {editor === "clock" && (
              <div className="aeon-editor">
                <label>
                  Clock format
                  <select
                    value={twentyFourHours ? "24" : "12"}
                    onChange={(e) =>
                      setTwentyFourHours(e.target.value === "24")
                    }
                  >
                    <option value="24">24-hour</option>
                    <option value="12">12-hour</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="aeon-button aeon-primary"
                  onClick={() =>
                    dispatch({
                      type: "output",
                      output: { kind: "clock", twentyFourHours },
                    })
                  }
                >
                  Send Clock to Stage <ArrowUpRight size={15} />
                </button>
              </div>
            )}
            {editor === "message" && (
              <div className="aeon-editor">
                <div className="aeon-rich-editor">
                  <RichTextEditor message={message} onChange={setMessage} />
                </div>
                <button
                  type="button"
                  className="aeon-button aeon-primary"
                  disabled={!message.replace(/<[^>]+>/g, "").trim()}
                  onClick={() =>
                    dispatch({
                      type: "output",
                      output: { kind: "message", html: message },
                    })
                  }
                >
                  Send Message to Stage <ArrowUpRight size={15} />
                </button>
              </div>
            )}
          </section>

          <section className="aeon-panel">
            <div className="aeon-panel-heading">
              <div>
                <p className="aeon-kicker">Run of show</p>
                <h2>Session Queue</h2>
              </div>
              <span className="aeon-chip">
                {queue.length} {queue.length === 1 ? "session" : "sessions"}
              </span>
            </div>
            <QueueMemory
              queue={queue}
              onLoad={(loadedQueue) => {
                if (!dispatch({ type: "queue", queue: loadedQueue }))
                  return false;
                if (editing) {
                  setEditing(undefined);
                  setName("");
                  setFormError("");
                }
                return true;
              }}
            />
            {!queue.length ? (
              <div className="aeon-empty">
                <Timer size={21} />
                <strong>Your queue is empty</strong>
                <span>Add a countdown to plan the order of your sessions.</span>
              </div>
            ) : (
              <ol className="aeon-queue">
                {queue.map((session, index) => (
                  <li key={session.id}>
                    <span className="aeon-order">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="aeon-session">
                      <strong>{session.name}</strong>
                      <span>
                        {clockFormat(session.durationMs)}
                        {session.id === timer?.id
                          ? " · Current"
                          : index === nextIndex
                            ? " · Up next"
                            : ""}
                      </span>
                    </div>
                    <div className="aeon-queue-actions">
                      <button
                        type="button"
                        className="aeon-button aeon-icon"
                        aria-label={`Move ${session.name} up`}
                        disabled={index === 0}
                        onClick={() => moveSession(index, -1)}
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        className="aeon-button aeon-icon"
                        aria-label={`Move ${session.name} down`}
                        disabled={index === queue.length - 1}
                        onClick={() => moveSession(index, 1)}
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        type="button"
                        className="aeon-button aeon-icon"
                        aria-label={`Remove ${session.name}`}
                        onClick={() => {
                          dispatch({
                            type: "queue",
                            queue: queue.filter(
                              (item) => item.id !== session.id,
                            ),
                          });
                          if (editing === session.id) {
                            setEditing(undefined);
                            setName("");
                          }
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                      <button
                        type="button"
                        className="aeon-button"
                        onClick={() => editSession(session)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="aeon-button"
                        aria-label={`Send ${session.name} to stage`}
                        onClick={() => cue(session)}
                      >
                        Send <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </li>
                ))}
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
      className="aeon-dialog"
      aria-labelledby="aeon-dialog-title"
      ref={(dialog) => {
        if (dialog && !dialog.open) dialog.showModal();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2 id="aeon-dialog-title">{title}</h2>
      <p>{description}</p>
      <div className="aeon-actions">
        <button type="button" className="aeon-button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="aeon-button aeon-primary"
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
  if (!mode) return <main className="aeon-stage-window" aria-busy="true" />;
  return mode === "stage" ? (
    <StageWindow event={event} storageError={storageError} />
  ) : (
    <Console event={event} dispatch={dispatch} storageError={storageError} />
  );
}
