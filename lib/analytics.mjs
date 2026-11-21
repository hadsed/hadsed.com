// Analytics: PostHog, fed from two places.
//   1. The Pages Function (functions/_middleware.js) logs every request it sees as an `edge_request`
//      event, labelled human or agent. Crawlers and AI agents mostly never run JavaScript, so this
//      is the only place they show up. Raw IPs never leave Cloudflare: a daily hash stands in.
//   2. The pages themselves (base.njk) load posthog-js once the text has painted: pageviews, time
//      on page, clicks, scroll depth, heatmaps, session replay. Mach 20 joins the same visitor and
//      session when it's framed here (fly-home.html hands it the ids).
// Everything goes through /ingest on hadsed.com (functions/ingest/[[path]].js), so ad blockers
// that block posthog.com leave it alone.

// The project key is public by design (it can only send events). Until it's set, nothing loads or sends.
export const POSTHOG = {
  key: "phc_rUTRcKBdqGTxTzb5ihkihx7C4JWg3pUMW3hEF8Jv4SDa",
  region: "us", // "us" or "eu": where the PostHog project lives
};
export const analyticsOn = () => /^phc_[A-Za-z0-9]{20,}$/.test(POSTHOG.key);
export const posthogHosts = (region = POSTHOG.region) => ({
  api: `https://${region}.i.posthog.com`,
  assets: `https://${region}-assets.i.posthog.com`,
  ui: `https://${region}.posthog.com`,
});

