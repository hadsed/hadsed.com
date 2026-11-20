// Serves the home's live-sky wrapper (/lab/home/, from notes/storyboards/fly-home.html) straight
// at a page's own URL when a person's browser navigates to it, with the page itself already in
// the wrapper's site frame (srcdoc). One response, one round trip, and the text paints: no
// redirect to /lab/home/ (what base.njk would otherwise do) and no second request for the page.
// Later pages load in the frame as usual (Sec-Fetch-Dest: iframe), which get the page as built.
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
  const [shell, html] = await Promise.all([env.ASSETS.fetch(new URL('/lab/home/', url)), page.text()]);
  if (!shell.ok) return new Response(html, page);
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
    // The page itself rides in this same response, inside the frame it would otherwise have to
    // request: its text paints after one round trip, not two. Links in it navigate the frame as usual.
    .on('iframe#site', { element(e) { e.setAttribute('srcdoc', html); } })
    .transform(new Response(shell.body, { status: 200, headers }));
}
