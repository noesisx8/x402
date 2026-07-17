import { getLegalOperator, MARKET_DATA_SOURCES, OHLCV_SOURCES } from "@/lib/legal";
import { readFileSync } from "fs";
import path from "path";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyPlaceholders(md: string): string {
  const op = getLegalOperator();
  return md
    .replace(/\[OPERATOR LEGAL NAME\]/g, op.name)
    .replace(/\[OPERATOR CONTACT EMAIL\]/g, op.email)
    .replace(/\[OPERATOR ADDRESS\]/g, op.address)
    .replace(/\[GOVERNING LAW JURISDICTION\]/g, op.governingLaw)
    .replace(/\[VENUE\]/g, op.venue)
    .replace(/\[EFFECTIVE DATE\]/g, op.effectiveDate)
    .replace(/\[LAST UPDATED DATE\]/g, op.lastUpdated)
    .replace(/\[YEAR\]/g, op.year)
    // Confirmed OHLCV cascade (disclaimer + privacy)
    .replace(
      /public exchange APIs \(which may include Kraken, Bybit, or similar providers\)/gi,
      `public exchange APIs used in cascade: ${OHLCV_SOURCES}`,
    )
    .replace(
      /Public exchange APIs \(e\.g\., Kraken, Bybit, or similar\)/gi,
      `OHLCV: ${OHLCV_SOURCES}; spot/FX: ${MARKET_DATA_SOURCES}`,
    )
    // Drop attorney draft comments from published HTML
    .replace(/^\/\/ OPERATOR:.*$/gm, "")
    .replace(/\n{3,}/g, "\n\n");
}

/** Minimal Markdown → HTML for legal pages (headings, lists, tables, links, bold). */
export function markdownToHtml(md: string): string {
  const lines = applyPlaceholders(md).replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  let inUl = false;
  let inOl = false;
  let inTable = false;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length === 0) return;
    const text = para.join(" ").trim();
    if (text) out.push(`<p>${inline(text)}</p>`);
    para = [];
  };
  const closeLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };
  const closeTable = () => {
    if (inTable) {
      out.push("</tbody></table>");
      inTable = false;
    }
  };

  const inline = (s: string) => {
    let t = escapeHtml(s);
    t = t.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a class="text-emerald-400 underline hover:text-emerald-300" href="$2">$1</a>',
    );
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/`([^`]+)`/g, '<code class="text-emerald-300/90 text-sm">$1</code>');
    return t;
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "---") {
      flushPara();
      closeLists();
      closeTable();
      out.push('<hr class="border-zinc-800 my-8" />');
      i++;
      continue;
    }

    const h = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (h) {
      flushPara();
      closeLists();
      closeTable();
      const level = h[1].length;
      const raw = h[2].replace(/\*\*/g, "");
      const id = raw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      // Anchor for Acceptable Use (Section 6)
      const anchor =
        /acceptable use/i.test(raw) || /^6\./.test(raw) ? ' id="acceptable-use"' : ` id="${id}"`;
      const cls =
        level === 1
          ? "text-3xl font-semibold mt-2 mb-4"
          : level === 2
            ? "text-xl font-semibold mt-10 mb-3 text-zinc-100"
            : "text-lg font-medium mt-6 mb-2 text-zinc-200";
      out.push(`<h${level}${anchor} class="${cls}">${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushPara();
      closeLists();
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      const isSep = cells.every((c) => /^[-:]+$/.test(c));
      if (isSep) {
        i++;
        continue;
      }
      if (!inTable) {
        out.push(
          '<div class="overflow-x-auto my-4"><table class="w-full text-sm text-left border-collapse">',
        );
        out.push("<thead><tr>");
        for (const c of cells) {
          out.push(
            `<th class="border border-zinc-800 px-3 py-2 text-zinc-300 font-medium">${inline(c)}</th>`,
          );
        }
        out.push("</tr></thead><tbody>");
        inTable = true;
        i++;
        continue;
      }
      out.push("<tr>");
      for (const c of cells) {
        out.push(`<td class="border border-zinc-800 px-3 py-2 text-zinc-400">${inline(c)}</td>`);
      }
      out.push("</tr>");
      i++;
      continue;
    } else {
      closeTable();
    }

    const ul = /^[-*]\s+(.+)$/.exec(trimmed);
    if (ul) {
      flushPara();
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        out.push('<ul class="list-disc pl-6 my-3 space-y-1 text-zinc-400">');
        inUl = true;
      }
      out.push(`<li>${inline(ul[1])}</li>`);
      i++;
      continue;
    }

    const ol = /^(\d+)\.\s+(.+)$/.exec(trimmed);
    if (ol && !trimmed.startsWith("##")) {
      flushPara();
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        out.push('<ol class="list-decimal pl-6 my-3 space-y-1 text-zinc-400">');
        inOl = true;
      }
      out.push(`<li>${inline(ol[2])}</li>`);
      i++;
      continue;
    }

    if (trimmed === "") {
      flushPara();
      closeLists();
      i++;
      continue;
    }

    closeLists();
    para.push(trimmed);
    i++;
  }

  flushPara();
  closeLists();
  closeTable();
  return out.join("\n");
}

export function loadLegalMarkdown(slug: "terms" | "privacy" | "disclaimer"): string {
  const file = path.join(process.cwd(), "content", "legal", `${slug}.md`);
  return readFileSync(file, "utf8");
}
