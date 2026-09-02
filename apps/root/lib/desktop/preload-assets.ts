import { preload } from "react-dom";

const DESKTOP_PRELOAD_IMAGES = [
  "/desktop/sequoia-light.jpg",
  "/icons/catalog-icon.webp",
  "/icons/customers-icon.webp",
  "/icons/cases-icon.webp",
  "/icons/operator-icon.webp",
  "/icons/signout-icon.webp",
] as const;

export function preloadDesktopAssets() {
  for (const href of DESKTOP_PRELOAD_IMAGES) {
    preload(href, { as: "image" });
  }
}
