// Every page hadsed.com has published stays reachable: each URL in the live sitemap must still
// be built into _site, or be covered by a line in _site/_redirects. Runs in the deploy after the
// build, so a renamed slug or moved page fails the deploy (and the content PR's preview) instead
// of breaking old links. If the live sitemap can't be fetched, it warns and passes.
import { readFileSync, existsSync } from "node:fs";

const SITEMAP = process.env.LIVE_SITEMAP || "https://hadsed.com/sitemap.xml";
const site = process.argv[2] || "_site";

let xml;
try {
  const res = await fetch(SITEMAP, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  xml = await res.text();
} catch (err) {
  console.warn(`check-urls: could not fetch ${SITEMAP} (${err.message}); skipping`);
  process.exit(0);
}

const rules = existsSync(`${site}/_redirects`)
  ? readFileSync(`${site}/_redirects`, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => l.split(/\s+/)[0])
  : [];
const redirected = (path) => rules.some((from) => (from.endsWith("*") ? path.startsWith(from.slice(0, -1)) : from === path));
const built = (path) => existsSync(`${site}${path}`) && (path.endsWith("/") ? existsSync(`${site}${path}index.html`) : true);

const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
const missing = paths.filter((p) => !built(p) && !redirected(p));
console.log(`check-urls: ${paths.length} published URLs, ${missing.length} missing`);
if (missing.length) {
  console.error(`These published pages would disappear. Restore them, or add a redirect (redirect_from: in the page's front matter):\n${missing.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
