// Hero images: the picture at the top of a project, post or note, and on its card in lists.
//
// An animated hero (a GIF or animated WebP) shows a still first frame until someone hovers its
// card or the image itself; only then does the motion download and play. The motion ships as a
// small MP4 made at build time (the 4 MB home tour GIF is about 250 KB as MP4); without ffmpeg
// it falls back to an animated WebP. Touch screens have no hover, so there the motion plays while
// the image is mostly on screen (src/assets/hero.js).
//
// Where a hero comes from: `hero_image:` in front matter, or else an image embed on the body's first
// line (Obsidian: a line with just ![[tour.gif]]); the page templates show that one as the hero.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import sharp from "sharp";

const IMAGE = /\.(gif|png|jpe?g|webp|avif|svg)$/i;

// "[[tour.gif|600]]", "![[tour.gif]]", "/assets/tour.gif" and "tour.gif" all name tour.gif.
export const heroName = (value) =>
  value ? String(value).trim().replace(/^!?\[\[/, "").replace(/(\|[^\]]*)?\]\]$/, "").replace(/^\/?(assets\/)?/, "").trim() : null;

// The image embed on a body's first line, if any: the same rule as the leadImage filter in
// eleventy.config.js, which shows it as the hero on post and project pages.
export function leadImage(body) {
  const first = String(body).split("\n").find((line) => line.trim());
  const m = first && first.trim().match(/^!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/);
  return m && IMAGE.test(m[1].trim()) ? m[1].trim() : null;
}

const assetPath = (name) => [`content/assets/${name}`, `src/assets/${name}`].find((p) => existsSync(p));
const url = (name) => `/assets/${encodeURI(name)}`;
const escapeAttr = (text) => String(text ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

let hasFfmpeg;
const ffmpegAvailable = () => {
  if (hasFfmpeg === undefined) {
    try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); hasFfmpeg = true; } catch { hasFfmpeg = false; }
  }
  return hasFfmpeg;
};

// name -> { width, height, still?, motion? }. Kept across rebuilds while the file is unchanged.
const heroes = new Map();

// Reads every hero's size and, for animated ones, writes the still and the motion into the
// site output under /assets/_hero/. A name that isn't in assets fails the build.
export async function prepareHeroes(names, outDir) {
  for (const name of new Set(names.filter(Boolean))) {
    const path = assetPath(name);
    if (!path) throw new Error(`Hero image ${name} is not in content/assets`);
    const mtime = statSync(path).mtimeMs;
    const known = heroes.get(name);
    if (known && known.mtime === mtime && (!known.still || existsSync(`${outDir}${decodeURI(known.still)}`))) continue;

    // A file sharp can't read (a test stub, an odd SVG) is shown as is, without a size.
    const meta = await sharp(path, { animated: true }).metadata().catch(() => ({}));
    const hero = { mtime, width: meta.width, height: meta.pageHeight || meta.height };
    if ((meta.pages || 1) > 1) {
      const base = `_hero/${name.replace(/\.[^.]+$/, "")}`;
      const out = (ext) => `${outDir}/assets/${base}.${ext}`;
      mkdirSync(dirname(out("webp")), { recursive: true });
      await sharp(path).webp({ quality: 82 }).toFile(out("webp"));
      hero.still = url(`${base}.webp`);
      if (ffmpegAvailable()) {
        execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path, "-an", "-movflags", "+faststart", "-pix_fmt", "yuv420p",
          "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-crf", "24", "-preset", "slow", out("mp4")]);
        hero.motion = url(`${base}.mp4`);
      } else {
        await sharp(path, { animated: true }).webp({ quality: 70 }).toFile(out("anim.webp"));
        hero.motion = url(`${base}.anim.webp`);
      }
    }
    heroes.set(name, hero);
  }
}

// The hero's markup. `card` heroes are thumbnails in lists: lazy, decorative (the card's title says
// what it is), and played by hovering anywhere on the card. `width` caps the size, like ![[x.gif|600]].
export function heroHtml(value, { alt = "", card = false, width = null, className = "hero" } = {}) {
  const name = heroName(value);
  if (!name) return "";
  const hero = heroes.get(name);
  if (!hero) throw new Error(`Hero image ${name} was not prepared (is it hero_image or the body's first line?)`);
  const altText = card ? "" : escapeAttr(alt);
  const size = !hero.width ? "" : `width="${width || hero.width}" height="${width ? Math.round((hero.height * width) / hero.width) : hero.height}"`;
  const lazy = card ? ` loading="lazy"` : "";
  if (!hero.still) return `<img class="${className}" src="${url(name)}" alt="${altText}" ${size}${lazy} decoding="async">`;
  return `<span class="${className} hero-anim" data-motion="${hero.motion}">` +
    `<img src="${hero.still}" alt="${altText}" ${size}${lazy} decoding="async"></span>`;
}
