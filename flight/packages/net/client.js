import { encodeState, decodeSnapshot, VERSION } from './protocol.js';

// Connects to the room server. Any failure (no server configured, server full,
// network drop) leaves the game in solo mode; it retries with backoff.
//
// const net = connect({ url, world, onSnapshot, onMessage, onStatus });
// net.send(jet)  // at ~10 Hz
//
// A socket can die without ever closing: switch from wifi to cell, walk into a
// lift, or let a phone sleep, and the browser may keep reporting "open" for
// minutes. The server sends ~10 snapshots a second, so silence for `staleMs`
// means the link is gone: drop it and dial again straight away.
//
// socketOptions is passed as WebSocket's second argument. Browsers take
// protocols there; Node takes { headers }, which the bot swarm uses for Origin.
export function connect({
  url, world = 'sierra', onSnapshot, onMessage, onStatus = () => {},
  staleMs = 4000, openTimeoutMs = 10000, socketOptions, WebSocketImpl = globalThis.WebSocket,
} = {}) {
  let ws = null, closed = false, retry = 1000, timer = null, lastMsg = 0, openedAt = 0;
  const state = { status: url ? 'connecting' : 'solo', id: null, callsign: null, reconnects: 0, stale: 0 };

  const set = (status) => { if (state.status !== status) { state.status = status; onStatus(status, state); } };

  const hidden = () => typeof document !== 'undefined' && document.hidden;

  function open() {
    if (closed || !url) return;
    clearTimeout(timer);
    // A background tab sends nothing, so the server would time it out anyway.
    // Wait until the page is visible again (see wake below).
    if (hidden()) return;
    set(state.status === 'online' || state.status === 'reconnecting' ? 'reconnecting' : 'connecting');
    const target = `${url.replace(/\/$/, '')}/room/${encodeURIComponent(world)}?v=${VERSION}`;
    let sock;
    try {
      sock = socketOptions ? new WebSocketImpl(target, socketOptions) : new WebSocketImpl(target);
    } catch { return later(); }
    ws = sock;
    openedAt = lastMsg = Date.now();
    sock.binaryType = 'arraybuffer';
    sock.onopen = () => { if (sock === ws) retry = 1000; };
    sock.onmessage = (e) => {
      if (sock !== ws) return;
      lastMsg = Date.now();
      if (e.data instanceof ArrayBuffer) {
        const snap = decodeSnapshot(e.data);
        if (snap) onSnapshot?.(snap, performance.now());
        return;
      }
      let msg; try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.t === 'welcome') { state.id = msg.id; state.callsign = msg.callsign; set('online'); }
      if (msg.t === 'full') set('solo');
      onMessage?.(msg);
    };
    sock.onclose = () => {
      if (sock !== ws) return;
      ws = null;
      if (!closed) { set(state.status === 'online' ? 'reconnecting' : state.status === 'reconnecting' ? 'reconnecting' : 'solo'); later(); }
    };
    sock.onerror = () => {};
  }

  // Abandon a socket that went quiet. We do not wait for its close event,
  // which on a dead link can take minutes.
  function abandon(why) {
    const old = ws;
    ws = null;
    if (old) { old.onopen = old.onmessage = old.onclose = old.onerror = null; try { old.close(4002, why); } catch {} }
    state.reconnects++;
    if (why === 'stale') state.stale++;
    set(state.status === 'online' || state.status === 'reconnecting' ? 'reconnecting' : 'solo');
    later(why === 'stale' ? 0 : undefined);
  }

  function later(ms = retry) {
    clearTimeout(timer);
    timer = setTimeout(open, ms);
    retry = Math.min(retry * 2, 30000);
  }

  const watchdog = setInterval(() => {
    if (closed || !ws) return;
    const now = Date.now();
    if (ws.readyState === 0 && now - openedAt > openTimeoutMs) abandon('timeout');
    else if (ws.readyState === 1 && state.status === 'online' && now - lastMsg > staleMs) abandon('stale');
  }, 500);

  // Coming back to the tab, or the OS saying the network is back: dial now
  // instead of waiting out the backoff.
  const wake = () => {
    if (closed || !url || ws || hidden()) return;
    retry = 1000;
    open();
  };
  globalThis.addEventListener?.('online', wake);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', wake);

  open();
  return {
    state,
    send(jet) { if (ws?.readyState === 1 && state.status === 'online') ws.send(encodeState(jet)); },
    close() {
      closed = true; clearTimeout(timer); clearInterval(watchdog);
      globalThis.removeEventListener?.('online', wake);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', wake);
      ws?.close();
    },
  };
}
