const DATABASE_NAME = "aeonPresenterMedia";
const STORE_NAME = "images";
export const IMAGE_ACCEPT =
  "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";

export interface PresenterImage {
  id: string;
  name: string;
  blob: Blob;
}

interface StoredImage {
  id: string;
  name: string;
  type: string;
  bytes: ArrayBuffer;
}

function asPresenterImage({
  id,
  name,
  type,
  bytes,
}: StoredImage): PresenterImage {
  return { id, name, blob: new Blob([bytes], { type }) };
}

async function imageStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error ?? request.error);
    });
  } finally {
    db.close();
  }
}

export async function listPresenterImages() {
  const images = await imageStore<StoredImage[]>("readonly", (store) =>
    store.getAll(),
  );
  return images.map(asPresenterImage);
}

export async function getPresenterImage(id: string) {
  const image = await imageStore<StoredImage | undefined>("readonly", (store) =>
    store.get(id),
  );
  return image && asPresenterImage(image);
}

export const removePresenterImage = (id: string) =>
  imageStore("readwrite", (store) => store.delete(id));

function imageType(buffer: ArrayBuffer): string | undefined {
  const bytes = new Uint8Array(buffer);
  const tag = (offset: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + 4));

  if (
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (byte, index) => bytes[index] === byte,
    )
  ) {
    const view = new DataView(buffer);
    for (
      let offset = 8;
      offset + 8 <= bytes.length;
      offset += 12 + view.getUint32(offset)
    ) {
      const chunk = tag(offset + 4);
      if (chunk === "acTL") throw new Error("Choose a still PNG image.");
      if (chunk === "IDAT" || chunk === "IEND") break;
    }
    return "image/png";
  }
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if (tag(0) === "RIFF" && tag(8) === "WEBP") {
    if (tag(12) === "VP8X" && bytes[20] & 2)
      throw new Error("Choose a still WebP image.");
    return "image/webp";
  }
}

export async function importPresenterImage(
  file: File,
): Promise<PresenterImage> {
  const bytes = await file.arrayBuffer();
  const type = imageType(bytes);
  if (!type) throw new Error("Choose a PNG, JPEG, or WebP image.");

  const stored = { id: crypto.randomUUID(), name: file.name, type, bytes };
  const image = asPresenterImage(stored);
  const url = URL.createObjectURL(image.blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
  } catch {
    throw new Error("This image couldn’t be opened.");
  } finally {
    URL.revokeObjectURL(url);
  }

  // Raw bytes also work in WebKit contexts that reject IndexedDB Blob writes.
  await imageStore("readwrite", (store) => store.add(stored));
  return image;
}
