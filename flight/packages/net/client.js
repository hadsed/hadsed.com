import { encodeState, decodeSnapshot, VERSION } from './protocol.js';

// Connects to the room server. Any failure (no server configured, server full,
// network drop) leaves the game in solo mode; it retries with backoff.
//
// const net = connect({ url, world, onSnapshot, onMessage, onStatus });
// net.send(jet)  // at ~10 Hz
export function connect({ url, world = 'sierra', onSnapshot, onMessage, onStatus = () => {} } = {}) {
  let ws = null, closed = false, retry = 1000, timer = null;
  const state = { status: url ? 'connecting' : 'solo', id: null, callsign: null };

  const set = (status) => { state.status = status; onStatus(status, state); };

  function open() {
    if (closed || !url) return;
    set('connecting');
    try {
      ws = new WebSocket(`${url.replace(/\/$/, '')}/room/${encodeURIComponent(world)}?v=${VERSION}`);
    } catch { return later(); }
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => { retry = 1000; };
    ws.onmessage = (e) => {
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
    ws.onclose = () => { ws = null; if (!closed) { set(state.status === 'online' ? 'reconnecting' : 'solo'); later(); } };
    ws.onerror = () => {};
  }

  function later() {
    clearTimeout(timer);
    timer = setTimeout(open, retry);
    retry = Math.min(retry * 2, 30000);
  }

  open();
  return {
    state,
    send(jet) { if (ws?.readyState === 1 && state.status === 'online') ws.send(encodeState(jet)); },
    close() { closed = true; clearTimeout(timer); ws?.close(); },
  };
}
