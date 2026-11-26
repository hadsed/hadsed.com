// Pointing benchmark figures, rendered into the article's own DOM.
// Embedded from the draft as ![[pointing-figures/widgets.js|<name>]], where <name> is one of
//   explorer · results-single-part · results-workbench · results-harness-workbench
// The site turns each embed into <div class="widget-mount" data-widget="<name>"> and loads this module once.
// Data and images sit next to this file: data-<slice>.json and img/*.webp (built by figure-build/).
const BASE = new URL(".", import.meta.url);
const SLICES = {explorer: ["zs_v1", "zs_wb", "h_v1", "h_wb"], "results-single-part": ["zs_v1"],
                "results-workbench": ["zs_wb"], "results-harness-workbench": ["h_wb"]};
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const R6 = 6.7, RINGS = [R6, 2 * R6, 3 * R6], RING_COL = ["#22c55e", "#eab308", "#ef4444"], ANSWER = "#3b82f6";
const PIXEL = new Set(["same_image", "exact_2d", "view_roll"]);
const LABEL = {same_image: "Same image", exact_2d: "Exact 2D transform", view20: "Small view change", view60: "Large view change",
               view_roll: "Camera roll", view_small: "Small view change", view_large: "Large view change"};
const CLS_NAME = {precise: "precise", near: "near", mid: "mid", wrong_region: "wrong place", background: "off the part",
                  wrong_part: "wrong object", off_canvas: "off canvas", undecodable: "no answer"};
const CLS_COL = {precise: "#2a9d8f", near: "#8bbf5a", mid: "#5b8fb9", wrong_region: "#d08a2e", background: "#d9534f",
                 wrong_part: "#c0397a", off_canvas: "#a33", undecodable: "#7d8590"};
