import Link from "next/link";
import type { Area } from "@/lib/content";
import { usd } from "@/lib/content";
import { localePath, ui, type PageLocale } from "@/lib/i18n";
import { Stamp, TitleBadge, SourceNote } from "@/components/ui";
import { MediaSlot } from "@/components/media-slot";

export function AreaCard({
  area,
  locale = "en",
}: {
  area: Area;
  /* Defaults to "en" so every existing call site is unchanged. Same convention
     as SiteHeader. The German tree passes "de" and gets a /de/regionen href and
     German chrome from the same markup. */
  locale?: PageLocale;
}) {
  const t = locale === "en" ? null : ui(locale);
  const detail = [
    area.elevationM != null ? `${area.elevationM}m` : null,
    area.climate,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={localePath(locale, `/areas/${area.slug}`)}
      className="group flex flex-col rounded-md border border-line bg-white overflow-hidden no-underline shadow-sm hover:shadow-md hover:border-brand-300 transition-all duration-200"
    >
      <MediaSlot
        src={area.photo}
        alt={area.photoAlt ?? `${area.name}, ${area.region}`}
        eyebrow={area.region}
        title={area.name}
        detail={detail || undefined}
      />

      <div className="flex flex-col flex-1 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-[19px] font-bold text-ink tnum">
            {area.priceToUsd && area.priceToUsd !== area.priceFromUsd
              ? `${usd(area.priceFromUsd)} – ${usd(area.priceToUsd)}`
              : `${t ? t.priceFrom : "from"} ${usd(area.priceFromUsd)}`}
          </p>
          <p className="font-mono text-[12px] text-muted tnum">
            {area.projectCount}{" "}
            {t
              ? t.projectsCount
              : `project${area.projectCount === 1 ? "" : "s"}`}
          </p>
        </div>

        {area.positioning && (
          <p className="mt-3 text-[15px] leading-relaxed text-muted flex-1">
            {area.positioning}
          </p>
        )}

        <div className="mt-4 pt-4 border-t border-line-soft">
          <TitleBadge status={area.titleStatus} locale={locale} />
          {area.titleNote && (
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-body">
              {area.titleNote}
            </p>
          )}
          <div className="mt-3.5">
            {area.verifiedOn ? (
              <Stamp on={area.verifiedOn} locale={locale} />
            ) : (
              <SourceNote>{t ? t.pricesAsListed : "Prices as listed by developers"}</SourceNote>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
