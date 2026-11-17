"use client";

import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { presenterButton } from "./styles";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ImagePlus, Plus, Trash2 } from "lucide-react";
import {
  getPresenterImage,
  IMAGE_ACCEPT,
  importPresenterImage,
  listPresenterImages,
  removePresenterImage,
  type PresenterImage,
} from "@/lib/presenter-images";
import {
  PRESENTER_KEY,
  readPresenterEvent,
  type ImageFit,
  type PresenterCommand,
  type StageOutput,
} from "@/lib/presenter";
import { LocalGraphic } from "./LocalImage";

const DEFAULT_FIT: ImageFit = "fit";

function sortImages(images: PresenterImage[]) {
  return [...images].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
}

function readOutput() {
  return readPresenterEvent(localStorage.getItem(PRESENTER_KEY)).output;
}

export default function ImageLibrary({
  output,
  dispatch,
}: {
  output: StageOutput;
  dispatch: (command: PresenterCommand) => boolean;
}) {
  const [images, setImages] = useState<PresenterImage[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const showRequest = useRef({ serial: 0 });
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [deleteImage, setDeleteImage] = useState<PresenterImage>();
  const [deleting, setDeleting] = useState(false);
  const selected = selectedId
    ? images.find((image) => image.id === selectedId)
    : images[0];

  useEffect(() => {
    let active = true;
    const requestState = showRequest.current;
    listPresenterImages()
      .then((result) => {
        if (active) setImages(sortImages(result));
      })
      .catch(() => {
        if (active)
          toast.error("The image library couldn’t be opened in this browser.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      requestState.serial++;
    };
  }, []);

  async function importImages(files: File[]) {
    if (!files.length) return;

    setImporting(true);

    const imported: PresenterImage[] = [];
    const errors: string[] = [];
    for (const file of files) {
      try {
        imported.push(await importPresenterImage(file));
      } catch (error) {
        const reason =
          error instanceof Error && !(error instanceof DOMException)
            ? error.message
            : "This browser couldn’t save the image.";
        errors.push(`${file.name}: ${reason}`);
      }
    }
    setImages((current) => sortImages([...current, ...imported]));
    if (imported[0]) {
      setSelectedId(imported[0].id);
      void navigator.storage?.persist?.().catch(() => {});
    }
    if (errors.length)
      toast.error("Some images couldn’t be imported.", {
        description: errors.join(" "),
        duration: 8000,
      });
    if (imported.length)
      toast.success(
        imported.length === 1
          ? `Imported “${imported[0].name}”.`
          : `Imported ${imported.length} images.`,
      );
    setImporting(false);
  }

  function requestDelete(image: PresenterImage) {
    if (output.kind === "image" && output.imageId === image.id) {
      toast.error(
        "Switch the stage to a different output before deleting the live image.",
      );
      return;
    }
    setDeleteImage(image);
  }

  async function confirmDelete() {
    if (!deleteImage || deleting) return;
    setDeleting(true);
    try {
      const current = readOutput();
      if (current.kind === "image" && current.imageId === deleteImage.id) {
        toast.error(
          "Switch the stage to a different output before deleting the live image.",
        );
      } else {
        await removePresenterImage(deleteImage.id);
        toast.success(`Deleted “${deleteImage.name}”.`);
        setImages((previous) =>
          previous.filter((image) => image.id !== deleteImage.id),
        );
        if (selected?.id === deleteImage.id) {
          setSelectedId("");
        }
      }
    } catch {
      toast.error("The image couldn’t be deleted.");
    } finally {
      setDeleting(false);
      setDeleteImage(undefined);
    }
  }

  async function applyImage(
    imageFile: PresenterImage,
    destination: "queue" | "stage",
  ) {
    const request =
      destination === "stage" ? ++showRequest.current.serial : undefined;
    if (destination === "stage") setSelectedId(imageFile.id);

    try {
      const saved = await getPresenterImage(imageFile.id);
      if (request !== undefined && request !== showRequest.current.serial)
        return;
      if (!saved) {
        toast.error(
          "This image is no longer saved. Import it again to use it.",
        );
        return;
      }
      const current = readOutput();
      const alreadyLive =
        current.kind === "image" && current.imageId === imageFile.id;
      const image = {
        kind: "image" as const,
        imageId: imageFile.id,
        name: imageFile.name,
        fit: alreadyLive ? current.fit : DEFAULT_FIT,
      };
      if (destination === "queue") {
        if (
          dispatch({
            type: "enqueue",
            item: { ...image, id: crypto.randomUUID() },
          })
        )
          toast.success(`Added “${imageFile.name}” to the queue.`);
        else toast.error("The image couldn’t be added to the queue.");
      } else if (!alreadyLive && !dispatch({ type: "output", output: image }))
        toast.error("The image couldn’t be shown on stage.");
    } catch {
      toast.error("The image couldn’t be read from this browser.");
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="mb-[3px] flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.095em] text-muted-foreground">
            Available offline
          </p>
          <h3 className="font-bold">Image Library</h3>
        </div>
        <label className="relative [&:focus-within>span]:outline [&:focus-within>span]:outline-2 [&:focus-within>span]:outline-offset-[3px] [&:focus-within>span]:outline-primary dark:[&:focus-within>span]:outline-primary-contrast [&:has(input:disabled)]:opacity-[0.55] [&_input]:absolute [&_input]:inset-0 [&_input]:w-full [&_input]:cursor-pointer [&_input]:opacity-0">
          <span className={presenterButton()}>
            <ImagePlus size={16} /> {importing ? "Importing…" : "Import Images"}
          </span>
          <input
            type="file"
            multiple
            accept={IMAGE_ACCEPT}
            disabled={loading || importing}
            onChange={(e) => {
              const files = Array.from(e.currentTarget.files ?? []);
              e.currentTarget.value = "";
              void importImages(files);
            }}
          />
        </label>
      </div>
      {loading ? (
        <p className="mt-2 text-[0.84rem] text-muted-foreground">
          Loading images…
        </p>
      ) : !images.length ? (
        <div className="grid justify-items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-5 text-center text-[0.84rem] text-muted-foreground">
          <strong className="text-foreground">No images saved</strong>
          <span>Import PNG, JPEG, or WebP files.</span>
        </div>
      ) : (
        <ul className="grid max-h-80 grid-cols-[repeat(auto-fill,minmax(min(100%,120px),1fr))] gap-2.5 overflow-auto p-[3px]">
          {images.map((image) => (
            <li key={image.id} className="relative min-w-0">
              <button
                type="button"
                className="block w-full overflow-hidden rounded-lg border border-border bg-background text-left aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary dark:aria-pressed:border-primary-contrast dark:aria-pressed:text-primary-contrast"
                aria-pressed={selected?.id === image.id}
                onClick={() => {
                  setSelectedId(image.id);
                }}
                onDoubleClick={() => void applyImage(image, "stage")}
                aria-label={`Select ${image.name}`}
              >
                <span className="block aspect-video overflow-hidden bg-black">
                  <LocalGraphic blob={image.blob} alt="" />
                </span>
                <span className="block overflow-hidden text-ellipsis whitespace-nowrap px-2 py-1.5 text-[0.8rem]">
                  {image.name}
                </span>
              </button>
              <button
                type="button"
                className={cn(
                  presenterButton({ size: "deleteImage" }),
                  "absolute right-[5px] top-[5px]",
                )}
                aria-label={`Delete ${image.name}`}
                onClick={() => requestDelete(image)}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <div className="flex flex-wrap gap-[9px]">
          <button
            type="button"
            className={presenterButton()}
            onClick={() => void applyImage(selected, "queue")}
          >
            <Plus size={15} /> Add to Queue
          </button>
          <button
            data-prepare-go-live
            type="button"
            className={presenterButton({ variant: "primary" })}
            onClick={() => void applyImage(selected, "stage")}
          >
            Show Image <ArrowUpRight size={15} />
          </button>
        </div>
      )}
      {deleteImage && (
        <dialog
          className="m-auto w-[min(430px,90vw)] rounded-xl border border-border bg-card p-[22px] text-foreground backdrop:bg-black/60"
          aria-labelledby="aeon-delete-image-title"
          ref={(dialog) => {
            if (dialog && !dialog.open) dialog.showModal();
          }}
          onCancel={(e) => {
            e.preventDefault();
            if (!deleting) setDeleteImage(undefined);
          }}
        >
          <h2
            className="text-xl font-bold leading-normal tracking-tight"
            id="aeon-delete-image-title"
          >
            Delete saved image?
          </h2>
          <p className="mb-4 mt-2.5 text-muted-foreground">
            Remove “{deleteImage.name}” from this browser’s image library.
          </p>
          <div className="flex flex-wrap items-center gap-[9px]">
            <button
              type="button"
              className={presenterButton()}
              disabled={deleting}
              onClick={() => setDeleteImage(undefined)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={presenterButton({ variant: "danger" })}
              disabled={deleting}
              onClick={confirmDelete}
            >
              Delete Image
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
