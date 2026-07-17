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
        <p className="text-sm text-zinc-500">
          <Link className="text-emerald-400 underline" href="/">
            ← x402 Vending Machine
          </Link>
        </p>
        {op.incomplete && (
          <div className="mt-4 rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-200/90">
            <strong>Draft identity.</strong> Set Vercel env{" "}
            <code className="text-xs">{op.missing.join(", ")}</code> before treating this page as
            final. See <code className="text-xs">docs/t&amp;s/PREPUBLISH_CHECKLIST.md</code>.
          </div>
        )}
        <article
          className="legal-prose mt-6 text-zinc-300 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
