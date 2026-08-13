"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/* The slide-out. Closing is `router.back()` rather than a route push, because
   the drawer only ever exists on top of the screen that opened it — going back
   returns there and leaves the history sane.

   Not a <dialog>: the content is streamed in by the intercepting route and a
   native modal would need imperative showModal() timing around that. The three
   things showModal would have given us are done by hand below — Escape, focus,
   and a scroll lock. */

export function Drawer({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") router.back();
    }
    document.addEventListener("keydown", onKey);

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    // Move focus into the panel so the keyboard is inside the drawer rather
    // than still on the list behind it.
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [router]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Close"
        onClick={() => router.back()}
        className="absolute inset-0 cursor-default bg-ink/25 backdrop-blur-[1px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Lead detail"
        tabIndex={-1}
        className="relative flex h-full w-full max-w-[720px] flex-col overflow-y-auto bg-page shadow-2xl outline-none"
      >
        <div className="sticky top-0 z-10 flex items-center justify-end border-b border-line bg-paper/95 px-5 py-2.5 backdrop-blur">
          <button
            onClick={() => router.back()}
            className="cursor-pointer rounded-sm px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.077em] text-muted transition-colors hover:text-brand"
          >
            Close ✕
          </button>
        </div>

        <div className="px-[clamp(16px,3vw,28px)] py-6">{children}</div>
      </div>
    </div>
  );
}
