"use client";

import React, { useState } from "react";
import Preset from "../buttons/Preset";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useLocalStorage } from "../../customHooks/useLocalStorage";
import { Button } from "../ui/button";
import { Dialog, DialogContent } from "../ui/dialog";
import { Input } from "../ui/input";
import { Separator } from "../ui/separator";
import SaveIcon from "@mui/icons-material/Save";
import { getTimeInputMilliseconds } from "@/utils/functions";

const DEFAULT_PRESETS = ["00:03:00", "00:05:00", "00:07:00"];

function sortPresets(presets: string[]): string[] {
  return presets
    .map((preset) => ({ preset, duration: getTimeInputMilliseconds(preset) }))
    .sort(
      (a, b) =>
        (Number.isNaN(a.duration) ? Infinity : a.duration) -
        (Number.isNaN(b.duration) ? Infinity : b.duration),
    )
    .map(({ preset }) => preset);
}

const PresetBlock = () => {
  const [presets, setPresets] = useLocalStorage({
    key: "countdownPresets",
    defaultValue: JSON.stringify(DEFAULT_PRESETS),
  });

  // Parse presets if it's a string (from JSON)
  const parsedPresets = sortPresets(
    typeof presets === "string" ? JSON.parse(presets) : presets,
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPreset, setNewPreset] = useState("");
  const [editablePresets, setEditablePresets] = useState<string[]>([]);

  const openDialog = () => {
    setEditablePresets([...parsedPresets]);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setNewPreset("");
  };

  const addPreset = () => {
    if (newPreset && !editablePresets.includes(newPreset)) {
      setEditablePresets([...editablePresets, newPreset]);
      setNewPreset("");
    }
  };

  const deletePreset = (index: number) => {
    const updatedPresets = [...editablePresets];
    updatedPresets.splice(index, 1);
    setEditablePresets(updatedPresets);
  };

  const saveChanges = () => {
    setPresets(sortPresets(editablePresets));
    closeDialog();
  };

  const resetToDefaults = () => {
    setEditablePresets([...DEFAULT_PRESETS]);
  };

  return (
    <div className="flex items-start justify-center gap-3">
      <div className="flex h-[100px] flex-wrap justify-center gap-2 md:gap-5">
        {parsedPresets.map((preset, index) => (
          <Preset key={index} presetTime={preset} />
        ))}
      </div>

      <Button onClick={openDialog} variant={"ghost"}>
        <Pencil />
      </Button>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="flex w-full max-w-[520px] flex-col gap-6 border-none px-6 py-9 text-light-1 dark:text-white">
          <div className="flex flex-col gap-6">
            <h1 className="text-3xl font-bold leading-[42px]">Edit Presets</h1>
            
            <div>
              <label>
                Enter preset durations{" "}
                <span className="text-sm text-gray-600">(in HH:MM:SS format)</span>
              </label>

              <div className="mt-4 space-y-3">
                {editablePresets.map((preset, index) => (
                  <div key={index} className="form-control flex items-center justify-center gap-2">
                    <Input
                      type="time"
                      step="1"
                      value={preset}
                      onChange={(e) => {
                        const updated = [...editablePresets];
                        updated[index] = e.target.value;
                        setEditablePresets(updated);
                      }}
                      className="my-2 placeholder-gray-600"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deletePreset(index)}
                      className="p-0"
                    >
                      <Trash2 className="size-5 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex items-center gap-2">
              <Input
                type="time"
                step="1"
                value={newPreset}
                onChange={(e) => setNewPreset(e.target.value)}
                placeholder="Add new preset"
                className="my-2 placeholder-gray-600"
              />
              <Button
                onClick={addPreset}
                disabled={!newPreset}
                variant="outline"
                className="text-primary dark:text-white"
              >
                <Plus className="mr-1" size={16} />
                Add
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <Button
                onClick={resetToDefaults}
                variant="outline"
                className="text-primary dark:text-white"
              >
                Reset to Defaults
              </Button>
              
              <Button
                onClick={saveChanges}
                className="bg-blue-1 text-white"
              >
                <SaveIcon className="mr-1" />
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PresetBlock;
