import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { getLegalOperator } from "@/lib/legal";
import { loadLegalMarkdown, markdownToHtml } from "@/lib/legal-md";

export function LegalPage({ slug }: { slug: "terms" | "privacy" | "disclaimer" }) {
  const html = markdownToHtml(loadLegalMarkdown(slug));
  const op = getLegalOperator();

  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-gray-500 dark:text-zinc-500">
          <Link className="text-emerald-600 underline dark:text-emerald-400" href="/">
            ← x402 Vending Machine
          </Link>
        </p>
        {op.incomplete && (
          <div className="mt-4 rounded-lg border border-amber-600/50 bg-amber-50/60 px-4 py-3 text-sm text-amber-800/90 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200/90">
            <strong>Draft identity.</strong> Set Vercel env{" "}
            <code className="text-xs">{op.missing.join(", ")}</code> before treating this page as
            final. See <code className="text-xs">docs/t&amp;s/PREPUBLISH_CHECKLIST.md</code>.
          </div>
        )}
        <article
          className="legal-prose mt-6 leading-relaxed text-gray-700 dark:text-zinc-300"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
