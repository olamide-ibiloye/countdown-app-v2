"use client";

import { presenterButton } from "./styles";

import { useId, useState, type FormEvent } from "react";
import { FolderOpen, Save } from "lucide-react";
import { isSession, type Session } from "@/lib/presenter";

const QUEUE_MEMORY_KEY = "aeonPresenterQueues:v1";

interface SavedQueue {
  name: string;
  sessions: Session[];
}

function readMemory(): SavedQueue[] {
  const raw = localStorage.getItem(QUEUE_MEMORY_KEY);
  if (!raw) return [];
  const saved: SavedQueue[] = JSON.parse(raw);
  if (
    !Array.isArray(saved) ||
    !saved.every(
      (item) =>
        item &&
        typeof item.name === "string" &&
        Array.isArray(item.sessions) &&
        item.sessions.length > 0 &&
        item.sessions.every(isSession),
    )
  )
    throw new Error("Saved queues are invalid");
  return saved;
}

export default function QueueMemory({
  queue,
  onLoad,
}: {
  queue: Session[];
  onLoad: (queue: Session[]) => boolean;
}) {
  const titleId = useId();
  const [mode, setMode] = useState<"save" | "load">();
  const [saved, setSaved] = useState<SavedQueue[]>([]);
  const [name, setName] = useState("");
  const [selection, setSelection] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const matchingName = name.trim().toLowerCase();
  const overwrite = saved.some(
    (item) => item.name.toLowerCase() === matchingName,
  );

  function open(nextMode: "save" | "load") {
    setStatus("");
    setError("");
    try {
      const memory = readMemory();
      setSaved(memory);
      setName("");
      setSelection(memory[0]?.name ?? "");
      setMode(nextMode);
    } catch {
      setError("Saved queues couldn’t be read from this browser.");
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === "save") {
      const trimmed = name.trim();
      if (!trimmed || !queue.length) return;
      try {
        const memory = readMemory();
        const index = memory.findIndex(
          (item) => item.name.toLowerCase() === matchingName,
        );
        if (index !== -1 && !overwrite) {
          setSaved(memory);
          setError(
            "That name is already saved. Choose another name or update the saved queue.",
          );
          return;
        }
        const item = { name: trimmed, sessions: queue };
        if (index === -1) memory.push(item);
        else memory[index] = item;
        localStorage.setItem(QUEUE_MEMORY_KEY, JSON.stringify(memory));
        setStatus(`Saved “${trimmed}”.`);
      } catch {
        setError("The queue couldn’t be saved in this browser.");
        return;
      }
    } else {
      const item = saved.find((entry) => entry.name === selection);
      if (!item) return;
      if (!onLoad(item.sessions)) {
        setError("The queue couldn’t be loaded into this event.");
        return;
      }
      setStatus(`Loaded “${item.name}”.`);
    }
    setMode(undefined);
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-[9px]">
        <button
          type="button"
          className={presenterButton()}
          disabled={!queue.length}
          onClick={() => open("save")}
        >
          <Save size={15} /> Save Queue
        </button>
        <button
          type="button"
          className={presenterButton()}
          onClick={() => open("load")}
        >
          <FolderOpen size={15} /> Load Queue
        </button>
        <span className="text-[0.84rem] text-muted-foreground" role="status">
          {status}
        </span>
        {!mode && error && (
          <span
            className="text-[0.84rem] text-red-700 dark:text-red-300"
            role="alert"
          >
            {error}
          </span>
        )}
      </div>
      {mode && (
        <dialog
          className="m-auto w-[min(430px,90vw)] rounded-xl border border-border bg-card p-[22px] text-foreground backdrop:bg-black/60"
          aria-labelledby={titleId}
          ref={(dialog) => {
            if (dialog && !dialog.open) dialog.showModal();
          }}
          onCancel={(e) => {
            e.preventDefault();
            setError("");
            setMode(undefined);
          }}
        >
          <h2
            className="text-xl font-bold leading-normal tracking-tight"
            id={titleId}
          >
            {mode === "save" ? "Save Session Queue" : "Load Session Queue"}
          </h2>
          <p className="mb-4 mt-2.5 text-muted-foreground">
            {mode === "save"
              ? "Keep a named copy of this lineup in this browser."
              : saved.length
                ? "Loading replaces the planned queue. The active timer and stage output continue."
                : "No saved queues yet. Add sessions to the queue and save a copy first."}
          </p>
          <form
            className="grid justify-items-start gap-[13px]"
            onSubmit={submit}
          >
            {mode === "save" ? (
              <label className="grid gap-1.5 text-[0.79rem] font-[650] text-muted-foreground">
                Queue name
                <input
                  className="min-w-0 rounded-[7px] border border-border bg-background px-2.5 py-[9px] text-[0.9rem] text-foreground"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            ) : (
              saved.length > 0 && (
                <label className="grid gap-1.5 text-[0.79rem] font-[650] text-muted-foreground">
                  Saved queue
                  <select
                    className="min-w-0 rounded-[7px] border border-border bg-background px-2.5 py-[9px] text-[0.9rem] text-foreground"
                    value={selection}
                    onChange={(e) => setSelection(e.target.value)}
                  >
                    {saved.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name} ({item.sessions.length}{" "}
                        {item.sessions.length === 1 ? "session" : "sessions"})
                      </option>
                    ))}
                  </select>
                </label>
              )
            )}
            {error && (
              <span
                className="text-[0.84rem] text-red-700 dark:text-red-300"
                role="alert"
              >
                {error}
              </span>
            )}
            <div className="flex flex-wrap items-center gap-[9px]">
              <button
                type="button"
                className={presenterButton()}
                onClick={() => {
                  setError("");
                  setMode(undefined);
                }}
              >
                Cancel
              </button>
              {(mode === "save" || saved.length > 0) && (
                <button
                  type="submit"
                  className={presenterButton({ variant: "primary" })}
                  disabled={mode === "save" && !name.trim()}
                >
                  {mode === "save"
                    ? overwrite
                      ? "Update Saved Queue"
                      : "Save Queue"
                    : queue.length
                      ? "Replace Current Queue"
                      : "Load Queue"}
                </button>
              )}
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
