#!/usr/bin/env node
// Draft preview: shows vault drafts on the dev site while you keep editing them in Obsidian.
//
//   VAULT=~/unstructured-space node scripts/draft-preview.mjs vlm-pointing-benchmark          # copy once
//   VAULT=~/unstructured-space node scripts/draft-preview.mjs --watch vlm-pointing-benchmark  # copy on every save
//   VAULT=~/unstructured-space npm run drafts -- vlm-pointing-benchmark                      # watch + eleventy --serve
//
// For each draft folder named (hadsed.com/drafts/<name>/ in the vault) it writes
//   content/blog/draft-<name>.md   the draft, front matter filled in so the blog accepts it
//   content/assets/<embed>         every ![[...]] the draft embeds, found anywhere in the vault;
//                                  an .html embed in a folder brings its whole folder (its images)
// Lines that embed a preview-*.png are dropped: those are Obsidian's stand-ins for the .html embeds.
// Everything written is removed again on the next run: the paths are
// listed in .draft-preview.json (gitignored) so a later run can clean them up.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, watch, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { homedir } from "node:os";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const WATCH = args.includes("--watch");
const names = args.filter((a) => !a.startsWith("--"));
const VAULT = resolve((process.env.VAULT || "").replace(/^~(?=\/|$)/, homedir()));
if (!process.env.VAULT || !existsSync(join(VAULT, "hadsed.com", "drafts"))) {
  console.error("Set VAULT to the Obsidian vault folder (the one that holds hadsed.com/drafts/).");
  process.exit(1);
}
const DRAFTS = join(VAULT, "hadsed.com", "drafts");
if (!names.length) {
  console.error("Name one or more drafts: " + readdirSync(DRAFTS).filter((d) => !d.startsWith("_") && !d.startsWith(".")).join(", "));
  process.exit(1);
}
const MANIFEST = join(ROOT, ".draft-preview.json");

// every file in the vault by its path relative to the vault, for resolving ![[...]] like Obsidian does
function vaultFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p); else out.push(relative(VAULT, p));
    }
  };
  walk(VAULT);
  return out;
}
// Obsidian's rule, roughly: an exact path, else the path suffix, preferring files near the note
function find(files, link, near) {
  const hits = files.filter((f) => f === link || f.endsWith("/" + link));
  if (hits.length <= 1) return hits[0];
  return hits.find((f) => f.startsWith(near)) || hits[0];
}

// a draft without a date keeps the one its last preview got, so the preview URL stays put
function previousDate(name) {
  const p = join(ROOT, "content", "blog", `draft-${name}.md`);
  const m = existsSync(p) && readFileSync(p, "utf8").match(/^date:\s*(\d{4}-\d{2}-\d{2})/m);
  return m ? m[1] : null;
}

function frontMatter(text, name, keepDate) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  const fm = m ? m[1] : "";
  const body = m ? text.slice(m[0].length) : text;
  const has = (k) => new RegExp(`^${k}:[ \\t]*\\S`, "m").test(fm);
  const keep = fm.split("\n").filter((l) => !/^(date|slug|summary):\s*$/.test(l));
  if (!has("title")) keep.push(`title: ${name}`);
  if (!has("date")) keep.push(`date: ${keepDate || new Date().toISOString().slice(0, 10)}`);
  if (!has("slug")) keep.push(`slug: draft-${name}`);
  if (!has("summary")) keep.push("summary: Draft preview");
  return `---\n${keep.filter(Boolean).join("\n")}\n---\n${body}`;
}

function sync() {
  const dates = Object.fromEntries(names.map((n) => [n, previousDate(n)]));
  const old = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : [];
  for (const p of old) rmSync(join(ROOT, p), { recursive: true, force: true });
  const written = [], files = vaultFiles(), missing = [];
  for (const name of names) {
    const src = join(DRAFTS, name, "draft.md");
    if (!existsSync(src)) { console.error(`no draft at ${src}`); continue; }
    let text = readFileSync(src, "utf8");
    text = text.split("\n").filter((l) => !/^!\[\[preview-[^\]]*\.png(\|[^\]]*)?\]\]\s*$/.test(l)).join("\n");
    const near = relative(VAULT, join(DRAFTS, name));
    for (const [, raw] of text.matchAll(/!\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) {
      const link = raw.trim();
      const hit = find(files, link, near);
      if (!hit) { missing.push(link); continue; }
      let from = join(VAULT, hit), to = join("content", "assets", link);
      if (/\.(html|js)$/.test(link) && link.includes("/")) {        // a widget folder: bring its data and images too
        from = dirname(from); to = dirname(to);
      }
      if (existsSync(join(ROOT, to)) && !old.includes(to)) continue;  // a real site asset: leave it alone
      mkdirSync(dirname(join(ROOT, to)), { recursive: true });
      cpSync(from, join(ROOT, to), { recursive: true });
      if (!written.includes(to)) written.push(to);
    }
    // a draft with figure scripts also gets the figure kit (ui.css, ui.js) from the vault's design-system folder
    const KIT = join(VAULT, "hadsed.com", "design-system"), kitTo = join("content", "assets", "kit");
    if (/!\[\[[^\]|]+\.js(\|[^\]]*)?\]\]/.test(text) && existsSync(join(KIT, "ui.css")) && !written.includes(kitTo)) {
      mkdirSync(join(ROOT, kitTo), { recursive: true });
      for (const f of ["ui.css", "ui.js"]) cpSync(join(KIT, f), join(ROOT, kitTo, f));
      written.push(kitTo);
    }
    const out = join("content", "blog", `draft-${name}.md`);
    writeFileSync(join(ROOT, out), frontMatter(text, name, dates[name]));
    written.push(out);
  }
  writeFileSync(MANIFEST, JSON.stringify(written, null, 1) + "\n");
  console.log(`draft-preview: ${names.join(", ")} -> ${written.length} paths${missing.length ? `; not in the vault: ${missing.join(", ")}` : ""}`);
}

sync();
if (WATCH) {
  let t = null;
  const again = () => { clearTimeout(t); t = setTimeout(() => { try { sync(); } catch (e) { console.error(e.message); } }, 300); };
  for (const name of names) watch(join(DRAFTS, name), { recursive: true }, again);
  console.log("draft-preview: watching for saves in Obsidian");
}
