import Image from "next/image";
import { Manrope } from "next/font/google";

// Matches the Claude Design source, which specifies Manrope — kept scoped to
// just this block rather than switching the site's own type stack.
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  display: "swap",
});

/* =============================================================================
   Hero price collage
   =============================================================================
   Ported 1:1 from the Claude Design project "Panama Price Animation.html" —
   same text, same prices, same layout. Source of truth:
   claude.ai/design/p/92f65966-f7e9-4d0e-b563-7af8251b6ed1
   ============================================================================= */

type Pill = {
  city: string;
  oldPrice: string;
  newPrice: string;
  badge: string;
  left: string;
  top: string;
  floatDuration: string;
  entranceDelay: number;
  cycleDelay: number;
  pillMinWidth: string;
  valueMinWidth: string;
};

const PILLS: Pill[] = [
  {
    city: "Panamá City",
    oldPrice: "$320,000",
    newPrice: "$368,000",
    badge: "+15%",
    left: "39.2%",
    top: "19.3%",
    floatDuration: "6.5s",
    entranceDelay: 0,
    cycleDelay: 0,
    pillMinWidth: "29.6cqw",
    valueMinWidth: "11.5cqw",
  },
  {
    city: "Coronado",
    oldPrice: "$580,000",
    newPrice: "$650,000",
    badge: "+12%",
    left: "12.3%",
    top: "40.1%",
    floatDuration: "7.4s",
    entranceDelay: 0.18,
    cycleDelay: 0.5,
    pillMinWidth: "29.6cqw",
    valueMinWidth: "11.5cqw",
  },
  {
    city: "El Valle",
    oldPrice: "$1,100,000",
    newPrice: "$1,320,000",
    badge: "+20%",
    left: "12.4%",
    top: "68.4%",
    floatDuration: "6.9s",
    entranceDelay: 0.36,
    cycleDelay: 1,
    pillMinWidth: "29.2cqw",
    valueMinWidth: "12.9cqw",
  },
  {
    city: "Boquete",
    oldPrice: "$2,150,000",
    newPrice: "$2,475,000",
    badge: "+15%",
    left: "38.5%",
    top: "88.0%",
    floatDuration: "7.8s",
    entranceDelay: 0.54,
    cycleDelay: 1.5,
    pillMinWidth: "32.4cqw",
    valueMinWidth: "12.9cqw",
  },
];

export function HeroPriceCollage() {
  return (
    <div className={manrope.className}>
      <div
        className="relative w-full"
        style={{
          aspectRatio: "1 / 1",
          containerType: "inline-size",
          ["--cyc" as string]: "11s",
          ["--pill" as string]: "#e9f5e3",
          ["--deep" as string]: "#1f6b2b",
          ["--accent-deep" as string]: "#2f8f3f",
        }}
      >
        <div className="absolute inset-0 overflow-hidden rounded-md">
          <Image
            src="/hero-price-collage.png"
            alt="Panamá real estate collage"
            fill
            priority
            sizes="(max-width: 980px) 100vw, 46vw"
            className="hero-price-photo object-contain"
            style={{ transformOrigin: "60% 55%" }}
          />
        </div>

        {PILLS.map((p) => (
          <div
            key={p.city}
            className="hero-price-pill-wrap absolute"
            /* The two pills on the right of the collage are marked so the
               stylesheet can anchor them to the right edge on a narrow screen.
               A fixed `left` plus text that no longer scales with the container
               pushes them past it — see the note in globals.css. Derived from
               the position rather than hardcoded, so moving a pill in PILLS
               cannot leave the flag pointing at the wrong one. */
            data-side={parseFloat(p.left) >= 30 ? "right" : "left"}
            style={{
              /* `left` goes through a custom property and is applied by the
                 stylesheet, while `top` is set directly. Not an inconsistency:
                 an inline `left` outranks any selector, so the narrow-screen
                 rule that re-anchors these pills to the right edge could not
                 override it without !important — and with both `left` and
                 `right` in effect the pill stretches between them, squeezes its
                 flex children, and the price slides under the city name. `top`
                 is never overridden, so it stays where it reads most plainly. */
              ["--pill-left" as string]: p.left,
              top: p.top,
              animationDuration: p.floatDuration,
            }}
          >
            <div
              className="hero-price-pill"
              style={{
                minWidth: p.pillMinWidth,
                // Two animations on this element (heroPillIn, heroPulse) —
                // this list is positional, matching the class's animation order.
                animationDelay: `${p.entranceDelay}s, ${p.cycleDelay}s`,
              }}
            >
              <div className="hero-price-value" style={{ minWidth: p.valueMinWidth }}>
                <span className="hero-price-old" style={{ animationDelay: `${p.cycleDelay}s` }}>
                  {p.oldPrice}
                </span>
                <span className="hero-price-strike" style={{ animationDelay: `${p.cycleDelay}s` }} />
                <span className="hero-price-new" style={{ animationDelay: `${p.cycleDelay}s` }}>
                  {p.newPrice}
                </span>
              </div>
              <span className="hero-price-name">{p.city}</span>
              <span className="hero-price-badge" style={{ animationDelay: `${p.cycleDelay}s` }}>
                {p.badge}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