const CLS_ORDER = Object.keys(CLS_COL);
const DS_NAME = {v1: "single part", workbench: "workbench"};
const dot = (c) => `<i class="ptw-dot" style="background:${CLS_COL[c]}"></i>`;
const chip = (c) => `<span class="ptw-chip">${dot(c)}${esc(CLS_NAME[c] || c)}</span>`;
const img = (p) => new URL("img/" + p.replace(/\//g, "-").replace(/\.png$/, ".webp"), BASE).href;
const fmt = (x, d) => x == null || isNaN(x) ? "—" : Number(x).toFixed(d);
const short = (stem) => stem.replace(/_s\d+$/, "").replace(/^workbench_/, "");
const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const CSS = `
.ptw{font-size:.86rem;line-height:1.45;color:var(--text)}
.ptw .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}
.ptw .muted{color:var(--muted)}
.ptw button{font:inherit;color:inherit}
.ptw-bar{display:flex;flex-wrap:wrap;gap:.4rem .8rem;align-items:center;margin:0 0 .6rem}
.ptw-seg{display:inline-flex;gap:.9rem}
.ptw-seg button{background:none;border:0;padding:0 0 2px;cursor:pointer;color:var(--muted);border-bottom:1px solid transparent}
.ptw-seg button:hover{color:var(--accent)}
.ptw-seg button.on{color:var(--glow);border-bottom-color:var(--glow)}
.ptw select{font:inherit;background:transparent;color:var(--text);border:0;border-bottom:1px solid color-mix(in srgb,var(--rule) 60%,transparent);padding:1px 0;max-width:100%;cursor:pointer}
.ptw select option{background:var(--bg)}
.ptw-step{display:inline-flex;align-items:center;gap:.35rem}
.ptw-step button{background:none;border:0;cursor:pointer;color:var(--muted);padding:0 .2rem;font-size:1.05em}
.ptw-step button:hover{color:var(--accent)}
.ptw-dot{display:inline-block;width:.55em;height:.55em;border-radius:50%;margin-right:.35em;vertical-align:.05em}
.ptw-chip{white-space:nowrap}
.ptw-wrap{overflow-x:auto}
.ptw table{border-collapse:collapse;width:100%;font-size:.82rem}
.ptw th,.ptw td{padding:.45rem .5rem .45rem 0;text-align:left;vertical-align:top;border-bottom:1px solid color-mix(in srgb,var(--rule) 22%,transparent)}
.ptw thead th{color:var(--muted);font-weight:normal;font-size:.76rem;white-space:nowrap;border-bottom-color:color-mix(in srgb,var(--rule) 55%,transparent)}
.ptw thead th b{display:block;white-space:normal;color:var(--accent);font-weight:normal;font-size:.82rem}
.ptw td.sys{color:var(--text);min-width:8rem;max-width:12rem}
.ptw td.c{cursor:pointer;padding-left:.4rem;border-radius:3px}
.ptw td.c:hover{background:color-mix(in srgb,var(--accent) 6%,transparent)}
.ptw td.c.sel{background:color-mix(in srgb,var(--glow) 10%,transparent);box-shadow:inset 0 -2px 0 var(--glow)}
.ptw td.c .v{color:var(--accent)}
.ptw td.na{color:var(--muted);padding-left:.4rem}
.ptw .spark{display:block;margin-top:.2rem}
.ptw tr.drawer td{padding:.5rem 0 .7rem;border-bottom-color:color-mix(in srgb,var(--rule) 55%,transparent)}
.ptw .dhead{display:flex;gap:.7rem;align-items:baseline;flex-wrap:wrap;margin:0 0 .5rem}
.ptw .dhead .x{margin-left:auto;cursor:pointer;background:none;border:0;color:var(--muted)}
.ptw .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:5px;max-height:258px;overflow-y:auto;padding-right:2px}
.ptw .tile{position:relative;cursor:zoom-in;border-radius:3px;overflow:hidden;outline:1px solid transparent}
.ptw .tile:hover{outline-color:var(--glow)}
.ptw .tile svg{display:block;width:100%;aspect-ratio:1}
.ptw .tile .cap{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;padding:0 4px;font-size:.66rem;background:rgba(15,20,28,.72);color:#e6e9ed}
.ptw .note{color:var(--muted);font-size:.76rem;margin:.5rem 0 0}
.ptw-io{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.6rem}
.ptw-io .h{color:var(--muted);font-size:.76rem;margin:0 0 .25rem}
.ptw-io svg{display:block;width:100%;aspect-ratio:1;border-radius:3px;cursor:zoom-in}
.ptw dl{display:grid;grid-template-columns:max-content 1fr;gap:0 .7rem;margin:.4rem 0 0;font-size:.78rem}
.ptw dt{color:var(--muted)} .ptw dd{margin:0}
.ptw-modal{position:fixed;inset:0;z-index:1000;background:rgba(14,19,28,.97);display:none;overflow:auto;padding:2rem 1rem;color:var(--text);font:14px/1.5 var(--font)}
.ptw-modal.on{display:block}
.ptw-modal .box{max-width:1000px;margin:0 auto}
.ptw-modal .top{display:flex;gap:.8rem;align-items:baseline;flex-wrap:wrap;margin:0 0 .6rem}
.ptw-modal .top b{color:var(--accent);font-weight:normal}
.ptw-modal .top .sp{margin-left:auto}
.ptw-modal .top button{background:none;border:0;cursor:pointer;color:var(--muted);font:inherit;font-size:1.1em;padding:0 .3rem}
.ptw-modal .top button:hover{color:var(--accent)}
.ptw-modal .pair{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}
.ptw-modal .pair .h{color:var(--muted);font-size:.8rem;margin:0 0 .25rem}
.ptw-modal .pair svg{display:block;width:100%;aspect-ratio:1;max-height:calc(100vh - 12rem);border-radius:3px}
.ptw-modal .kv{display:flex;flex-wrap:wrap;gap:.2rem 1.3rem;margin:.7rem 0 0;font-size:.85rem}
.ptw-modal .kv span{color:var(--muted)}
@media (max-width:600px){.ptw-io{grid-template-columns:1fr 1fr}.ptw-io>div:first-child{grid-column:1/3}.ptw-modal .pair{grid-template-columns:1fr}}
`;

// ---------- data ----------
const cache = {};
async function slice(k) {
  if (!cache[k]) cache[k] = fetch(new URL(`data-${k}.json`, BASE)).then((r) => r.json()).then((d) => {
    const R = d.rows.map((a) => { const o = {}; d.cols.forEach((c, i) => { o[c] = a[i]; }); return o; });
    for (const r of R) { r.sysA = d.systems[r.sys].alias; r.condK = d.conds[r.cond]; r.stemK = d.stems[r.stem]; r.key = k; }
    return Object.assign(d, {R, key: k});
  });
  return cache[k];
}
const lossOf = (r, mode) => (PIXEL.has(r.condK) || mode === "px") ? r.lpx : r.lsurf;
// the draft's total loss: mean over part families of the mean over that family's answers
function famMean(rs, mode) {
  const by = new Map();
  for (const r of rs) { const v = lossOf(r, mode); if (v == null) continue; if (!by.has(r.family)) by.set(r.family, []); by.get(r.family).push(v); }
  if (!by.size) return null;
  let s = 0; for (const a of by.values()) s += a.reduce((x, y) => x + y, 0) / a.length;
  return s / by.size;
}
const cellRows = (sl, alias, cond) => sl.R.filter((r) => r.sysA === alias && r.condK === cond);

// ---------- drawing ----------
function marks(tgt, pred, k) {
  const rings = RINGS.map((rr, i) => `<circle cx="${tgt[0]}" cy="${tgt[1]}" r="${rr}" fill="none" stroke="${RING_COL[i]}" stroke-width="${1.3 * k}" stroke-dasharray="${3 * k},${3 * k}"/>`).join("");
  const a = 7 * k, d = pred ? `M${pred[0] - a} ${pred[1] - a}L${pred[0] + a} ${pred[1] + a}M${pred[0] - a} ${pred[1] + a}L${pred[0] + a} ${pred[1] - a}` : "";
  const x = pred ? `<path d="${d}" stroke="rgba(6,12,8,.55)" stroke-width="${4.6 * k}" fill="none"/><path d="${d}" stroke="${ANSWER}" stroke-width="${2.6 * k}" fill="none"/>` : "";
  return rings + `<circle cx="${tgt[0]}" cy="${tgt[1]}" r="${1.6 * k}" fill="#22c55e"/>` + x;
}
function zoomSvg(path, tgt, pred, win) {
  const cx = pred ? (tgt[0] + pred[0]) / 2 : tgt[0], cy = pred ? (tgt[1] + pred[1]) / 2 : tgt[1];
  const need = pred ? 2.2 * Math.hypot(pred[0] - tgt[0], pred[1] - tgt[1]) : 0;
  const s = Math.min(Math.max(win || 120, need), 512);
  const x0 = Math.max(0, Math.min(512 - s, cx - s / 2)), y0 = Math.max(0, Math.min(512 - s, cy - s / 2));
  return `<svg viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${s.toFixed(1)} ${s.toFixed(1)}"><image href="${esc(img(path))}" width="512" height="512"/>${marks(tgt, pred, s / 200)}</svg>`;
}
const fullSvg = (path, tgt, pred) => `<svg viewBox="0 0 512 512"><image href="${esc(img(path))}" width="512" height="512"/>${tgt ? marks(tgt, pred, 1.6) : ""}</svg>`;
function spark(values) {
  if (values.length < 3) return "";
  const w = 80, h = 12, bins = 14, hist = new Array(bins).fill(0);
  for (const v of values) hist[Math.min(bins - 1, Math.max(0, Math.floor(v * bins)))]++;
  const top = Math.max(...hist) || 1, bw = w / bins;
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">` + hist.map((n, i) => {
    const bh = Math.max(n ? 1 : 0, Math.round(h * n / top)), t = i / (bins - 1);
    const col = t < 0.25 ? "#2a9d8f" : t < 0.5 ? "#5b8fb9" : t < 0.75 ? "#d08a2e" : "#d9534f";
    return `<rect x="${(i * bw).toFixed(1)}" y="${h - bh}" width="${(bw - 0.8).toFixed(1)}" height="${bh}" fill="${col}"/>`;
  }).join("") + `</svg>`;
}
function classCounts(rs) {
  const n = {}; for (const r of rs) n[r.cls] = (n[r.cls] || 0) + 1;
  return CLS_ORDER.filter((c) => n[c]).map((c) => `${chip(c)} <span class="mono muted">${n[c]}</span>`).join("&ensp;");
}

