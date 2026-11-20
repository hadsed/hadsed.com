// Reading-page helpers: Obsidian callouts and the table of contents.

// Obsidian callouts: a blockquote whose first line is [!type] Title.
//   > [!note] Why Astra?        a callout titled "Why Astra?"
//   > [!tip]                    titled "Tip"
//   > [!warning]- Spoilers      folded (click the title to open); [!warning]+ starts open
// Everything after the first line is the body. Runs after block parsing, before inline,
// so the title and body still get links, emphasis and [[wikilinks]].
export function markdownCallouts(md) {
  md.core.ruler.after("block", "callouts", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const open = tokens[i];
      if (open.type !== "blockquote_open") continue;
      const p = tokens[i + 1], inline = tokens[i + 2];
      if (p?.type !== "paragraph_open" || inline?.type !== "inline") continue;
      const m = inline.content.match(/^\[!([\w-]+)\]([+-]?)[ \t]*([^\n]*)(?:\n([\s\S]*))?$/);
      if (!m) continue;
      const [, rawType, fold, title, rest = ""] = m;
      const type = rawType.toLowerCase();
      const close = tokens.findIndex((t, j) => j > i && t.type === "blockquote_close" && t.level === open.level);
      const tag = fold ? "details" : "div";
      open.tag = tokens[close].tag = tag;
      open.attrSet("class", `callout callout-${type}`);
      if (fold === "+") open.attrSet("open", "");

      const head = new state.Token("callout_title_open", fold ? "summary" : "p", 1);
      head.attrSet("class", "callout-title");
      head.block = true;
      const text = new state.Token("inline", "", 0);
      text.content = title.trim() || type[0].toUpperCase() + type.slice(1);
      text.children = [];
      const headClose = new state.Token("callout_title_close", fold ? "summary" : "p", -1);
      headClose.block = true;
      [head, text, headClose].forEach((t) => { t.level = p.level; t.map = p.map; });

      if (rest.trim()) {
        inline.content = rest;
        tokens.splice(i + 1, 0, head, text, headClose);
      } else {
        tokens.splice(i + 1, 3, head, text, headClose);   // title only: drop the now-empty paragraph
      }
    }
  });
}

const decode = (s) =>
  s.replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[e]);

// Headings with ids in rendered HTML, as a tree like Obsidian's outline: [{ id, text, children }].
// Depth counts from the page's top section level (a post may start its sections at # or ##);
// three levels are kept.
export function tocFrom(html = "", levels = 3) {
  const found = [...String(html).matchAll(/<h([1-6])\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g)].map(([, level, id, inner]) => ({
    level: +level,
    id,
    text: decode(inner.replace(/<a class="anchor"[^>]*>#<\/a>/, "").replace(/<[^>]+>/g, "").trim()),
  }));
  if (!found.length) return [];
  const top = Math.min(...found.map((h) => h.level));
  const root = { children: [] };
  const stack = [{ depth: 0, node: root }];
  for (const h of found) {
    const depth = h.level - top + 1;
    if (depth > levels) continue;
    while (stack.at(-1).depth >= depth) stack.pop();
    const node = { id: h.id, text: h.text, children: [] };
    stack.at(-1).node.children.push(node);
    stack.push({ depth, node });
  }
  return root.children;
}
