"use client";

import { IconButton } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { useContext } from "react";
import { DataContext } from "@/providers/DataProvider";
import type { DurationUnit } from "@/lib/countdown";

export default function FigureBlock({
  unit,
  value,
}: {
  unit: DurationUnit;
  value: number;
}) {
  const { timer } = useContext(DataContext);

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <IconButton
        aria-label={`Increase ${unit}`}
        onClick={() => timer.command({ type: "adjust", unit, amount: 1 })}
      >
        <AddIcon className="text-primary text-[40px] md:text-[50px]" />
      </IconButton>

      <h1 className="size-hour-included font-bold text-white">
        {String(value).padStart(2, "0")}
      </h1>

      <IconButton
        aria-label={`Decrease ${unit}`}
        onClick={() => timer.command({ type: "adjust", unit, amount: -1 })}
      >
        <RemoveIcon className="text-primary text-[40px] md:text-[50px]" />
      </IconButton>
    </div>
  );
}