// ---------- one modal for the page ----------
let modal, mList = [], mIdx = 0;
function openModal(list, i) {
  if (!modal) { modal = document.createElement("div"); modal.className = "ptw-modal"; modal.setAttribute("role", "dialog"); document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) return closeModal();
      const m = e.target.closest("[data-m]"); if (!m) return;
      if (m.dataset.m === "x") return closeModal();
      step(Number(m.dataset.m));
    });
  }
  mList = list; mIdx = i; drawModal(); modal.classList.add("on"); document.documentElement.style.overflow = "hidden";
}
function closeModal() { modal.classList.remove("on"); document.documentElement.style.overflow = ""; }
function step(d) { mIdx = (mIdx + d + mList.length) % mList.length; drawModal(); }
async function drawModal() {
  const r = mList[mIdx], sl = await slice(r.key), b = sl.bundles[r.stemK], cv = b.conds[r.condK], sys = sl.systems[r.sys];
  modal.innerHTML = `<div class="box"><div class="top"><b>${esc(sys.label)}</b><span class="muted">${esc(LABEL[r.condK])} · ${esc(short(r.stemK))}</span>
    <span class="sp mono muted">${mIdx + 1} / ${mList.length}</span><button data-m="-1" aria-label="previous">←</button><button data-m="1" aria-label="next">→</button><button data-m="x" aria-label="close">✕</button></div>
    <div class="pair"><div><p class="h">given: the source, marked</p>${fullSvg(b.src)}</div><div><p class="h">returned: answer against truth</p>${fullSvg(cv.img, cv.tgt, r.pred)}</div></div>
    <div class="kv"><div><span>answer</span> <span class="mono" style="color:var(--text)">${r.pred ? r.pred.map(Math.round).join(", ") : "none"}</span></div>
      <div><span>truth</span> <span class="mono" style="color:var(--text)">${cv.tgt.map(Math.round).join(", ")}</span></div>
      <div><span>off by</span> <span class="mono" style="color:var(--text)">${r.err == null ? "—" : fmt(r.err, 1) + " px"}</span></div>
      <div>${chip(r.cls)}</div>
      <div><span>loss</span> <span class="mono" style="color:var(--text)">pixel ${fmt(r.lpx, 4)}${r.lsurf != null ? ` · surface ${fmt(r.lsurf, 4)}` : ""}</span></div>
      <div><span>family</span> ${esc(b.family)}</div></div>
    <p class="muted" style="font-size:.78rem;margin:.4rem 0 0">Rings at r, 2r and 3r, r = 6.7 px; the cross is the answer. ← → step, Esc closes.</p></div>`;
}
document.addEventListener("keydown", (e) => {
  if (modal && modal.classList.contains("on")) {
    if (e.key === "Escape") closeModal();
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
    return;
  }
  if (activeExplorer && (e.key === "ArrowRight" || e.key === "ArrowLeft") && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName || "")) {
    activeExplorer.move(e.key === "ArrowRight" ? 1 : -1);
  }
});
let activeExplorer = null;

