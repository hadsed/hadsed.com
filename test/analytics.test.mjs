import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, edgeEvent } from "../lib/analytics.mjs";

const H = (o) => new Headers(o);
const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const browser = { "User-Agent": CHROME, "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document" };

test("AI crawlers, assistants fetching for a person, and search engines get told apart", () => {
  const kind = (ua) => classify(H({ "User-Agent": ua }));
  assert.equal(kind("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)").visitor_kind, "ai-crawler");
  assert.equal(kind("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)").visitor_kind, "ai-agent");
  assert.equal(kind("Mozilla/5.0 (compatible; Claude-User/1.0; +Claude-User@anthropic.com)").agent_owner, "Anthropic");
  assert.equal(kind("Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)").agent_name, "ClaudeBot");
  assert.equal(kind("Mozilla/5.0 (compatible; PerplexityBot/1.0)").visitor_kind, "ai-search");
  assert.equal(kind("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)").visitor_kind, "search");
  assert.equal(kind("Slackbot-LinkExpanding 1.0").visitor_kind, "preview");
  assert.equal(kind("curl/8.5.0").visitor_kind, "script");
  assert.equal(kind("").visitor_kind, "unknown");
  for (const ua of ["GPTBot/1.2", "ChatGPT-User/1.0", "PerplexityBot/1.0"]) assert.ok(kind(ua).is_ai, ua);
});

test("a real browser is human; the same User-Agent from a script or a datacenter is suspect", () => {
  assert.equal(classify(H(browser), { asOrganization: "Comcast Cable" }).visitor_kind, "human");
  assert.equal(classify(H(browser), { asOrganization: "Comcast Cable" }).is_agent, false);
  assert.equal(classify(H({ "User-Agent": CHROME }), {}).visitor_kind, "suspect");
  const dc = classify(H(browser), { asOrganization: "Amazon.com, Inc." });
  assert.equal(dc.visitor_kind, "suspect");
  assert.equal(dc.datacenter, true);
});

test("agents that sign their requests (Web Bot Auth) are agents even in a browser's clothes", () => {
  const l = classify(H({ ...browser, "Signature-Agent": '"https://chatgpt.com"', "Signature-Input": "sig1=...", Signature: "sig1=:abc:" }));
  assert.equal(l.visitor_kind, "ai-agent");
  assert.equal(l.agent_owner, "OpenAI");
  assert.equal(l.agent_signed, true);
});

test("the edge event never carries the IP, and groups agents by name", async () => {
  const req = new Request("https://hadsed.com/llms.txt", { headers: { "User-Agent": "ClaudeBot/1.0", "CF-Connecting-IP": "203.0.113.7" } });
  const ev = await edgeEvent(req, new Response("x", { headers: { "Content-Type": "text/plain; charset=utf-8" } }));
  assert.equal(ev.event, "edge_request");
  assert.equal(ev.distinct_id, "agent:ClaudeBot");
  assert.equal(ev.properties.$pathname, "/llms.txt");
  assert.equal(ev.properties.content_type, "text/plain");
  assert.equal(ev.properties.$process_person_profile, false);
  assert.doesNotMatch(JSON.stringify(ev), /203\.0\.113\.7/);
  const human = await edgeEvent(new Request("https://hadsed.com/", { headers: { ...browser, "CF-Connecting-IP": "203.0.113.7" } }), null);
  assert.match(human.distinct_id, /^edge:[0-9a-f]{24}$/);
});

test("the Pages Function logs after responding, never on the analytics proxy, and robots/feed/llms reach it", async () => {
  const { onRequest } = await import("../functions/_middleware.js");
  const waits = [];
  const run = (path) => onRequest({
    request: new Request(`https://hadsed.com${path}`, { headers: { "User-Agent": "GPTBot/1.2", "Sec-Fetch-Dest": "document" } }),
    next: async () => new Response("ok", { headers: { "Content-Type": "text/plain" } }),
    env: {}, waitUntil: (p) => waits.push(p),
  });
  assert.equal(await (await run("/llms.txt")).text(), "ok");
  assert.equal(waits.length, 1);
  await run("/ingest/i/v0/e/");
  assert.equal(waits.length, 1);
  const { readFileSync } = await import("node:fs");
  const routes = JSON.parse(readFileSync(new URL("../src/root/_routes.json", import.meta.url), "utf8"));
  for (const p of ["/robots.txt", "/sitemap.xml", "/feed.xml", "/llms.txt"]) assert.ok(!routes.exclude.includes(p), p);
});
