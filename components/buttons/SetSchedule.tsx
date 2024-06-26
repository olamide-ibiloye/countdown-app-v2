"use client";

import React from "react";
import { Button } from "../ui/button";

const SetSchedule = ({ handleClick }: { handleClick: () => void }) => {
  return (
    <Button
      type="submit"
      onClick={handleClick}
      variant="outline"
      className="timer-button"
    >
      SET SCHEDULE
    </Button>
  );
};

export default SetSchedule;
