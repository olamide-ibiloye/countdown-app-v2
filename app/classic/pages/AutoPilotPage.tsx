"use client";

import { useState } from "react";
import TimerView from "@/components/countdown/TimerView";
import ScheduleModal from "@/components/schedule/ScheduleModal";

export default function AutoPilotPage() {
  const [schedule, setSchedule] = useState(false);

  return (
    <>
      <TimerView openSchedule={() => setSchedule(true)} />
      <ScheduleModal isOpen={schedule} onClose={() => setSchedule(false)} />
    </>
  );
}
