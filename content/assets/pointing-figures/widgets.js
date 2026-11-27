// Pointing benchmark figures, rendered into the article's own DOM.
// Embedded from the draft as ![[pointing-figures/widgets.js|<name>]], where <name> is one of
//   explorer · results-single-part · results-workbench · results-harness-workbench
// The site turns each embed into <div class="widget-mount" data-widget="<name>"> and loads this module once.
// Everything is drawn with the figure kit (hadsed.com/design-system: ui.css + ui.js), which the page loads:
// .ui-fig frame, .ui-bar / .ui-seg / .ui-select / .ui-step controls, .ui-table with sort and column details,
// .ui-drawer rows, .ui-tiles, a .ui-modal <dialog>, .ui-badge for the grading classes, .ui-state for loading and failure.
// Data and images sit next to this file: data-<slice>.json and img/*.webp (built by figure-build/).
const BASE = new URL(".", import.meta.url);
// the page loads this script as widgets.js?v=<hash>; data files get the same tag so a new build skips stale caches
const VER = new URL(import.meta.url).search;
const SLICES = {explorer: ["zs_v1", "zs_wb", "h_v1", "h_wb"], "results-single-part": ["zs_v1"],
                "results-workbench": ["zs_wb"], "results-harness-workbench": ["h_wb"]};
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const R6 = 6.7, RINGS = [R6, 2 * R6, 3 * R6], RING_COL = ["#22c55e", "#eab308", "#ef4444"], ANSWER = "#3b82f6";
const PIXEL = new Set(["same_image", "exact_2d", "view_roll"]);
const LABEL = {same_image: "Same image", exact_2d: "Exact 2D transform", view20: "Small view change", view60: "Large view change",
               view_roll: "Camera roll", view_small: "Small view change", view_large: "Large view change"};
// table heads stay short; the column details card (data-info) carries the full name
const SHORT = {same_image: "Same image", exact_2d: "Exact 2D", view20: "Small view", view60: "Large view", view_roll: "Roll", view_small: "Small view", view_large: "Large view"};
const CLS_NAME = {precise: "precise", near: "near", mid: "mid", wrong_region: "wrong place", background: "off the part",
                  wrong_part: "wrong object", off_canvas: "off canvas", undecodable: "no answer"};
const CLS_COL = {precise: "#2a9d8f", near: "#8bbf5a", mid: "#5b8fb9", wrong_region: "#d08a2e", background: "#d9534f",
                 wrong_part: "#c0397a", off_canvas: "#a33", undecodable: "#7d8590"};
