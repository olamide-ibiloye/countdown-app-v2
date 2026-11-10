import { IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

interface SignalProps {
  message: string;
  onClose?: () => void;
  nextSession?: { seconds: number; onSkip: () => void };
}

const Signal = ({ message, onClose, nextSession }: SignalProps) => (
  <div
    className={cn(
      "inset-0 bg-white",
      onClose ? "fixed z-50" : "absolute h-screen w-screen",
    )}
  >
    {onClose && (
      <div className="absolute right-4 top-4 z-10 sm:right-8 sm:top-8">
        <IconButton aria-label="Dismiss Time's Up" onClick={onClose}>
          <CloseIcon sx={{ fontSize: { xs: 40, sm: 56 } }} />
        </IconButton>
      </div>
    )}

    <div className="flex size-full animate-flash flex-col items-center justify-center gap-10 px-5">
      <h1 className="size-message text-balance text-center font-bold leading-none">
        {message.toUpperCase()}
      </h1>

      {nextSession && (
        <Button
          className="w-[200px] p-6 text-xs text-white lg:text-lg"
          onClick={nextSession.onSkip}
        >
          Next Session In <span className="pl-4">({nextSession.seconds})</span>
        </Button>
      )}
    </div>
  </div>
);

export default Signal;