// Who's asking, from the User-Agent. [pattern, name, kind, owner]. First match wins, so specific
// names come before the generic ones. Kinds:
//   ai-crawler  collects pages for model training      ai-search  builds an AI search index
//   ai-agent    fetches a page because a person asked an assistant to, right now
//   search      classic search engines                 preview    link unfurlers (chat apps, social)
//   tool        audits (Lighthouse, Search Console)    headless   automated browsers
//   script      HTTP libraries and command-line tools  bot        anything else that says it's a bot
const AGENTS = [
  [/GPTBot/i, "GPTBot", "ai-crawler", "OpenAI"],
  [/OAI-SearchBot/i, "OAI-SearchBot", "ai-search", "OpenAI"],
  [/ChatGPT-User/i, "ChatGPT-User", "ai-agent", "OpenAI"],
  [/ChatGPT[- ]Agent|Operator/i, "ChatGPT Agent", "ai-agent", "OpenAI"],
  [/ClaudeBot/i, "ClaudeBot", "ai-crawler", "Anthropic"],
  [/Claude-SearchBot/i, "Claude-SearchBot", "ai-search", "Anthropic"],
  [/Claude-User/i, "Claude-User", "ai-agent", "Anthropic"],
  [/anthropic-ai|Claude-Web/i, "anthropic-ai", "ai-crawler", "Anthropic"],
  [/PerplexityBot/i, "PerplexityBot", "ai-search", "Perplexity"],
  [/Perplexity-User/i, "Perplexity-User", "ai-agent", "Perplexity"],
  [/Google-CloudVertexBot/i, "Google-CloudVertexBot", "ai-crawler", "Google"],
  [/Gemini-Deep-Research|Google-NotebookLM|NotebookLM/i, "Gemini agent", "ai-agent", "Google"],
  [/Bytespider/i, "Bytespider", "ai-crawler", "ByteDance"],
  [/TikTokSpider/i, "TikTokSpider", "ai-crawler", "ByteDance"],
  [/CCBot/i, "CCBot", "ai-crawler", "Common Crawl"],
  [/meta-externalagent/i, "meta-externalagent", "ai-crawler", "Meta"],
  [/meta-externalfetcher/i, "meta-externalfetcher", "ai-agent", "Meta"],
  [/FacebookBot/i, "FacebookBot", "ai-crawler", "Meta"],
  [/Amazonbot/i, "Amazonbot", "ai-crawler", "Amazon"],
  [/Applebot-Extended/i, "Applebot-Extended", "ai-crawler", "Apple"],
  [/DuckAssistBot/i, "DuckAssistBot", "ai-search", "DuckDuckGo"],
  [/MistralAI-User/i, "MistralAI-User", "ai-agent", "Mistral"],
  [/cohere-ai|cohere-training-data-crawler/i, "Cohere", "ai-crawler", "Cohere"],
  [/YouBot/i, "YouBot", "ai-search", "You.com"],
  [/PhindBot/i, "PhindBot", "ai-search", "Phind"],
  [/Diffbot/i, "Diffbot", "ai-crawler", "Diffbot"],
  [/Timpibot|ImagesiftBot|omgili|AI2Bot|Ai2Bot|PanguBot|Kangaroo Bot|img2dataset|Scrapy/i, "other AI crawler", "ai-crawler", null],
  [/Google-InspectionTool|Chrome-Lighthouse|Lighthouse|PageSpeed|GTmetrix|Pingdom|UptimeRobot/i, "audit", "tool", null],
  [/Googlebot|Google-Site-Verification|GoogleOther|Storebot-Google|AdsBot-Google|Mediapartners-Google/i, "Googlebot", "search", "Google"],
  [/bingbot|BingPreview|msnbot/i, "Bingbot", "search", "Microsoft"],
  [/Applebot/i, "Applebot", "search", "Apple"],
  [/DuckDuckBot/i, "DuckDuckBot", "search", "DuckDuckGo"],
  [/YandexBot|YandexAccessibilityBot/i, "YandexBot", "search", "Yandex"],
  [/Baiduspider/i, "Baiduspider", "search", "Baidu"],
  [/PetalBot/i, "PetalBot", "search", "Huawei"],
  [/SeznamBot|Qwantify|Qwantbot|MojeekBot|Yahoo! Slurp/i, "other search", "search", null],
  [/facebookexternalhit|Twitterbot|Slackbot|Discordbot|LinkedInBot|TelegramBot|WhatsApp|redditbot|Iframely|Embedly|SkypeUriPreview|Pinterestbot|Mastodon|Bluesky|vkShare|Snapchat/i, "link preview", "preview", null],
  [/HeadlessChrome|PhantomJS|Puppeteer|Playwright|Selenium|Cypress|electron/i, "headless browser", "headless", null],
  [/^curl|Wget|python-requests|python-httpx|aiohttp|Python-urllib|Go-http-client|node-fetch|undici|axios|okhttp|Java\/|libwww|httpie|Ruby|PHP\/|Deno\/|Bun\/|reqwest/i, "script", "script", null],
  [/bot|crawl|spider|slurp|fetch|scrape|monitor|feed|rss|reader/i, "other bot", "bot", null],
];
const AI_KINDS = new Set(["ai-crawler", "ai-search", "ai-agent"]);
// Cloud and hosting networks (Cloudflare's asOrganization). A browser User-Agent from one of these is
// almost always automation: an agent's remote browser, a scraper, a monitor. VPNs land here too.
const DATACENTER = /amazon|aws|google|microsoft|azure|digitalocean|hetzner|ovh|linode|akamai|oracle|alibaba|tencent|vultr|choopa|scaleway|contabo|leaseweb|m247|datacamp|cdn77|fastly|cloudflare|hostinger|ionos|upcloud|kamatera|hostwinds|psychz|colocrossing|zenlayer|g-core|gcore|huawei cloud|bytedance|fly\.io|render|railway|vercel|netlify|heroku|packet|equinix/i;

