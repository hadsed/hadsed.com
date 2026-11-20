// The content model behind projects, the blog and notes, read straight from content/.
//
// URLs (frozen once published; scripts/check-urls.mjs fails a deploy that drops one):
//   content/projects/<file>.md -> /projects/<slug or file>/
//   content/blog/<file>.md     -> /blog/<date>-<slug or file>/   (a date prefix on the file is not repeated)
//   content/notes/<file>.md    -> /notes/<slug or file>/
// Obsidian [[wikilinks]] resolve by file name (what Obsidian autocompletes) or by slug, and may
// point at a heading: [[file#Heading]]. A project lists its blog posts and key notes in front
// matter (posts: / notes:), so a post's "Appears in" and every page's backlinks are derived here.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import matter from "gray-matter";

export const KINDS = ["projects", "blog", "notes"];

export const slugify = (text) =>
  String(text).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Role files carry their start date as a prefix (2017-06-ontra.md) so they sort in Obsidian.
export const roleSlug = (key) => key.replace(/^\d{4}(-\d{2})?-/, "");
const undated = (key) => key.replace(/^\d{4}-\d{2}-\d{2}-/, "");

export const isoDate = (value) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  return s.slice(0, 10);
};

export function urlFor(kind, key, data = {}) {
  const slug = data.slug ? slugify(data.slug) : null;
  if (kind === "projects") return `/projects/${slug || key}/`;
  if (kind === "notes") return `/notes/${slug || key}/`;
  if (kind === "blog") {
    const date = isoDate(data.date);
    if (!date) throw new Error(`content/blog/${key}: a blog post needs a date (YYYY-MM-DD) in its front matter`);
    return `/blog/${date}-${slug || undated(key)}/`;
  }
  throw new Error(`No URL rule for ${kind}`);
}

// Heading anchors, numbered like the markdown renderer numbers them (src: eleventy.config.js).
export function headingIds(body) {
  const ids = [];
  const seen = new Map();
  let fence = false;
  for (const line of body.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (fence) continue;
    const m = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (m) ids.push(uniqueId(slugify(m[1]), seen));
  }
  return ids;
}
export function uniqueId(base, seen) {
  const id = base || "section";
  const n = seen.get(id) || 0;
  seen.set(id, n + 1);
  return n ? `${id}-${n + 1}` : id;
}

