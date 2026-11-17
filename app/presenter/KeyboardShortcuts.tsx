"use client";

import { useEffect, useSyncExternalStore } from "react";
import { presenterButton } from "./styles";

const shortcuts = [
  ["Space", "Start, pause or resume countdown"],
  ["R", "Reset countdown (asks first while running)"],
  ["↑ / ↓", "Select a queue item privately"],
  ["Enter", "Show selected queue item; countdown stays ready"],
  ["Delete / Backspace", "Remove selected preset or queue item"],
  ["B", "Blackout or restore stage"],
  ["F", "Fullscreen the connected stage"],
  ["1 / 2 / 3 / 4", "Prepare countdown / clock / image / message"],
  ["Shift + 1 / 2 / 3", "Add 30 seconds / 1 minute / 5 minutes"],
  ["Ctrl / ⌘ + Enter", "Show the prepared output (also while typing)"],
  ["Ctrl / ⌘ + Shift + E", "Open End Event confirmation"],
  ["?", "Show keyboard shortcuts"],
  ["Double-click preset", "Show countdown ready to start"],
  ["Double-click image", "Show image on stage immediately"],
];

export function KeyboardShortcuts({ onClose }: { onClose: () => void }) {
  return (
    <dialog
      ref={(node) => {
        if (node && !node.open) node.showModal();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="keyboard-title"
      className="m-auto max-h-[90dvh] w-[min(560px,92vw)] overflow-auto rounded-xl border border-border bg-card p-6 text-foreground backdrop:bg-black/60"
    >
      <h2 id="keyboard-title" className="text-xl font-bold">
        Keyboard shortcuts
      </h2>
      <p className="my-3 text-sm text-muted-foreground">
        While typing, only Ctrl/⌘+Enter works. Shortcuts pause in dialogs.
        Showing a countdown never starts it.
      </p>
      <dl className="grid gap-3">
        {shortcuts.map(([key, description]) => (
          <div
            key={key}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <dt>
              <kbd className="whitespace-nowrap rounded border border-border bg-muted px-2 py-1 font-presenter-mono text-xs">
                {key}
              </kbd>
            </dt>
            <dd className="text-right">{description}</dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        className={`mt-5 ${presenterButton()}`}
        onClick={onClose}
      >
        Close
      </button>
    </dialog>
  );
}

const dismissed = new Set<string>();
function subscribe(callback: () => void) {
  window.addEventListener("aeon-hints", callback);
  return () => window.removeEventListener("aeon-hints", callback);
}
export function dismissHint(key: string) {
  dismissed.add(key);
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* Keep dismissal for this visit. */
  }
  window.dispatchEvent(new Event("aeon-hints"));
}
export function useLearningHint(key: string) {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (
        !matchMedia("(hover: hover) and (pointer: fine)").matches ||
        dismissed.has(key)
      )
        return false;
      try {
        return !localStorage.getItem(key);
      } catch {
        return true;
      }
    },
    () => false,
  );
}

export function isGoLiveShortcut(event: KeyboardEvent) {
  return (
    event.key === "Enter" &&
    event.ctrlKey !== event.metaKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function isEndEventShortcut(event: KeyboardEvent) {
  return (
    event.key.toLowerCase() === "e" &&
    event.shiftKey &&
    event.ctrlKey !== event.metaKey &&
    !event.altKey
  );
}

export function useKeyboardShortcuts(onKey: (event: KeyboardEvent) => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        ((event.ctrlKey || event.metaKey) &&
          !isEndEventShortcut(event) &&
          !isGoLiveShortcut(event)) ||
        event.altKey
      )
        return;
      if (
        document.querySelector('dialog[open], [role="dialog"], [role="menu"]')
      )
        return;
      const target = event.target;
      if (target instanceof Element) {
        if (
          target.closest('[role="tablist"]') &&
          [
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown",
            "Home",
            "End",
          ].includes(event.key)
        )
          return;
        if (
          target.closest(
            'select, [role="listbox"], [role="combobox"], [role="toolbar"]',
          )
        )
          return;
        if (
          !isGoLiveShortcut(event) &&
          target.closest(
            'input, textarea, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
          )
        )
          return;
        if (
          !isGoLiveShortcut(event) &&
          (event.code === "Space" || event.key === "Enter") &&
          target.closest('button, a, [role="button"]')
        )
          return;
      }
      onKey(event);
    };
    // Handle Go Live before the rich-text editor consumes Ctrl/⌘+Enter.
    const captureGoLive = (event: KeyboardEvent) => {
      if (!isGoLiveShortcut(event)) return;
      handler(event);
      if (event.defaultPrevented) event.stopPropagation();
    };
    window.addEventListener("keydown", captureGoLive, true);
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", captureGoLive, true);
      window.removeEventListener("keydown", handler);
    };
  }, [onKey]);
}