// ---------- results table ----------
async function table(root, key, harness) {
  const sl = await slice(key), conds = sl.conds;
  let mode = "surf", sel = null, drawer = [];
  const nOf = (c) => new Set(sl.R.filter((r) => r.condK === c).map((r) => r.stemK)).size;
  function draw() {
    const systems = sl.systems.slice();
    if (harness) systems.sort((a, b) => famMean(cellRows(sl, a.alias, conds[0]), mode) - famMean(cellRows(sl, b.alias, conds[0]), mode));
    const ncol = 1 + conds.length + (harness ? 3 : 0);
    let h = `<table><thead><tr><th>system</th>` + conds.map((c) =>
      `<th><b>${esc(LABEL[c])}</b>${PIXEL.has(c) || mode === "px" ? "pixel" : "surface"} loss<br><span class="mono">N = ${nOf(c)}</span></th>`).join("")
      + (harness ? `<th><b>precise</b>within r</th><th><b>$ / question</b>mean</th><th><b>time</b>median</th>` : "") + `</tr></thead><tbody>`;
    for (const s of systems) {
      h += `<tr><td class="sys"><i class="ptw-dot" style="background:${esc(s.colour)};border-radius:2px"></i>${esc(s.label)}</td>`;
      for (const c of conds) {
        const rs = cellRows(sl, s.alias, c);
        if (!rs.length) { h += `<td class="na">—</td>`; continue; }
        const on = sel && sel.alias === s.alias && sel.cond === c;
        h += `<td class="c${on ? " sel" : ""}" data-a="${esc(s.alias)}" data-c="${c}" tabindex="0"><span class="v mono">${fmt(famMean(rs, mode), 4)}</span>${spark(rs.map((r) => lossOf(r, mode)).filter((x) => x != null))}</td>`;
      }
      if (harness) {
        const rs = cellRows(sl, s.alias, conds[0]);
        const cost = rs.map((r) => r.cost).filter((x) => x != null), wall = rs.map((r) => r.wall).filter((x) => x != null);
        h += `<td class="mono">${rs.filter((r) => r.cls === "precise").length} / ${rs.length}</td><td class="mono">${cost.length ? "$" + fmt(cost.reduce((a, b) => a + b, 0) / cost.length, 2) : "—"}</td><td class="mono">${wall.length ? Math.round(median(wall)) + " s" : "—"}</td>`;
      }
      h += `</tr>`;
      if (sel && sel.alias === s.alias) {
        drawer = cellRows(sl, sel.alias, sel.cond).slice().sort((a, b) => (lossOf(a, mode) ?? 2) - (lossOf(b, mode) ?? 2) || (a.err ?? 1e9) - (b.err ?? 1e9));
        const tiles = drawer.map((r, i) => { const cv = sl.bundles[r.stemK].conds[r.condK];
          return `<div class="tile" data-t="${i}">${zoomSvg(cv.img, cv.tgt, r.pred, 110)}<div class="cap"><span style="color:${CLS_COL[r.cls]}">●</span><span class="mono">${r.err == null ? "—" : fmt(r.err, 1) + " px"}</span></div></div>`; }).join("");
        h += `<tr class="drawer"><td colspan="${ncol}"><div class="dhead"><span style="color:var(--accent)">${esc(s.label)}</span><span class="muted">${esc(LABEL[sel.cond])} · ${drawer.length} answers, best first</span>
          <span>${classCounts(drawer)}</span><button class="x" data-close aria-label="close">✕</button></div><div class="grid">${tiles}</div></td></tr>`;
      }
    }
    const toggle = conds.some((c) => !PIXEL.has(c)) ? `<span class="muted">loss</span><span class="ptw-seg"><button data-mode="px" class="${mode === "px" ? "on" : ""}">pixel</button><button data-mode="surf" class="${mode === "surf" ? "on" : ""}">surface</button></span>` : "";
    root.innerHTML = `<div class="ptw-bar">${toggle}<span class="muted">${esc(sl.half)} half, ${esc(DS_NAME[sl.dataset])}${harness ? ", five bench questions from the mini dev set" : ""}</span></div>
      <div class="ptw-wrap">${h}</tbody></table></div>
      <p class="note">Mean loss over part families, lower is better; the spread of single answers from 0 to 1 beneath. Click a cell for its answers.</p>`;
  }
  root.addEventListener("click", (e) => {
    const md = e.target.closest("[data-mode]"); if (md) { mode = md.dataset.mode; return draw(); }
    if (e.target.closest("[data-close]")) { sel = null; return draw(); }
    const t = e.target.closest(".tile"); if (t) return openModal(drawer, Number(t.dataset.t));
    const c = e.target.closest("td.c");
    if (c) { sel = sel && sel.alias === c.dataset.a && sel.cond === c.dataset.c ? null : {alias: c.dataset.a, cond: c.dataset.c}; draw(); }
  });
  root.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("td.c")) e.target.click(); });
  draw();
}