// Label one request. headers: a Headers object; cf: request.cf (Cloudflare's per-request facts).
export function classify(headers, cf = {}) {
  const ua = headers.get("User-Agent") || "";
  const signatureAgent = (headers.get("Signature-Agent") || "").replace(/^"|"$/g, "");
  const signed = !!(headers.get("Signature-Input") && headers.get("Signature"));
  const asOrg = cf.asOrganization || "";
  const datacenter = DATACENTER.test(asOrg);
  const bm = cf.botManagement || {};   // only filled on Cloudflare's paid bot plans; read it when it's there
  let name = null, kind = null, owner = null;
  for (const [re, n, k, o] of AGENTS) if (re.test(ua)) { name = n; kind = k; owner = o; break; }
  // Web Bot Auth: agents that sign their requests (ChatGPT's agent does) name themselves here.
  if (!kind && signatureAgent) {
    kind = "ai-agent"; name = signatureAgent.replace(/^https?:\/\//, "");
    owner = /chatgpt|openai/i.test(signatureAgent) ? "OpenAI" : null;
  }
  if (!kind) {
    const browserUa = /Mozilla\/5\.0/.test(ua) && /(Chrome|Firefox|Safari|Edg)\//.test(ua);
    // Browsers have sent Sec-Fetch-* on every request since 2023 (Safari 16.4). A browser
    // User-Agent without it is a script wearing a costume.
    const fetchMeta = headers.has("Sec-Fetch-Mode") || headers.has("Sec-Fetch-Dest");
    if (!ua) { kind = "unknown"; name = "no user agent"; }
    else if (!browserUa) { kind = "bot"; name = "unrecognised client"; }
    else if (!fetchMeta) { kind = "suspect"; name = "browser UA, no fetch metadata"; }
    else if (datacenter) { kind = "suspect"; name = "browser from a datacenter"; }
    else if (bm.score && bm.score < 30 && !bm.verifiedBot) { kind = "suspect"; name = "low bot score"; }
    else { kind = "human"; }
  }
  return {
    visitor_kind: kind,
    is_agent: kind !== "human",
    is_ai: AI_KINDS.has(kind),
    agent_name: name,
    agent_owner: owner,
    agent_signed: signed,
    signature_agent: signatureAgent || null,
    datacenter,
    verified_bot: bm.verifiedBot ?? null,
    bot_score: bm.score ?? null,
  };
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
// A stand-in for "this visitor today": IP and browser, hashed with the date, never the IP itself.
async function dailyVisitor(ip, ua) {
  const day = new Date().toISOString().slice(0, 10);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${day}|${ip}|${ua}`));
  return hex(digest).slice(0, 24);
}

// One PostHog event for one request. Returned rather than sent so tests can read it.
export async function edgeEvent(request, response, extra = {}) {
  const url = new URL(request.url);
  const h = request.headers, cf = request.cf || {};
  const label = classify(h, cf);
  const ua = h.get("User-Agent") || "";
  const visitor = await dailyVisitor(h.get("CF-Connecting-IP") || "", ua);
  return {
    api_key: POSTHOG.key,
    event: "edge_request",
    // Agents group by name, so "ClaudeBot" is one row; people by the daily hash.
    distinct_id: label.is_agent && label.agent_name ? `agent:${label.agent_name}` : `edge:${visitor}`,
    timestamp: new Date().toISOString(),
    properties: {
      $process_person_profile: false,   // server hits never make person profiles; the browser does that
      $geoip_disable: true,              // Cloudflare already knows where it came from (below)
      $lib: "hadsed-edge",
      $current_url: url.href,
      $host: url.host,
      $pathname: url.pathname,
      edge_visitor: visitor,
      method: request.method,
      status: response?.status ?? null,
      content_type: (response?.headers.get("Content-Type") || "").split(";")[0] || null,
      fetch_dest: h.get("Sec-Fetch-Dest"),
      fetch_site: h.get("Sec-Fetch-Site"),
      referrer: h.get("Referer"),
      user_agent: ua.slice(0, 400),
      accept: (h.get("Accept") || "").slice(0, 120),
      accept_language: (h.get("Accept-Language") || "").slice(0, 40),
      ...label,
      asn: cf.asn ?? null,
      as_org: cf.asOrganization ?? null,
      country: cf.country ?? null,
      region: cf.region ?? null,
      city: cf.city ?? null,
      cf_colo: cf.colo ?? null,
      http_protocol: cf.httpProtocol ?? null,
      ...extra,
    },
  };
}

export async function sendEdgeEvent(request, response, extra) {
  if (!analyticsOn()) return;
  try {
    const body = JSON.stringify(await edgeEvent(request, response, extra));
    await fetch(`${posthogHosts().api}/i/v0/e/`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  } catch {}   // analytics never breaks a page
}
