import FigureBlock from "./FigureBlock";
import { getDurationPart } from "@/lib/countdown";

export default function EditCountDown({ durationMs }: { durationMs: number }) {
  return (
    <div className="flex h-[calc(100vh-280px)] items-center justify-center">
      <div className="flex">
        <FigureBlock
          unit="hours"
          value={getDurationPart(durationMs, "hours")}
        />
        <span className="size-hour-included flex items-center justify-center">
          :
        </span>
        <FigureBlock
          unit="minutes"
          value={getDurationPart(durationMs, "minutes")}
        />
        <span className="size-hour-included flex items-center justify-center">
          :
        </span>
        <FigureBlock
          unit="seconds"
          value={getDurationPart(durationMs, "seconds")}
        />
      </div>
    </div>
  );
}
