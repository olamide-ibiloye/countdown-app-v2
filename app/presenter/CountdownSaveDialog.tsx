"use client";

import { useId, useState } from "react";
import { parseDuration } from "@/lib/presenter";
import { DurationInput } from "./DurationInput";
import { presenterButton } from "./styles";

export function CountdownSaveDialog({
  initialDuration,
  initialName = "",
  editing = false,
  onSave,
  onClose,
}: {
  initialDuration: string;
  initialName?: string;
  editing?: boolean;
  onSave: (value: { name: string; durationMs: number }) => string | undefined;
  onClose: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(initialName);
  const [duration, setDuration] = useState(initialDuration);
  const [error, setError] = useState("");
  const durationMs = parseDuration(duration.trim());
  const title = editing ? "Edit Session" : "Add to Queue";
  return (
    <dialog
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      className="m-auto w-[min(430px,90vw)] rounded-xl border border-border bg-card p-[22px] text-foreground backdrop:bg-black/60"
      ref={(dialog) => {
        if (dialog && !dialog.open) dialog.showModal();
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id={`${id}-title`} className="text-xl font-bold">
        {title}
      </h2>
      <p
        id={`${id}-description`}
        className="mb-4 mt-2.5 text-sm text-muted-foreground"
      >
        {editing
          ? "Save changes to this queued session."
          : "Give this session a name and duration for your event queue."}
      </p>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) {
            setError("Enter a session name.");
            return;
          }
          if (durationMs === undefined) {
            setError("Enter a duration such as 05:00 or 1:15:00.");
            return;
          }
          const failure = onSave({ name: name.trim(), durationMs });
          if (failure) setError(failure);
          else onClose();
        }}
      >
        <div className="grid gap-1.5">
          <label
            htmlFor={`${id}-name`}
            className="text-[0.79rem] font-[650] text-muted-foreground"
          >
            Session name
          </label>
          <input
            id={`${id}-name`}
            value={name}
            required
            maxLength={80}
            placeholder="e.g. Opening remarks"
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
            className="min-w-0 rounded-[7px] border border-border bg-background px-2.5 py-[9px] text-[0.9rem] text-foreground"
          />
        </div>
        <DurationInput
          value={duration}
          onChange={(value) => {
            setDuration(value);
            setError("");
          }}
        />
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-[9px]">
          <button type="button" className={presenterButton()} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className={presenterButton({ variant: "primary" })}
          >
            {editing ? "Save Session" : "Add Session"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
