"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, ImagePlus, Trash2 } from "lucide-react";
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
  previewTarget,
}: {
  output: StageOutput;
  dispatch: (command: PresenterCommand) => boolean;
  previewTarget: HTMLDivElement | null;
}) {
  const [images, setImages] = useState<PresenterImage[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draftFit, setDraftFit] = useState<ImageFit>(DEFAULT_FIT);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [deleteImage, setDeleteImage] = useState<PresenterImage>();
  const [deleting, setDeleting] = useState(false);
  const selected = images.find((image) => image.id === selectedId) ?? images[0];
  const live = output.kind === "image" && output.imageId === selected?.id;
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

  async function sendImage() {
    if (!selected) return;
    try {
      if (!(await getPresenterImage(selected.id))) {
        setMessage(
          "This image is no longer saved. Import it again before sending it to stage.",
        );
        return;
      }
      dispatch({
        type: "output",
        output: {
          kind: "image",
          imageId: selected.id,
          name: selected.name,
          fit,
        },
      });
    } catch {
      setMessage("The image couldn’t be read from this browser.");
    }
  }

  return (
    <div className="aeon-image-library">
      <div className="aeon-panel-heading">
        <div>
          <p className="aeon-kicker">Available offline</p>
          <h3>Image Library</h3>
        </div>
        <label className="aeon-image-import">
          <span className="aeon-button">
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
        <p className="aeon-error" role="alert">
          {message}
        </p>
      )}
      {loading ? (
        <p className="aeon-note">Loading images…</p>
      ) : !images.length ? (
        <div className="aeon-empty">
          <strong>No images saved</strong>
          <span>Import PNG, JPEG, or WebP files.</span>
        </div>
      ) : (
        <ul className="aeon-image-grid">
          {images.map((image) => (
            <li key={image.id}>
              <button
                type="button"
                className="aeon-image-tile"
                aria-pressed={selected?.id === image.id}
                onClick={() => {
                  setSelectedId(image.id);
                  setDraftFit(DEFAULT_FIT);
                  setMessage("");
                }}
              >
                <span className="aeon-image-thumbnail">
                  <LocalGraphic blob={image.blob} alt="" />
                </span>
                <span className="aeon-image-name">{image.name}</span>
              </button>
              <button
                type="button"
                className="aeon-button aeon-image-delete"
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
              <figure className="aeon-live-preview">
                <figcaption className="aeon-kicker">Image preview</figcaption>
                <div className="aeon-image-preview">
                  <LocalGraphic
                    blob={selected.blob}
                    fit={fit}
                    alt={selected.name}
                  />
                </div>
                {!live && (
                  <button
                    type="button"
                    className="aeon-button aeon-primary aeon-preview-action"
                    onClick={sendImage}
                  >
                    Send Image to Stage <ArrowUpRight size={15} />
                  </button>
                )}
              </figure>,
              previewTarget,
            )}
          <div className="aeon-actions" aria-label="Image display mode">
            {(["fill", "fit"] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                className="aeon-button aeon-fit-button"
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
            {live && (
              <span className="aeon-chip">On stage · fit changes are live</span>
            )}
          </div>
        </>
      )}
      {deleteImage && (
        <dialog
          className="aeon-dialog"
          aria-labelledby="aeon-delete-image-title"
          ref={(dialog) => {
            if (dialog && !dialog.open) dialog.showModal();
          }}
          onCancel={(e) => {
            e.preventDefault();
            if (!deleting) setDeleteImage(undefined);
          }}
        >
          <h2 id="aeon-delete-image-title">Delete saved image?</h2>
          <p>Remove “{deleteImage.name}” from this browser’s image library.</p>
          <div className="aeon-actions">
            <button
              type="button"
              className="aeon-button"
              disabled={deleting}
              onClick={() => setDeleteImage(undefined)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="aeon-button aeon-danger"
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
