"use client";

import { cn } from "@/lib/utils";

import { useEffect, useState } from "react";
import { getPresenterImage } from "@/lib/presenter-images";
import type { ImageFit } from "@/lib/presenter";

function useLocalImageUrl(blob?: Blob) {
  const [source, setSource] = useState<{ blob: Blob; url: string }>();
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    // Each preview owns its URL and releases it when the image is removed.
    let active = true;
    queueMicrotask(() => {
      if (active) setSource({ blob, url });
    });
    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [blob]);
  return source?.blob === blob ? source?.url : undefined;
}

export function LocalGraphic({
  blob,
  alt,
  fit = "fill",
  onLoad,
  onError,
}: {
  blob: Blob;
  alt: string;
  fit?: ImageFit;
  onLoad?: () => void;
  onError?: () => void;
}) {
  const url = useLocalImageUrl(blob);
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Browser-private blob URLs work offline.
    <img
      className={cn(
        "block size-full",
        fit === "fill" ? "object-cover" : "object-contain",
      )}
      src={url}
      alt={alt}
      onLoad={onLoad}
      onError={onError}
    />
  );
}

export function StageImage({
  imageId,
  name,
  fit,
  preview,
  onReady,
}: {
  imageId: string;
  name: string;
  fit: ImageFit;
  preview: boolean;
  onReady?: (imageId: string) => void;
}) {
  const [blob, setBlob] = useState<Blob>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getPresenterImage(imageId)
      .then((image) => {
        if (!active) return;
        if (image) setBlob(image.blob);
        else setFailed(true);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [imageId]);

  if (failed && preview)
    return (
      <p className="p-3 text-[0.9rem] text-white">
        Image unavailable in this browser.
      </p>
    );
  if (!blob || failed) return null;
  return (
    <LocalGraphic
      blob={blob}
      alt={name}
      fit={fit}
      onLoad={() => onReady?.(imageId)}
      onError={() => setFailed(true)}
    />
  );
}