// ---------- explorer ----------
async function explorer(root) {
  const S = {};
  for (const k of SLICES.explorer) S[k] = await slice(k);
  const ex = {mode: "zs", ds: "v1", sys: null, cond: null, idx: 0, list: []};
  const cur = () => S[(ex.mode === "zs" ? "zs_" : "h_") + (ex.ds === "v1" ? "v1" : "wb")];
  function draw() {
    const sl = cur();
    if (!sl.systems.some((s) => s.alias === ex.sys)) ex.sys = (sl.systems.find((s) => s.alias === (ex.mode === "zs" ? "claude-fable-5" : "codex-astra-low")) || sl.systems[0]).alias;
    if (!sl.conds.includes(ex.cond)) ex.cond = sl.conds[Math.min(2, sl.conds.length - 1)];
    const list = ex.list = cellRows(sl, ex.sys, ex.cond).slice().sort((a, b) => a.stem - b.stem || a.rep - b.rep);
    const n = list.length; ex.idx = n ? ((ex.idx % n) + n) % n : 0;
    const r = list[ex.idx];
    const bar = `<div class="ptw-bar"><span class="ptw-seg"><button data-xm="zs" class="${ex.mode === "zs" ? "on" : ""}">single-shot</button><button data-xm="h" class="${ex.mode === "h" ? "on" : ""}">harness</button></span>
      <span class="ptw-seg"><button data-xd="v1" class="${ex.ds === "v1" ? "on" : ""}">single part</button><button data-xd="wb" class="${ex.ds === "wb" ? "on" : ""}">workbench</button></span></div>
      <div class="ptw-bar"><select data-x="sys" aria-label="system">${sl.systems.map((s) => `<option value="${esc(s.alias)}"${s.alias === ex.sys ? " selected" : ""}>${esc(s.label)}</option>`).join("")}</select>
      <select data-x="cond" aria-label="condition"${sl.conds.length < 2 ? " disabled" : ""}>${sl.conds.map((c) => `<option value="${c}"${c === ex.cond ? " selected" : ""}>${esc(LABEL[c])}</option>`).join("")}</select>
      <span class="ptw-step"><button data-xs="-1" aria-label="previous answer">←</button><span class="mono muted">${n ? ex.idx + 1 : 0} / ${n}</span><button data-xs="1" aria-label="next answer">→</button></span></div>`;
    if (!r) { root.innerHTML = bar + `<p class="muted">No answers stored for this system here.</p>`; return; }
    const b = sl.bundles[r.stemK], cv = b.conds[r.condK];
    root.innerHTML = bar + `<div class="ptw-io">
      <div><p class="h">given: the source, marked</p><div data-open>${fullSvg(b.src)}</div>
        <dl><dt>sample</dt><dd class="mono">${esc(short(r.stemK))}</dd><dt>${ex.mode === "zs" ? "answer" : "run"}</dt><dd>${ex.mode === "zs" ? `${r.rep + 1} of this question` : "one per question"}</dd></dl></div>
      <div><p class="h">given: the target</p><div data-open>${fullSvg(cv.img)}</div>
        <dl><dt>condition</dt><dd>${esc(LABEL[r.condK])}</dd><dt>half</dt><dd>${esc(sl.half)}</dd></dl></div>
      <div><p class="h">returned: answer against truth</p><div data-open>${zoomSvg(cv.img, cv.tgt, r.pred, 150)}</div>
        <dl><dt>off by</dt><dd class="mono">${r.err == null ? "no answer" : fmt(r.err, 1) + " px"}</dd><dt>class</dt><dd>${chip(r.cls)}</dd></dl></div></div>`;
  }
  const api = {move(d) { ex.idx += d; draw(); }};
  root.addEventListener("pointerenter", () => { activeExplorer = api; });
  root.addEventListener("focusin", () => { activeExplorer = api; });
  root.addEventListener("click", (e) => {
    const m = e.target.closest("[data-xm]"); if (m) { ex.mode = m.dataset.xm; ex.idx = 0; activeExplorer = api; return draw(); }
    const d = e.target.closest("[data-xd]"); if (d) { ex.ds = d.dataset.xd; ex.idx = 0; ex.cond = null; activeExplorer = api; return draw(); }
    const s = e.target.closest("[data-xs]"); if (s) { activeExplorer = api; return api.move(Number(s.dataset.xs)); }
    if (e.target.closest("[data-open]")) openModal(ex.list, ex.idx);
  });
  root.addEventListener("change", (e) => {
    if (e.target.dataset.x === "sys") ex.sys = e.target.value;
    if (e.target.dataset.x === "cond") ex.cond = e.target.value;
    ex.idx = 0; draw();
  });
  draw();
}

// ---------- mount ----------
const style = document.createElement("style"); style.textContent = CSS; document.head.appendChild(style);
for (const el of document.querySelectorAll(".widget-mount[data-widget-src]")) {
  if (new URL(el.dataset.widgetSrc, location.href).href !== new URL(import.meta.url).href || el.dataset.mounted) continue;
  el.dataset.mounted = "1"; el.classList.add("ptw");
  const name = el.dataset.widget;
  const run = name === "explorer" ? explorer(el) : name === "results-harness-workbench" ? table(el, "h_wb", true)
    : SLICES[name] ? table(el, SLICES[name][0], false) : Promise.reject(new Error(`no widget named "${name}"`));
  run.catch((e) => { el.innerHTML = `<p class="muted">Figure failed to load: ${esc(e.message)}</p>`; });
}
