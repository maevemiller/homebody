"use client";

import type { Product } from "@/lib/play/catalog";
import { thumbOf } from "./thumbs";

export const THUMB = { md: "h-14 w-14", lg: "h-[68px] w-[68px]", xl: "h-24 w-24" } as const;

/**
 * A product's picture: a real piece's listing photo (Amazon.com, CC BY 4.0), or a sample's small render of
 * its own model. A soft wash of its color stands in until either is ready.
 */
export function ProductThumb({ product, size = "md" }: { product: Product; size?: keyof typeof THUMB }) {
  const src = product.real?.image ?? thumbOf(product.id);
  return (
    <span className={`${THUMB[size]} shrink-0 rounded-lg ${product.real ? "bg-white" : "bg-surface-2"} overflow-hidden grid place-items-center`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className={`h-full w-full object-contain animate-[fade_0.35s_ease-out] ${product.real ? "p-1 mix-blend-multiply" : ""}`} draggable={false} />
      ) : (
        <span aria-hidden className="h-3/5 w-3/5 rounded-full blur-md opacity-60" style={{ background: product.color }} />
      )}
    </span>
  );
}
