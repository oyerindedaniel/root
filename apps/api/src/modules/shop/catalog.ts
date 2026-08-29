import type { ShopProduct } from "@repo/contracts";

export const CATALOG: ShopProduct[] = [
  {
    id: "kbd-wireless",
    name: "Wireless Keyboard",
    description: "Compact wireless keyboard for desk kits.",
    priceUsd: 42,
  },
  {
    id: "mse-silent",
    name: "Silent Mouse",
    description: "Low-profile silent mouse for desk kits.",
    priceUsd: 18,
  },
  {
    id: "usb-hub",
    name: "USB-C Hub",
    description: "Four-port USB-C hub for peripherals.",
    priceUsd: 36,
  },
  {
    id: "desk-mat",
    name: "Desk Mat",
    description: "Large desk mat in charcoal.",
    priceUsd: 24,
  },
  {
    id: "hdmi-cable",
    name: "HDMI Cable",
    description: "Two-meter HDMI cable.",
    priceUsd: 12,
  },
];

export function searchCatalog(query: string): ShopProduct[] {
  const needle = query.trim().toLowerCase();
  const matches: ShopProduct[] = [];
  for (const product of CATALOG) {
    if (
      product.name.toLowerCase().includes(needle) ||
      product.description.toLowerCase().includes(needle)
    ) {
      matches.push(product);
      if (matches.length >= 12) {
        break;
      }
    }
  }
  return matches;
}
