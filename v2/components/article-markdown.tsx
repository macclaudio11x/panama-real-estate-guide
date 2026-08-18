import { type Components } from "react-markdown";
import { ArticleChart, parseChartSpec } from "@/components/article-chart";

/* =============================================================================
   Shared article body rendering
   =============================================================================
   Lifted out of the English article route when the German one arrived. Two
   copies of a heading-slugger and a chart interceptor is two copies that drift,
   and the failure mode is silent: a table stops scrolling on one language only,
   or a `#anchor` in a German page lands on nothing because the two slugifiers
   disagree about umlauts.

   The mid-article CTA split stays with the English route. It is a placement
   decision about a component the German tree does not render yet, not part of
   how markdown becomes HTML.
   ============================================================================= */

/* Shared by the heading renderer and the TOC extraction, so an anchor link
   always lands on the heading that produced it.

   German headings feed this too. `ä ö ü ß` are stripped rather than
   transliterated, which collapses "Grundstück" to "grundst-ck" — ugly in a
   URL fragment, but stable and collision-free, and changing the rule now would
   break every `#anchor` already published in English. */
export const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export function extractHeadings(markdown: string) {
  const matches = [...markdown.matchAll(/^##\s+(.+)$/gm)];
  return matches.map((m) => ({ id: slugify(m[1]), label: m[1] }));
}

/* Hoisted so both halves of a split body — and both languages — render
   identically. Inline in the JSX this was a fresh object per block, which is
   also how the two halves would drift apart the first time one was edited. */
export const markdownComponents: Components = {
  h2: ({ children }) => <h2 id={slugify(String(children))}>{children}</h2>,
  table: ({ children }) => (
    <div className="table-scroll">
      <table>{children}</table>
    </div>
  ),
  /* ```chart blocks render as a figure. Intercepted at `pre` rather than
     `code` because react-markdown wraps fenced code in <pre>, and a <figure>
     inside <pre> is invalid HTML that would also inherit monospace styling.
     Reads the hast node so the raw JSON is available before React escapes it.
     Anything that is not a valid chart falls through to a normal code block,
     so a typo shows the JSON rather than breaking the page. */
  pre: ({ node, children }) => {
    const code = node?.children?.[0];
    const cls = code?.type === "element" ? code.properties?.className : null;
    const isChart = Array.isArray(cls) && cls.includes("language-chart");
    if (isChart && code?.type === "element") {
      const first = code.children?.[0];
      const spec = first?.type === "text" ? parseChartSpec(first.value) : null;
      if (spec) return <ArticleChart spec={spec} />;
    }
    return <pre>{children}</pre>;
  },
};
