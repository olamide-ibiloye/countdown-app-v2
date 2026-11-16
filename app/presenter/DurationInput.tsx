"use client";

import { useId } from "react";

function addDurationSeparators(value: string): string {
  return value
    .replace(/^(\d{2})(\d{1,4})$/, "$1:$2")
    .replace(/^(\d{2}:\d{2})(\d{1,2})$/, "$1:$2");
}

export function DurationInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="grid w-full gap-1.5">
      <label
        htmlFor={id}
        className="text-[0.79rem] font-[650] text-muted-foreground"
      >
        Duration
      </label>
      <input
        id={id}
        value={value}
        placeholder="MM:SS or HH:MM:SS"
        inputMode="numeric"
        className="h-[37px] w-full min-w-0 rounded-[7px] border border-border bg-background px-2.5 py-[7px] text-[0.9rem] leading-[1.2] text-foreground"
        onChange={(event) => {
          const { value, selectionStart } = event.currentTarget;
          const inputType = (event.nativeEvent as InputEvent).inputType;
          onChange(
            selectionStart === value.length && !inputType?.startsWith("delete")
              ? addDurationSeparators(value)
              : value,
          );
        }}
      />
    </div>
  );
}
