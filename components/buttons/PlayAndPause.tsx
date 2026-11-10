import { useContext } from "react";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import { DataContext } from "@/providers/DataProvider";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export default function PlayAndPause() {
  const { timer } = useContext(DataContext);
  const isPlaying = timer.run.phase === "running" && timer.draftMs === null;
  const label = isPlaying ? "Pause" : "Play";

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        disabled={timer.draftMs === 0}
        onClick={() => timer.command({ type: "toggle" })}
      >
        {isPlaying ? (
          <PauseCircleOutlineIcon className="icon" />
        ) : (
          <PlayCircleOutlineIcon className="icon" />
        )}
      </TooltipTrigger>

      <TooltipContent>
        <p>{label} (Spacebar)</p>
      </TooltipContent>
    </Tooltip>
  );
}
