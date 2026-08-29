import {
  MAX_ICON_DATA_URL_CHARS,
  customProviderIconSchema,
} from "./workspace-preferences";

export const MAX_SOURCE_ICON_BYTES = 1_500_000;
const ICON_SIZE = 128;

export async function normalizeProviderIcon(file: File): Promise<string> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > MAX_SOURCE_ICON_BYTES
  ) {
    throw new Error("unsupported_icon");
  }
  const image = await createImageBitmap(file);
  const scale = Math.min(1, ICON_SIZE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const context = canvas.getContext("2d");
  if (!context) {
    image.close();
    throw new Error("icon_canvas_unavailable");
  }
  context.drawImage(
    image,
    Math.round((ICON_SIZE - width) / 2),
    Math.round((ICON_SIZE - height) / 2),
    width,
    height,
  );
  image.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => {
        if (value) {
          resolve(value);
        } else {
          reject(new Error("icon_encode_failed"));
        }
      },
      "image/webp",
      0.86,
    );
  });
  const dataUrl = await blobToDataUrl(blob);
  if (
    dataUrl.length > MAX_ICON_DATA_URL_CHARS ||
    !customProviderIconSchema.safeParse(dataUrl).success
  ) {
    throw new Error("icon_too_large");
  }
  return dataUrl;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("icon_encode_failed"));
      }
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(blob);
  });
}
