// /ingest/* -> PostHog, so analytics ride on hadsed.com's own address (lib/analytics.mjs).
// Blockers that drop *.posthog.com leave a first-party path alone, and Mach 20 sends here too
// (cross-origin; PostHog's own CORS headers come back through untouched).
import { posthogHosts } from "../../lib/analytics.mjs";

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/ingest/, "") || "/";
  const { api, assets } = posthogHosts();
  const isStatic = path.startsWith("/static/");
  const upstream = new URL(path + url.search, isStatic ? assets : api);
  const headers = new Headers(request.headers);
  headers.delete("Cookie");   // hadsed.com's cookies are none of PostHog's business
  headers.delete("Host");
  // PostHog places the visitor from this (then drops it, per the project's IP setting); without it
  // every visitor would sit in Cloudflare's data center.
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) headers.set("X-Forwarded-For", ip);
  const init = { method: request.method, headers, redirect: "manual" };
  if (!["GET", "HEAD"].includes(request.method)) init.body = request.body;
  // The SDK's files are versioned by PostHog; keep them at the edge for an hour.
  if (isStatic) init.cf = { cacheEverything: true, cacheTtl: 3600 };
  return fetch(upstream, init);
}
