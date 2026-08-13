"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/* Submits on Enter rather than on every keystroke. A debounced search would
   fire a query per pause while someone types a phone number, and the result
   that matters here is the one they get after typing all of it. */

export function AdminSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const onSearchPage = pathname === "/admin/search";
  const [value, setValue] = useState(onSearchPage ? (params.get("q") ?? "") : "");

  // Leaving the results page clears the box, so the term does not sit there
  // looking like a filter still applied to whatever you navigated to.
  useEffect(() => {
    if (!onSearchPage) setValue("");
  }, [onSearchPage]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // "/" is the search shortcut everywhere else; honour it unless the
      // person is already typing into something.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (q.length < 2) return;
        router.push(`/admin/search?q=${encodeURIComponent(q)}`);
      }}
      className="relative w-full max-w-[420px]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint text-[13px]"
      >
        ⌕
      </span>
      <input
        ref={inputRef}
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search name, email, phone, reference…"
        aria-label="Search leads"
        className="w-full rounded-sm border border-line bg-paper-warm py-2 pl-8 pr-3 text-[14px] text-body placeholder:text-faint outline-none focus:border-brand focus:bg-paper transition-colors"
      />
    </form>
  );
}
