"use client";

import { useContext } from "react";
import { DataContext } from "@/providers/DataProvider";
import { Button } from "../ui/button";
import { IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

export default function SetCountdown() {
  const { timer } = useContext(DataContext);
  const editing = timer.draftMs !== null;

  return (
    <>
      {editing && (
        <IconButton
          aria-label="Cancel countdown edit"
          onClick={() => timer.command({ type: "cancel-edit" })}
        >
          <CloseIcon className="icon" />
        </IconButton>
      )}

      <Button
        type="button"
        onClick={() => timer.command({ type: editing ? "confirm" : "edit" })}
        disabled={timer.draftMs === 0}
        variant="outline"
        className="timer-button"
      >
        {editing ? "CONFIRM" : "SET COUNTDOWN"}
      </Button>
    </>
  );
}
