"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Area, Project } from "@/lib/content";
import { usd, m2 } from "@/lib/content";
import { localePath, statusLabelFor, type PageLocale } from "@/lib/i18n";
import { mediaUrl } from "@/lib/media";

/* =============================================================================
   Project card
   =============================================================================
   Photo stepping is the portal convention buyers already know, and we have five
   photographs per project sitting unused behind the first one. Arrows appear on
   hover and on keyboard focus; both call preventDefault so stepping never
   navigates the wrapping link.

   No title badge and no "developer listing" note here on purpose. Both are
   identical on every card in the grid, so per-card they are noise rather than
   information — that disclosure sits once above the results instead.
   ============================================================================= */

export function ProjectCard({
  project: p,
  area,
  locale = "en",
}: {
  project: Project;
  area: Area | undefined;
  /* Defaults to "en" so every existing call site is unchanged. Same convention
     as SiteHeader and AreaCard. */
  locale?: PageLocale;
}) {
  const [i, setI] = useState(0);
  const photos = p.photos;
  const many = photos.length > 1;

  const step = (e: React.MouseEvent, delta: number) => {
    e.preventDefault();
    e.stopPropagation();
    setI((n) => (n + delta + photos.length) % photos.length);
  };

  const specs = [
    p.bedsMin != null
      ? `${p.bedsMin === p.bedsMax ? p.bedsMin : `${p.bedsMin}–${p.bedsMax}`} bed`
      : null,
    p.sizeFromM2 != null ? `from ${m2(p.sizeFromM2)}` : null,
    p.models.length
      ? `${p.models.length} unit type${p.models.length === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);

  return (
    <Link
      href={localePath(locale, `/projects/${p.slug}`)}
      className="group/card flex flex-col rounded-md border border-line bg-white overflow-hidden no-underline shadow-sm hover:shadow-md hover:border-brand-300 transition-all duration-200"
    >
      <div className="relative aspect-[4/3] bg-brand-900 overflow-hidden">
        {photos[i] && (
          <Image
            src={mediaUrl(photos[i].src)!}
            alt={photos[i].alt ?? `${p.name}${area ? `, ${area.name}` : ""} — photo ${i + 1} of ${photos.length}`}
            fill
            sizes="(max-width: 680px) 100vw, (max-width: 1080px) 50vw, 33vw"
            className="object-cover"
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-brand-900/85 via-brand-900/20 to-transparent"
        />

        {many && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={(e) => step(e, -1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-ink font-bold leading-none opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 hover:bg-white transition-opacity cursor-pointer"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={(e) => step(e, 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-ink font-bold leading-none opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 hover:bg-white transition-opacity cursor-pointer"
            >
              ›
            </button>
            <span className="absolute top-2.5 right-2.5 rounded-full bg-brand-900/70 px-2 py-0.5 font-mono text-[10.5px] text-white tnum">
              {i + 1}/{photos.length}
            </span>
          </>
        )}

        <div className="absolute inset-x-0 bottom-0 p-5">
          {p.status && (
            <p className="font-mono text-[11px] uppercase tracking-[0.077em] text-white/70">
              {statusLabelFor(locale, p.status)}
            </p>
          )}
          <p className="font-display text-[24px] font-bold tracking-[-0.0204em] text-white leading-tight">
            {p.name}
          </p>
        </div>
      </div>

      <div className="flex flex-col flex-1 p-5">
        <p className="font-display text-[24px] font-bold text-ink tnum leading-none">
          from {usd(p.priceFromUsd)}
          {p.priceToUsd && p.priceToUsd !== p.priceFromUsd && (
            <span className="text-muted font-semibold text-[17px]">
              {" "}
              to {usd(p.priceToUsd)}
            </span>
          )}
        </p>

        {specs.length > 0 && (
          <p className="mt-2.5 text-[14.5px] text-body">{specs.join(" · ")}</p>
        )}

        {/* Location is a primary filter criterion, so it reads as a fact rather
            than a caption. */}
        {area && (
          <p className="mt-auto pt-3.5 font-display text-[14.5px] font-semibold text-brand">
            {area.name}
            <span className="font-body font-normal text-muted">
              {" "}
              · {area.region}
            </span>
          </p>
        )}
      </div>
    </Link>
  );
}