const CLS_ORDER = Object.keys(CLS_COL);
const DS_NAME = {v1: "single part", workbench: "workbench"};
// grading class -> the kit's badge tone (ui.css .ui-badge[data-tone])
const TONE = {precise: "precise", near: "near", mid: "mid", wrong_region: "wrong", background: "off", wrong_part: "object", off_canvas: "off", undecodable: "none"};
const badge = (c, n) => `<span class="ui-badge" data-tone="${TONE[c] || "none"}">${esc(CLS_NAME[c] || c)}${n != null ? ` <b>${n}</b>` : ""}</span>`;
const img = (p) => new URL("img/" + p.replace(/\//g, "-").replace(/\.png$/, ".webp"), BASE).href;
const fmt = (x, d) => x == null || isNaN(x) ? "—" : Number(x).toFixed(d);
const short = (stem) => stem.replace(/_s\d+$/, "").replace(/^workbench_/, "");
const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// ---------- data ----------
const cache = {};
// a flaky connection (plane wifi) gets four tries with backoff before the figure gives up
async function getJSON(url, tries = 4) {
  for (let i = 0; ; i++) {
    try { const r = await fetch(url, i ? { cache: "reload" } : undefined); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json(); }
    catch (e) { if (i + 1 >= tries) throw e; await new Promise((ok) => setTimeout(ok, 800 * 2 ** i)); }
  }
}
async function slice(k) {
  if (!cache[k]) cache[k] = getJSON(new URL(`data-${k}.json${VER}`, BASE)).then((d) => {
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
// A full 512 view as a lazy <img> with the marks drawn over it, so a modal's hidden slides fetch nothing until shown.
const fullView = (path, tgt, pred) => `<div style="position:relative"><img src="${esc(img(path))}" alt="" loading="lazy" width="512" height="512">${tgt
  ? `<svg viewBox="0 0 512 512" aria-hidden="true" style="position:absolute;inset:0;background:none">${marks(tgt, pred, 1.6)}</svg>` : ""}</div>`;
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

const counts = (rs) => { const n = {}; for (const r of rs) n[r.cls] = (n[r.cls] || 0) + 1; return CLS_ORDER.filter((c) => n[c]).map((c) => badge(c, n[c])).join(" "); };
const offBy = (r) => r.err == null ? "no answer" : fmt(r.err, 1) + " px";

// ---------- modal: one kit <dialog> per figure, its slides written just before it opens ----------
function dialogFor(root) {
  let dlg = root.querySelector("dialog.ui-modal");
  if (!dlg) {
    dlg = document.createElement("dialog"); dlg.className = "ui-modal"; dlg.id = `ptw-m-${root.dataset.n}`; dlg.setAttribute("aria-label", "answers");
    dlg.innerHTML = `<div class="ui-modal-head"><span class="t"></span><span class="ui-muted" data-sub></span>
      <span class="ctl"><span class="ui-modal-count"></span><button class="ui-icon" data-modal-step="-1" aria-label="previous">←</button><button class="ui-icon" data-modal-step="1" aria-label="next">→</button><button class="ui-icon" data-modal-close aria-label="close">✕</button></span></div>
      <div class="ui-modal-body"></div><p class="ui-modal-foot">Rings at r, 2r and 3r, r = 6.7 px; the cross is the answer. ← → step, Esc closes.</p>`;
    root.append(dlg);
  }
  return dlg;
}
function fillModal(root, sl, list, sub) {
  const dlg = dialogFor(root);
  dlg.querySelector("[data-sub]").textContent = sub;
  dlg.querySelector(".ui-modal-body").innerHTML = list.map((r) => {
    const b = sl.bundles[r.stemK], cv = b.conds[r.condK];
    return `<div class="ui-slide" data-title="${esc(short(r.stemK))}" hidden>
      <div class="ui-pair"><div><p class="h">given: the source, marked</p>${fullView(b.src)}</div><div><p class="h">returned: answer against truth</p>${fullView(cv.img, cv.tgt, r.pred)}</div></div>
      <div class="ui-kv"><div><span>answer</span><span class="ui-mono">${r.pred ? r.pred.map(Math.round).join(", ") : "none"}</span></div>
        <div><span>truth</span><span class="ui-mono">${cv.tgt.map(Math.round).join(", ")}</span></div>
        <div><span>off by</span><span class="ui-mono">${offBy(r)}</span></div><div>${badge(r.cls)}</div>
        <div><span>loss</span><span class="ui-mono">pixel ${fmt(r.lpx, 4)}${r.lsurf != null ? ` · surface ${fmt(r.lsurf, 4)}` : ""}</span></div>
        <div><span>family</span>${esc(b.family.replace(/_/g, " "))}</div></div></div>`;
  }).join("");
  return dlg.id;
}

// ---------- results table ----------
async function table(root, key, harness) {
  const sl = await slice(key), conds = sl.conds, n = root.dataset.n;
  const nOf = (c) => new Set(sl.R.filter((r) => r.condK === c).map((r) => r.stemK)).size;
  const hasSurf = conds.some((c) => !PIXEL.has(c));
  const best = {};
  for (const m of ["px", "surf"]) for (const c of conds) best[m + c] = Math.min(...sl.systems.map((s) => famMean(cellRows(sl, s.alias, c), m) ?? Infinity));
  const val = (rs, m, c) => { const v = famMean(rs, m); return `<span class="v${Math.abs(v - best[m + c]) < 1e-12 ? " best" : ""}">${fmt(v, 4)}</span>${spark(rs.map((r) => lossOf(r, m)).filter((x) => x != null))}`; };
  const info = (c) => `${LABEL[c]} · ${PIXEL.has(c) ? "Pixel loss, since the view does not change" : "Surface loss, or pixel loss with the toggle above"} · Mean over part families; lower is better · N = ${nOf(c)} questions, ${sl.half} half`;
  const head = `<tr><th data-sort>system</th>` + conds.map((c) => `<th class="num" data-sort data-info="${esc(info(c))}">${esc(SHORT[c] || LABEL[c])}</th>`).join("")
    + (harness ? `<th class="num" data-sort data-info="Precise · Answers within r = 6.7 px · one answer per question">precise</th><th class="num" data-sort data-info="Cost · Mean dollars per question">$ / question</th><th class="num" data-sort data-info="Time · Median wall time per question">time</th>` : "") + `</tr>`;
  const ncol = 1 + conds.length + (harness ? 3 : 0);
  let systems = sl.systems.slice();
  if (harness) systems.sort((a, b) => famMean(cellRows(sl, a.alias, conds[0]), "surf") - famMean(cellRows(sl, b.alias, conds[0]), "surf"));
  const rows = systems.map((s, si) => {
    let h = `<tr data-s="${si}"><td class="key"><i class="ui-swatch" style="--c:${esc(s.colour)}"></i>${esc(s.label)}</td>`;
    for (const c of conds) {
      const rs = cellRows(sl, s.alias, c);
      if (!rs.length) { h += `<td class="num na">—</td>`; continue; }
      const inner = PIXEL.has(c) ? val(rs, "px", c) : `<span data-for="loss" data-when="surf">${val(rs, "surf", c)}</span><span data-for="loss" data-when="px" hidden>${val(rs, "px", c)}</span>`;
      h += `<td class="num" data-drawer="ptw-${n}-${si}-${c}" data-a="${esc(s.alias)}" data-c="${c}">${inner}</td>`;
    }
    if (harness) {
      const rs = cellRows(sl, s.alias, conds[0]);
      const cost = rs.map((r) => r.cost).filter((x) => x != null), wall = rs.map((r) => r.wall).filter((x) => x != null);
      const p = rs.filter((r) => r.cls === "precise").length;
      h += `<td class="num" data-v="${p}">${p} / ${rs.length}</td><td class="num" data-v="${cost.length ? cost.reduce((a, b) => a + b, 0) / cost.length : ""}">${cost.length ? "$" + fmt(cost.reduce((a, b) => a + b, 0) / cost.length, 2) : "—"}</td><td class="num" data-v="${wall.length ? median(wall) : ""}">${wall.length ? Math.round(median(wall)) + " s" : "—"}</td>`;
    }
    return h + `</tr>`;
  }).join("");
  const toggle = hasSurf ? `<span class="ui-field"><span class="ui-label">loss</span><span class="ui-seg sm" data-name="loss"><button value="px">pixel</button><button value="surf" aria-pressed="true">surface</button></span></span>` : "";
  root.innerHTML = `<figure class="ui-fig" data-ui-scope>
    <div class="ui-bar">${toggle}<span class="ui-muted">${esc(sl.half)} half, ${esc(DS_NAME[sl.dataset])}, ${harness ? "harness, five bench questions from the mini dev set" : "single-shot"}</span></div>
    <div class="ui-table"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div>
    <figcaption>Mean loss over part families, <em>lower is better</em>; the bars under each number are the spread of single answers from 0 to 1. Click a cell for its answers.</figcaption></figure>`;
  const mode = () => root.querySelector('.ui-seg[data-name="loss"]')?.dataset.value || "surf";
  // A cell's drawer row is written on its first click, just before ui.js opens it (this listener runs first).
  root.addEventListener("click", (e) => {
    const td = e.target.closest("td[data-drawer]");
    if (td && !document.getElementById(td.dataset.drawer)) {
      const m = mode(), s = sl.systems.find((x) => x.alias === td.dataset.a), c = td.dataset.c;
      const list = cellRows(sl, s.alias, c).slice().sort((a, b) => (lossOf(a, m) ?? 2) - (lossOf(b, m) ?? 2) || (a.err ?? 1e9) - (b.err ?? 1e9));
      const tr = document.createElement("tr"); tr.className = "ui-drawer"; tr.id = td.dataset.drawer; tr.hidden = true;
      tr._list = list; tr._sub = `${s.label} · ${LABEL[c]}`;
      tr.innerHTML = `<td class="ui-drawer-cell" colspan="${ncol}"><div class="ui-drawer-in">
        <div class="ui-drawer-head"><span class="t">${esc(s.label)}</span><span class="ui-muted">${esc(LABEL[c])} · ${list.length} answers, best first</span><span>${counts(list)}</span>
        <button class="ui-icon" data-drawer-close aria-label="close">✕</button></div>
        <div class="ui-tiles scroll">${list.map((r, i) => { const cv = sl.bundles[r.stemK].conds[r.condK];
          return `<button class="ui-tile" data-modal="" data-slide="${i}" aria-label="answer ${i + 1}, ${esc(CLS_NAME[r.cls])}">${zoomSvg(cv.img, cv.tgt, r.pred, 110)}<span class="cap"><span style="color:var(--tone-${TONE[r.cls]})">●</span><span>${r.err == null ? "—" : fmt(r.err, 1) + " px"}</span></span></button>`; }).join("")}</div></div></td>`;
      td.parentNode.after(tr);
    }
    const tile = e.target.closest(".ui-tile[data-modal]");
    if (tile) { const tr = tile.closest("tr.ui-drawer"); tile.dataset.modal = fillModal(root, sl, tr._list, tr._sub); }
  });
}

// ---------- explorer ----------
async function explorer(root) {
  const S = {};
  for (const k of SLICES.explorer) S[k] = await slice(k);
  const ex = {mode: "zs", ds: "v1", sys: null, cond: null, idx: 0, list: []};
  const cur = () => S[(ex.mode === "zs" ? "zs_" : "h_") + (ex.ds === "v1" ? "v1" : "wb")];
  root.innerHTML = `<figure class="ui-fig boxed" data-ui-scope>
    <div class="ui-bar"><span class="ui-seg" data-name="xm"><button value="zs" aria-pressed="true">single-shot</button><button value="h">harness</button></span>
      <span class="ui-seg" data-name="xd"><button value="v1" aria-pressed="true">single part</button><button value="wb">workbench</button></span></div>
    <div class="ui-bar" data-pick></div><div data-body></div></figure>`;
  const pick = root.querySelector("[data-pick]"), body = root.querySelector("[data-body]");
  function controls() {
    const sl = cur();
    if (!sl.systems.some((s) => s.alias === ex.sys)) ex.sys = (sl.systems.find((s) => s.alias === (ex.mode === "zs" ? "claude-fable-5" : "codex-astra-low")) || sl.systems[0]).alias;
    if (!sl.conds.includes(ex.cond)) ex.cond = sl.conds[Math.min(2, sl.conds.length - 1)];
    ex.list = cellRows(sl, ex.sys, ex.cond).slice().sort((a, b) => a.stem - b.stem || a.rep - b.rep);
    ex.idx = 0;
    const nn = Math.max(1, ex.list.length);
    pick.innerHTML = `<span class="ui-field"><span class="ui-label">system</span><span class="ui-select"><select name="xsys" aria-label="system">${sl.systems.map((s) => `<option value="${esc(s.alias)}"${s.alias === ex.sys ? " selected" : ""}>${esc(s.label)}</option>`).join("")}</select></span></span>
      <span class="ui-field"><span class="ui-label">view</span><span class="ui-select"><select name="xcond" aria-label="condition"${sl.conds.length < 2 ? " disabled" : ""}>${sl.conds.map((c) => `<option value="${c}"${c === ex.cond ? " selected" : ""}>${esc(LABEL[c])}</option>`).join("")}</select></span></span>
      <span class="ui-gap"></span>
      <span class="ui-step" data-name="answer" data-total="${nn}"><button class="ui-icon" data-step="-1" aria-label="previous answer">←</button><output>1 / ${nn}</output><button class="ui-icon" data-step="1" aria-label="next answer">→</button></span>`;
    window.ui.init(pick);
    draw();
  }
  function draw() {
    const sl = cur(), r = ex.list[ex.idx];
    if (!r) { body.innerHTML = `<div class="ui-state">No answers stored for this system here.</div>`; return; }
    const b = sl.bundles[r.stemK], cv = b.conds[r.condK];
    const pane = (h, inner, kv) => `<div><p class="ui-eyebrow">${h}</p><div class="ui-tile" data-modal="" data-slide="${ex.idx}" role="button" tabindex="0" aria-label="open full size">${inner}</div><div class="ui-kv">${kv}</div></div>`;
    body.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:0.9rem;overflow-wrap:anywhere">
      ${pane("source, marked", fullSvg(b.src), `<div><span>sample</span><span class="ui-mono">${esc(short(r.stemK))}</span></div><div><span>${ex.mode === "zs" ? "answer" : "run"}</span>${ex.mode === "zs" ? `${r.rep + 1} of this question` : "one per question"}</div>`)}
      ${pane("target", fullSvg(cv.img), `<div><span>view</span>${esc(LABEL[r.condK])}</div><div><span>half</span>${esc(sl.half)}</div>`)}
      ${pane("answer vs truth", zoomSvg(cv.img, cv.tgt, r.pred, 150), `<div><span>off by</span><span class="ui-mono">${offBy(r)}</span></div><div>${badge(r.cls)}</div>`)}</div>`;
  }
  root.addEventListener("ui:change", (e) => {
    const {name, value} = e.detail;
    // ui.init repeats each control's current value; only a real change redraws (else init -> redraw -> init loops)
    if (name === "xm" && value !== ex.mode) { ex.mode = value; controls(); }
    else if (name === "xd" && value !== ex.ds) { ex.ds = value; ex.cond = null; controls(); }
    else if (name === "xsys" && value !== ex.sys) { ex.sys = value; controls(); }
    else if (name === "xcond" && value !== ex.cond) { ex.cond = value; controls(); }
    else if (name === "answer") { ex.idx = Number(value) - 1; draw(); }
  });
  root.addEventListener("click", (e) => {
    const t = e.target.closest(".ui-tile[data-modal]");
    if (t) { const sl = cur(); t.dataset.modal = fillModal(root, sl, ex.list, `${sl.systems.find((s) => s.alias === ex.sys).label} · ${LABEL[ex.cond]}`); }
  });
  // ← → step the explorer under the pointer, unless a menu or the modal has the keys
  root.addEventListener("pointerenter", () => { activeExplorer = root; });
  root.addEventListener("focusin", () => { activeExplorer = root; });
  controls();
}
let activeExplorer = null;
document.addEventListener("keydown", (e) => {
  if (!activeExplorer || (e.key !== "ArrowRight" && e.key !== "ArrowLeft") || document.querySelector("dialog.ui-modal[open]")) return;
  if (e.target.closest && e.target.closest(".ui-seg, .ui-select, input, textarea")) return;
  activeExplorer.querySelector(`.ui-step [data-step="${e.key === "ArrowRight" ? 1 : -1}"]`)?.click();
});

// ---------- mount ----------
let count = 0;
function mountAll() {
  for (const el of document.querySelectorAll(".widget-mount[data-widget-src]")) {
    // resolved against this module's own URL: the first page of a visit is served inside the sky wrapper as
    // about:srcdoc, where location.href is no base for a relative path
    if (new URL(el.dataset.widgetSrc, import.meta.url).pathname !== new URL(import.meta.url).pathname || el.dataset.mounted) continue;
    el.dataset.mounted = "1"; el.dataset.n = el.dataset.n || String(++count);
    const name = el.dataset.widget;
    el.innerHTML = `<div class="ui-state" role="status"><span class="ui-loader" data-kind="rings"></span>Loading the figure…</div>`;
    const run = !window.ui ? Promise.reject(new Error("the figure kit (ui.js) is not on this page"))
      : name === "explorer" ? explorer(el) : name === "results-harness-workbench" ? table(el, "h_wb", true)
      : SLICES[name] ? table(el, SLICES[name][0], false) : Promise.reject(new Error(`no widget named "${name}"`));
    run.then(() => window.ui.init(el)).catch((e) => {
      for (const k of SLICES[name] || []) delete cache[k];
      el.innerHTML = `<div class="ui-state error" role="alert"><span>The figure's data did not load.</span><span class="why">${esc(e.message)}</span><button class="ui-btn glow">Try again</button></div>`;
      el.querySelector(".ui-btn").addEventListener("click", () => { delete el.dataset.mounted; mountAll(); });
    });
  }
}
// ui.js is a classic deferred script and this a module: both run after parsing, ui.js first, but wait for it to be safe
if (window.ui) mountAll(); else addEventListener("DOMContentLoaded", mountAll);
