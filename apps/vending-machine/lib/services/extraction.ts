import { load } from "cheerio";

/** Parse bounded HTML as inert data; never execute scripts or follow extracted links. */
export function extractHtml(html: string, sourceUrl: string, maxChars: number) {
  const $ = load(html);
  $("script,style,noscript,iframe,svg,template").remove();
  const clean = (value: string) => value.replace(/\s+/g, " ").trim();
  const headings = $("h1,h2,h3,h4,h5,h6").toArray().slice(0, 100).map(el => ({
    level: Number(el.tagName.slice(1)), text: clean($(el).text()).slice(0, 200),
  }));
  const links = $("a[href]").toArray().slice(0, 100).flatMap(el => {
    try {
      const url = new URL($(el).attr("href")!, sourceUrl);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.href.length > 2048) return [];
      return [{ text: clean($(el).text()).slice(0, 200), url: url.href }];
    } catch { return []; }
  });
  const text = clean($("body").text());
  const blocks = $("h1,h2,h3,h4,h5,h6,p,li,pre,blockquote").toArray().filter(el =>
    $(el).parents("p,li,pre,blockquote").length === 0);
  const markdown = blocks.map(el => {
    const body = clean($(el).text()).replace(/([\\`*_\[\]<>])/g, "\\$1");
    if (/^h[1-6]$/.test(el.tagName)) return `${"#".repeat(Number(el.tagName.slice(1)))} ${body}`;
    return `${el.tagName === "li" ? "- " : el.tagName === "blockquote" ? "> " : ""}${body}`;
  }).filter(Boolean).join("\n\n") || text;
  return { title: clean($("title").first().text()).slice(0, 200) || null,
    text: text.slice(0, maxChars), markdown: markdown.slice(0, maxChars), headings, links,
    truncated: text.length > maxChars || markdown.length > maxChars || $("a[href]").length > 100 || $("h1,h2,h3,h4,h5,h6").length > 100 };
}