// Last commit that touched a file (needs full history: the deploy checks out with fetch-depth 0).
function gitDate(path) {
  try {
    return execFileSync("git", ["log", "-1", "--format=%cs", "--", path], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch { return null; }
}

const WIKILINK = /(!?)\[\[([^\]|#]*)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;
const linkTarget = (value) => String(value ?? "").trim().replace(/^\[\[/, "").replace(/\]\]$/, "").split(/[|#]/)[0].trim();

function readKind(kind) {
  const dir = `content/${kind}`;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => /\.(md|html)$/.test(file))
    .map((file) => {
      const key = file.replace(/\.(md|html)$/, "");
      const path = `${dir}/${file}`;
      const { data, content } = matter(readFileSync(path, "utf8"));
      return { kind, key, path, data, body: content };
    });
}

export function buildModel() {
  const pages = [];
  for (const kind of KINDS) {
    for (const f of readKind(kind)) {
      pages.push({
        ...f,
        url: urlFor(kind, f.key, f.data),
        title: f.data.title || f.key,
        date: kind === "blog" ? isoDate(f.data.date) : null,
        headings: new Set(headingIds(f.body)),
      });
    }
  }

  // Link targets: file name, file name without a date prefix, and slug.
  const targets = new Map();
  const claim = (name, target) => {
    if (!name) return;
    const prior = targets.get(name);
    if (prior && prior.url !== target.url) throw new Error(`Two pages answer to [[${name}]]: ${prior.url} and ${target.url}`);
    targets.set(name, target);
  };
  for (const p of pages) {
    claim(p.key, p);
    if (p.kind === "blog") claim(undated(p.key), p);
    if (p.data.slug) claim(slugify(p.data.slug), p);
  }
  if (existsSync("content/experience")) {
    for (const f of readKind("experience")) {
      const t = { kind: "experience", url: `/experience/#${roleSlug(f.key)}`, title: f.data.org || roleSlug(f.key), headings: new Set() };
      claim(f.key, t);
      claim(roleSlug(f.key), t);
    }
  }

  const byUrl = new Map(pages.map((p) => [p.url, p]));
  const backlinks = {};
  const appearsIn = {};
  const addBacklink = (target, from, context) => {
    const list = (backlinks[target.url] ||= []);
    if (target.url === from.url || list.some((b) => b.url === from.url)) return;
    list.push({ url: from.url, title: from.title, kind: from.kind, date: from.date, context });
  };

  for (const p of pages) {
    for (const para of p.body.split(/\n\s*\n/)) {
      for (const m of para.matchAll(WIKILINK)) {
        if (m[1]) continue; // embed
        const target = targets.get(m[2].trim());
        if (!target || target.kind === "experience") continue;
        addBacklink(target, p, contextFor(para, target, targets));
      }
    }
  }

  // Projects: resolve their posts and notes, and when they were last active.
  const projects = [];
  for (const p of pages.filter((x) => x.kind === "projects")) {
    const resolve = (field, kind) =>
      [].concat(p.data[field] || []).map((entry) => {
        const name = linkTarget(entry);
        const hit = targets.get(name);
        if (!hit || hit.kind !== kind) throw new Error(`${p.path}: ${field} lists [[${name}]], which is not a ${kind === "blog" ? "blog post" : "note"}`);
        return hit;
      });
    const posts = resolve("posts", "blog").sort((a, b) => (a.date < b.date ? 1 : -1));
    const notes = resolve("notes", "notes");
    for (const post of posts) {
      (appearsIn[post.url] ||= []).push({ url: p.url, title: p.title });
      addBacklink(post, p, null);
    }
    for (const note of notes) addBacklink(note, p, null);
    const updated = [gitDate(p.path), ...posts.map((x) => x.date)].filter(Boolean).sort().pop() || null;
    projects.push({
      url: p.url,
      title: p.title,
      summary: p.data.summary || "",
      status: p.data.status || null,
      started: p.data.started ? String(p.data.started) : p.data.year ? String(p.data.year) : null,
      updated,
      posts: posts.map((x) => ({ url: x.url, title: x.title, date: x.date, summary: x.data.summary || "" })),
      notes: notes.map((x) => ({ url: x.url, title: x.title, summary: x.data.summary || "" })),
    });
  }
  projects.sort((a, b) => (b.updated || "").localeCompare(a.updated || "") || a.title.localeCompare(b.title));

  const notes = pages
    .filter((x) => x.kind === "notes")
    .map((x) => ({ url: x.url, title: x.title, summary: x.data.summary || "", tended: gitDate(x.path) }))
    .sort((a, b) => (b.tended || "").localeCompare(a.tended || "") || a.title.localeCompare(b.title));

  // Redirects: renamed projects and notes keep their old addresses.
  const redirects = [];
  for (const p of pages.filter((x) => x.kind !== "blog")) {
    const olds = new Set([].concat(p.data.redirect_from || []).map((s) => slugify(linkTarget(s))));
    if (p.data.slug && slugify(p.data.slug) !== p.key) olds.add(p.key);
    for (const old of olds) {
      const from = `/${p.kind}/${old}/`;
      if (from !== p.url) redirects.push([from, p.url]);
    }
  }

  const tended = {};
  for (const n of notes) tended[n.url] = n.tended;
  return {
    targets, byUrl, backlinks, appearsIn, redirects, tended,
    projects, projectByUrl: Object.fromEntries(projects.map((p) => [p.url, p])), notes,
  };
}

// The paragraph around a link, as plain text, with the link itself marked.
const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function contextFor(para, target, targets) {
  let text = para
    .replace(WIKILINK, (all, embed, name, heading, alias) => {
      if (embed) return "";
      const hit = name.trim() ? targets.get(name.trim()) : null;
      const shown = alias ? alias.trim() : hit ? hit.title : name.trim() || (heading || "").trim();
      return hit && hit.url === target.url ? `\u0001${shown}\u0002` : shown;
    })
    .replace(/<(title|script|style)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/^\s*(#{1,6}|[-*+]|\d+\.|>)\s+/gm, "")
    .replace(/(\*\*|__|`)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const at = text.indexOf("\u0001");
  if (text.length > 260) {
    const start = Math.max(0, Math.min(at - 100, text.length - 260));
    text = (start > 0 ? "… " : "") + text.slice(start, start + 260).trim() + (start + 260 < text.length ? " …" : "");
  }
  const html = escapeHtml(text).replace("\u0001", "<mark>").replace("\u0002", "</mark>");
  return html.includes("<mark>") && !html.includes("</mark>") ? html + "</mark>" : html.replace("</mark>", html.includes("<mark>") ? "</mark>" : "");
}
