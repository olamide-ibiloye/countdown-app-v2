"use client";

import { cn } from "@/lib/utils";

import { presenterButton } from "./styles";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  type ImageQueueItem,
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
  previewTarget,
  initialSelection,
}: {
  output: StageOutput;
  dispatch: (command: PresenterCommand) => boolean;
  previewTarget: HTMLDivElement | null;
  initialSelection?: ImageQueueItem;
}) {
  const [images, setImages] = useState<PresenterImage[]>([]);
  const [selectedId, setSelectedId] = useState(initialSelection?.imageId ?? "");
  const [draftFit, setDraftFit] = useState<ImageFit>(
    initialSelection?.fit ?? DEFAULT_FIT,
  );
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [deleteImage, setDeleteImage] = useState<PresenterImage>();
  const [deleting, setDeleting] = useState(false);
  const selected = selectedId
    ? images.find((image) => image.id === selectedId)
    : images[0];
  const selectedQueueItem =
    initialSelection?.imageId === selected?.id ? initialSelection : undefined;
  const live =
    output.kind === "image" &&
    output.imageId === selected?.id &&
    (!selectedQueueItem || output.queueItemId === selectedQueueItem.id);
  const fit = live ? output.fit : draftFit;

  useEffect(() => {
    let active = true;
    listPresenterImages()
      .then((result) => {
        if (active) setImages(sortImages(result));
      })
      .catch(() => {
        if (active)
          setMessage("The image library couldn’t be opened in this browser.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function importImages(files: File[]) {
    if (!files.length) return;
    setNotice("");
    setImporting(true);
    setMessage("");
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
      setDraftFit(DEFAULT_FIT);
      void navigator.storage?.persist?.().catch(() => {});
    }
    setMessage(errors.join(" "));
    setImporting(false);
  }

  function requestDelete(image: PresenterImage) {
    setMessage("");
    if (output.kind === "image" && output.imageId === image.id) {
      setMessage(
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
        setMessage(
          "Switch the stage to a different output before deleting the live image.",
        );
      } else {
        await removePresenterImage(deleteImage.id);
        setImages((previous) =>
          previous.filter((image) => image.id !== deleteImage.id),
        );
        if (selected?.id === deleteImage.id) {
          setSelectedId("");
          setDraftFit(DEFAULT_FIT);
        }
      }
    } catch {
      setMessage("The image couldn’t be deleted.");
    } finally {
      setDeleting(false);
      setDeleteImage(undefined);
    }
  }

  async function applyImage(destination: "queue" | "stage") {
    if (!selected) return;
    setMessage("");
    setNotice("");
    try {
      if (!(await getPresenterImage(selected.id))) {
        setMessage("This image is no longer saved. Import it again to use it.");
        return;
      }
      const image = {
        kind: "image" as const,
        imageId: selected.id,
        name: selected.name,
        fit,
      };
      if (destination === "queue") {
        if (
          dispatch({
            type: "enqueue",
            item: { ...image, id: crypto.randomUUID() },
          })
        ) {
          setNotice(`Added “${selected.name}” to the queue.`);
        }
      } else {
        dispatch({
          type: "output",
          output: { ...image, queueItemId: selectedQueueItem?.id },
        });
      }
    } catch {
      setMessage("The image couldn’t be read from this browser.");
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
      {message && (
        <p
          className="text-[0.84rem] text-red-700 dark:text-red-300"
          role="alert"
        >
          {message}
        </p>
      )}
      {!loading && selectedId && !selected && (
        <p
          className="text-[0.84rem] text-red-700 dark:text-red-300"
          role="alert"
        >
          This queued image is no longer in the library. Import it again and
          replace the queue item.
        </p>
      )}
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
                  setNotice("");
                  setDraftFit(DEFAULT_FIT);
                  setMessage("");
                }}
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
        <>
          {previewTarget &&
            createPortal(
              <figure className="mt-3.5 w-[min(100%,320px)]">
                <figcaption className="mb-[3px] flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.095em] text-muted-foreground">
                  Image preview
                </figcaption>
                <div className="block aspect-video overflow-hidden rounded-lg border border-border bg-black">
                  <LocalGraphic
                    blob={selected.blob}
                    fit={fit}
                    alt={selected.name}
                  />
                </div>
                <div
                  className="mt-2.5 flex flex-wrap items-center gap-[9px]"
                  aria-label="Image display mode"
                >
                  {(["fill", "fit"] as const).map((mode) => (
                    <button
                      type="button"
                      key={mode}
                      className={cn(
                        presenterButton(),
                        "aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary dark:aria-pressed:border-primary-contrast dark:aria-pressed:text-primary-contrast",
                      )}
                      aria-pressed={fit === mode}
                      onClick={() => {
                        if (live)
                          dispatch({
                            type: "image-fit",
                            imageId: selected.id,
                            fit: mode,
                          });
                        else setDraftFit(mode);
                      }}
                    >
                      {mode === "fill" ? "Fill Screen" : "Fit"}
                    </button>
                  ))}
                </div>
                {!live && (
                  <button
                    type="button"
                    className={cn(
                      presenterButton({ variant: "primary" }),
                      "mt-2.5",
                    )}
                    onClick={() => applyImage("stage")}
                  >
                    Send Image to Stage <ArrowUpRight size={15} />
                  </button>
                )}
              </figure>,
              previewTarget,
            )}
          <button
            type="button"
            className={cn(presenterButton(), "justify-self-start")}
            onClick={() => applyImage("queue")}
          >
            <Plus size={15} /> Add to Queue
          </button>
          {notice && (
            <p className="text-[0.84rem] text-muted-foreground" role="status">
              {notice}
            </p>
          )}
        </>
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
