// Serves the home's live-sky wrapper (/lab/home/, from notes/storyboards/fly-home.html) straight
// at a page's own URL when a person's browser navigates to it, so a first visit skips the
// redirect base.njk would otherwise make (one round trip less before text shows). The wrapper
// then frames the same URL, and that request (Sec-Fetch-Dest: iframe) gets the page itself.
//
// Everyone else gets the page as built: crawlers and link previews (the same pattern base.njk
// uses), browsers that send no Sec-Fetch-Dest (base.njk's redirect still covers them), anything
// that isn't a 200 HTML page (404s, _redirects), and /lab/. _routes.json keeps files like CSS,
// fonts and images from reaching this at all.
// base.njk's pattern, plus crawlers whose names lack "bot" (Search Console's URL inspection, AI agents).
const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|lighthouse|google|inspection|chatgpt|perplexity|claude|anthropic/i;

export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);
  if (request.method !== 'GET' || request.headers.get('Sec-Fetch-Dest') !== 'document' ||
      BOTS.test(request.headers.get('User-Agent') || '') || url.pathname.startsWith('/lab/')) {
    return next();
  }
  // Unconditional: a 304 here would let the browser reuse the plain page it cached from a frame.
  const fresh = new Headers(request.headers);
  fresh.delete('If-None-Match'); fresh.delete('If-Modified-Since');
  const page = await next(new Request(request, { headers: fresh }));
  if (page.status !== 200 || !(page.headers.get('Content-Type') || '').includes('text/html')) return page;
  const shell = await env.ASSETS.fetch(new URL('/lab/home/', url));
  if (!shell.ok) return page;
  const headers = new Headers(page.headers);   // the page's own headers (_headers rules, noindex on previews)
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'private, no-cache');   // what this URL returns depends on who asks
  headers.append('Vary', 'Sec-Fetch-Dest, User-Agent');
  headers.delete('Content-Length'); headers.delete('ETag');
  // The wrapper is noindex at /lab/home/. Here it stands at the page's address, so if a crawler
  // ever slips past the checks above it must not mark the page noindex: drop that, point canonical
  // at the page.
  const canonical = `https://hadsed.com${url.pathname}`;
  return new HTMLRewriter()
    .on('meta[name="robots"]', { element(e) { e.remove(); } })
    .on('head', { element(e) { e.append(`<link rel="canonical" href="${canonical}">`, { html: true }); } })
    .transform(new Response(shell.body, { status: 200, headers }));
}
