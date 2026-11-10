"use client";

import { useContext } from "react";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { DataContext } from "@/providers/DataProvider";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export default function Reset() {
  const { timer } = useContext(DataContext);

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label="Reset"
        onClick={() => timer.command({ type: "reset" })}
      >
        <RestartAltIcon className="icon" />
      </TooltipTrigger>

      <TooltipContent>
        <p>Reset (Ctrl+Shift+R)</p>
      </TooltipContent>
    </Tooltip>
  );
}
