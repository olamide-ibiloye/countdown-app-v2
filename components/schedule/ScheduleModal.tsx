"use client";

import { useContext, useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent } from "../ui/dialog";
import { Form } from "../ui/form";
import { useToast } from "../ui/use-toast";
import { useForm, useFieldArray } from "react-hook-form";
import { Input } from "../ui/input";
import { IconButton } from "@mui/material";
import { Close } from "@mui/icons-material";
import { cn } from "@/lib/utils";
import { isDuration } from "@/lib/countdown";
import { DataContext } from "@/providers/DataProvider";
import SaveIcon from "@mui/icons-material/Save";
import { useLocalStorage } from "@/customHooks/useLocalStorage";
import { Separator } from "../ui/separator";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type SavedSchedule = {
  [key: string]: { sessions: { duration: number | "" }[] };
};

type FormValues = {
  sessions: { duration: number | "" }[];
};

const ScheduleModal = ({ isOpen, onClose }: ModalProps) => {
  const [isClient, setIsClient] = useState(false);
  const { timer } = useContext(DataContext);
  const [savedSchedule, setSavedSchedule] = useLocalStorage({
    key: "savedSchedule",
    defaultValue: "{}",
  });
  const [scheduleName, setScheduleName] = useState("");
  const [isScheduleNameDialogOpen, setIsScheduleNameDialogOpen] =
    useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    defaultValues: {
      sessions: [{ duration: "" }, { duration: "" }],
    },
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
    getValues,
    setValue,
  } = form;

  const { fields, append, remove } = useFieldArray({
    name: "sessions",
    control,
  });

  const showToast = () => {
    toast({
      title: "Created successfully",
      description: "Click the Play button to start!",
    });
  };

  const onSubmit = async (values: FormValues) => {
    const sessions = values.sessions.map(({ duration }) => Number(duration) * 60_000);
    if (!sessions.length || !sessions.every(isDuration)) return;

    timer.command({ type: "program", sessions });
    showToast();
    reset();
    onClose();
  };

  const handleClick = () => {
    setIsScheduleNameDialogOpen(true);
  };

  const handleSave = () => {
    const values = getValues();

    setSavedSchedule((prev: SavedSchedule) => ({
      ...prev,
      [scheduleName]: values,
    }));

    setIsScheduleNameDialogOpen(false);
  };

  const handleDeleteSchedule = (key: string) => () => {
    setSavedSchedule((prev: SavedSchedule) => {
      const newSchedule = { ...prev };

      delete newSchedule[key];

      return newSchedule;
    });
  };

  const handleUseSavedSession = (value: any) => () => {
    setValue("sessions", value.sessions);
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient ? (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex w-full max-w-[520px] flex-col gap-6 border-none px-6 py-9 text-light-1 dark:text-white">
        <div className="flex flex-col gap-6">
          <h1 className="text-3xl font-bold leading-[42px]">
            Create a Program
          </h1>

          {Object.keys(savedSchedule).length > 0 && (
            <div className="border-1 mb-2 rounded-xl border bg-accent/10 p-4">
              <h2 className="text-lg font-semibold leading-[42px]">
                Saved Sessions
              </h2>

              <Separator className="mb-4" />

              <div className="flex flex-col items-start justify-start gap-2">
                {Object.entries(savedSchedule).map(([name, value]) => (
                  <div
                    key={name}
                    className="flex w-full items-center justify-between gap-4"
                  >
                    <div
                      className="border-1 cursor-pointer rounded-lg border px-5 py-2 text-sm"
                      onClick={handleUseSavedSession(value)}
                    >
                      {name}
                    </div>

                    <span
                      className="cursor-pointer"
                      onClick={handleDeleteSchedule(name)}
                    >
                      <Close />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Form {...form}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="w-full space-y-5"
            >
              <div>
                <label>
                  Enter Sessions duration{" "}
                  <span className="text-sm text-gray-600">(in minutes)</span>
                </label>

                <div>
                  {fields.map((field, index) => (
                    <div
                      className="form-control flex items-center justify-center gap-2"
                      key={field.id}
                    >
                      <Input
                        className="my-2 placeholder-gray-600"
                        type="number"
                        min={1}
                        placeholder={`Session ${index + 1}`}
                        required
                        {...register(`sessions.${index}.duration`)}
                      />

                      {index > 0 && (
                        <IconButton
                          className="p-0"
                          onClick={() => remove(index)}
                        >
                          <Close
                            className={cn("size-10 p-2 hover:bg-dark-3", {
                              "text-light-1 dark:text-white": index > 1,
                            })}
                          />
                        </IconButton>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="text-primary dark:text-white"
                  onClick={() => append({ duration: "" })}
                >
                  Add Session
                </Button>

                <Button
                  disabled={isSubmitting}
                  className="bg-blue-1 text-white"
                >
                  {isSubmitting ? "Creating Event" : "Create Event"}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  className="bg-green-600"
                  onClick={handleClick}
                >
                  <SaveIcon className="mr-1" />
                  Save
                </Button>
              </div>
            </form>
          </Form>
        </div>

        <ScheduleNameDialog
          isScheduleNameDialogOpen={isScheduleNameDialogOpen}
          setIsScheduleNameDialogOpen={setIsScheduleNameDialogOpen}
          scheduleName={scheduleName}
          setScheduleName={setScheduleName}
          handleSave={handleSave}
        />
      </DialogContent>
    </Dialog>
  ) : null;
};

export default ScheduleModal;

interface ScheduleNameDialogProps {
  isScheduleNameDialogOpen: boolean;
  setIsScheduleNameDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  scheduleName: string;
  setScheduleName: React.Dispatch<React.SetStateAction<string>>;
  handleSave: () => void;
}

export const ScheduleNameDialog: React.FC<ScheduleNameDialogProps> = ({
  isScheduleNameDialogOpen,
  setIsScheduleNameDialogOpen,
  scheduleName,
  setScheduleName,
  handleSave,
}) => {
  return (
    <Dialog
      open={isScheduleNameDialogOpen}
      onOpenChange={() => setIsScheduleNameDialogOpen(false)}
    >
      <DialogContent className="flex w-full max-w-[520px] flex-col gap-6 border-none px-6 py-9 text-light-1 dark:text-white">
        <Input
          className="my-2 placeholder-gray-600"
          type="text"
          placeholder="Enter schedule name"
          value={scheduleName}
          onChange={(e) => setScheduleName(e.target.value)}
          required
        />
        <Button
          type="button"
          className="w-full bg-blue-1 text-white focus-visible:ring-0 focus-visible:ring-offset-0"
          onClick={handleSave}
        >
          Save Event
        </Button>
      </DialogContent>
    </Dialog>
  );
};
