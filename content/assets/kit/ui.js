// hadsed.com UI primitives: behavior for ui.css. Load once per page: <script src="ui.js" defer></script>
// Everything is driven by markup, so a draft needs no script of its own:
//   .ui-seg[data-name]        segmented toggle; buttons carry value="…", the chosen one aria-pressed="true"
//   .ui-select > select       becomes a themed menu; the select keeps the value and fires "change"
//   .ui-step[data-name]       previous / next over 1..data-total; <output> shows "i / n"
//   [data-for=name][data-when=value]   a panel shown only while control <name> holds <value>
//   th[data-sort]             click the title to sort the column (numbers if th.num, else text)
//   th[data-info="A · B · C"] hovering the head shows its details above it, one line per " · " part; the column lights up
//   [data-drawer=id]          opens / closes #id (a div, or a <tr> under the row), grown out of the trigger
//   [data-drawer-close]       closes the drawer it sits in
//   [data-modal=id][data-slide=i]      opens <dialog id> at slide i; ← → step, Esc closes
// Each control fires a bubbling "ui:change" event, detail {name, value}, for figures drawn in script.
// Markup added later works too: listeners sit on the document, and ui.init(root) sets up what is inside root.
(() => {
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.2, 1)", EASE_IN = "cubic-bezier(0.5, 0, 0.75, 0)";
  // Panels are looked up inside the nearest figure, so two figures can both use data-name="loss".
  const scopeOf = (el) => el.closest(".ui-fig, [data-ui-scope]") || document;

  function show(ctrl, name, value) {
    if (!name) return;
    for (const p of $$(`[data-for="${CSS.escape(name)}"]`, scopeOf(ctrl))) p.hidden = p.dataset.when !== String(value);
    ctrl.dispatchEvent(new CustomEvent("ui:change", { bubbles: true, detail: { name, value } }));
  }

  // ---------- segmented toggle: a thumb slides to the chosen option ----------
  function segThumb(seg) {
    let th = seg.querySelector(":scope > .ui-seg-thumb");
    if (!th) { th = document.createElement("span"); th.className = "ui-seg-thumb"; seg.prepend(th); seg.classList.add("has-thumb"); }
    const on = seg.querySelector("button[aria-checked='true']");
    if (!on || !on.offsetWidth) return;
    th.style.setProperty("--x", `${on.offsetLeft}px`); th.style.setProperty("--w", `${on.offsetWidth}px`);
  }
  function segPick(btn, focus) {
    const seg = btn.closest(".ui-seg");
    if (!seg || btn.disabled) return;
    for (const b of $$(":scope > button", seg)) {
      const on = b === btn;
      b.setAttribute("aria-checked", on); b.removeAttribute("aria-pressed"); b.tabIndex = on ? 0 : -1;
    }
    if (focus) btn.focus();
    segThumb(seg);
    seg.dataset.value = btn.value || btn.textContent.trim();
    show(seg, seg.dataset.name, seg.dataset.value);
  }
  function segInit(seg) {
    seg.setAttribute("role", "radiogroup");
    const bs = $$(":scope > button", seg);
    bs.forEach((b) => { b.type = "button"; b.setAttribute("role", "radio"); });
    const on = bs.find((b) => b.getAttribute("aria-pressed") === "true" || b.getAttribute("aria-checked") === "true") || bs.find((b) => !b.disabled);
    if (on) segPick(on, false);
    // the thumb moves only after the first paint, so it does not slide in on load
    requestAnimationFrame(() => requestAnimationFrame(() => seg.classList.add("is-ready")));
  }
  // fonts loading or a resize change button widths
  const reThumb = () => $$(".ui-seg.has-thumb").forEach(segThumb);
  addEventListener("resize", reThumb);
  if (document.fonts) document.fonts.ready.then(reThumb);

  // ---------- select: a themed menu in front of the native select ----------
  let menuOpen = null; // {wrap, sel, btn, menu}
  function selInit(wrap) {
    const sel = wrap.querySelector("select");
    if (!sel || wrap.classList.contains("is-menu")) return;
    wrap.classList.add("is-menu");
    sel.tabIndex = -1; sel.setAttribute("aria-hidden", "true");
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "ui-select-btn"; btn.disabled = sel.disabled;
    btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false");
    if (sel.getAttribute("aria-label")) btn.setAttribute("aria-label", sel.getAttribute("aria-label"));
    const menu = document.createElement("div");
    menu.className = "ui-menu"; menu.setAttribute("role", "listbox"); menu.hidden = true;
    wrap.append(btn, menu);
    selSync(wrap);
  }
  function selSync(wrap) {
    const sel = wrap.querySelector("select"), btn = wrap.querySelector(".ui-select-btn");
    const o = sel.options[sel.selectedIndex];
    btn.textContent = o ? o.textContent : "";
  }
  function selOpen(wrap) {
    const sel = wrap.querySelector("select"), btn = wrap.querySelector(".ui-select-btn"), menu = wrap.querySelector(".ui-menu");
    if (menuOpen) selClose(true);
    menu.innerHTML = Array.from(sel.options).map((o, i) =>
      `<div role="option" data-i="${i}" aria-selected="${i === sel.selectedIndex}"${o.disabled ? ' aria-disabled="true"' : ""}>${o.textContent.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</div>`).join("");
    menu.hidden = false; menu.classList.remove("up");
    const r = menu.getBoundingClientRect();
    if (r.bottom > innerHeight - 8 && btn.getBoundingClientRect().top > r.height + 8) menu.classList.add("up");
    btn.setAttribute("aria-expanded", "true");
    menuOpen = { wrap, sel, btn, menu };
    selActive(sel.selectedIndex);
    if (!calm()) menu.animate([{ opacity: 0, transform: "scaleY(0.85) translateY(-3px)" }, { opacity: 1, transform: "none" }], { duration: 150, easing: EASE_OUT });
  }
  function selClose(now) {
    if (!menuOpen) return;
    const { btn, menu } = menuOpen; menuOpen = null;
    btn.setAttribute("aria-expanded", "false");
    if (now || calm()) { menu.hidden = true; return; }
    menu.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scaleY(0.9) translateY(-2px)" }], { duration: 110, easing: EASE_IN })
      .onfinish = () => { if (btn.getAttribute("aria-expanded") === "false") menu.hidden = true; };
  }
  function selActive(i) {
    if (!menuOpen) return;
    const opts = $$("[role=option]", menuOpen.menu);
    opts.forEach((o, k) => o.classList.toggle("is-active", k === i));
    if (opts[i]) opts[i].scrollIntoView({ block: "nearest" });
    menuOpen.active = i;
  }
  function selChoose(i) {
    const { wrap, sel, btn } = menuOpen;
    if (!sel.options[i] || sel.options[i].disabled) return;
    const changed = sel.selectedIndex !== i;
    sel.selectedIndex = i; selSync(wrap); selClose(); btn.focus();
    if (changed) sel.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // ---------- stepper ----------
  function stepSet(st, i) {
    const n = Number(st.dataset.total) || 1;
    i = ((i - 1) % n + n) % n + 1;
    st.dataset.value = i;
    const out = st.querySelector("output"); if (out) out.textContent = `${i} / ${n}`;
    show(st, st.dataset.name, i);
  }

  // ---------- table header: sort, and the column details ----------
  function thInit(th) {
    if (th.querySelector(".ui-th")) return;
    const wrap = document.createElement("span"); wrap.className = "ui-th";
    const label = Array.from(th.childNodes);
    if (th.hasAttribute("data-sort")) {
      const b = document.createElement("button"); b.type = "button"; b.className = "ui-th-sort";
      b.title = "Sort"; label.forEach((n) => b.append(n)); wrap.append(b);
    } else label.forEach((n) => wrap.append(n));
    if (th.dataset.info) th.classList.add("has-info");
    th.append(wrap);
  }
  function cellValue(td, numeric) {
    if (!td) return numeric ? NaN : "";
    const vis = $$(".v", td).find((v) => !v.closest("[hidden]"));
    const t = td.dataset.v ?? (vis ? vis.textContent : td.textContent);
    return numeric ? parseFloat(t) : t.trim().toLowerCase();
  }
  function sortBy(th, dir) {
    const table = th.closest("table"), tbody = table.tBodies[0];
    const col = Array.from(th.parentNode.children).indexOf(th), numeric = th.classList.contains("num");
    // a row travels with the drawer rows that follow it
    const groups = [];
    for (const tr of Array.from(tbody.rows)) {
      if (tr.classList.contains("ui-drawer") && groups.length) groups[groups.length - 1].push(tr); else groups.push([tr]);
    }
    groups.forEach((g, k) => { if (g[0].dataset.order == null) g[0].dataset.order = k; });
    for (const h of $$("th", th.parentNode)) if (h !== th) h.removeAttribute("aria-sort");
    if (!dir) th.removeAttribute("aria-sort"); else th.setAttribute("aria-sort", dir);
    const key = (g) => cellValue(g[0].cells[col], numeric);
    groups.sort((a, b) => {
      if (!dir) return a[0].dataset.order - b[0].dataset.order;
      const x = key(a), y = key(b);
      if (numeric) { if (isNaN(x)) return 1; if (isNaN(y)) return -1; }
      const c = x < y ? -1 : x > y ? 1 : 0;
      return dir === "ascending" ? c : -c;
    });
    const before = new Map(groups.map((g) => [g[0], g[0].getBoundingClientRect().top]));
    groups.forEach((g) => g.forEach((tr) => tbody.append(tr)));
    // rows glide to their new places
    if (!calm()) for (const g of groups) {
      const dy = before.get(g[0]) - g[0].getBoundingClientRect().top;
      if (dy) g.forEach((tr) => tr.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 220, easing: EASE_OUT }));
    }
  }
  // details card for a column: floats above its head, so it never covers the numbers
  let pop = null, popTh = null, hot = null, popTimer = 0, hideTimer = 0;
  function popShow(th) {
    if (!pop) { pop = document.createElement("div"); pop.className = "ui-pop"; pop.setAttribute("role", "tooltip"); pop.id = "ui-pop"; pop.hidden = true; document.body.append(pop); }
    const parts = th.dataset.info.split(" · ");
    pop.innerHTML = "";
    parts.forEach((p, k) => { const el = document.createElement(k ? "span" : "b"); el.textContent = p; pop.append(el); });
    if (th.hasAttribute("data-sort")) { const h = document.createElement("span"); h.className = "hint"; h.textContent = "Click the head to sort."; pop.append(h); }
    const fresh = pop.hidden;
    pop.hidden = false;
    const r = th.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    const above = r.top - h - 10 > 8;
    const left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    pop.classList.toggle("above", above);
    pop.style.setProperty("--ax", `${Math.max(12, Math.min(w - 12, r.left + r.width / 2 - left))}px`);
    pop.style.left = `${left + scrollX}px`;
    pop.style.top = `${(above ? r.top - h - 10 : r.bottom + 10) + scrollY}px`;
    if (popTh && popTh !== th) popTh.removeAttribute("aria-describedby");
    th.setAttribute("aria-describedby", "ui-pop");
    if (fresh && !calm()) pop.animate([{ opacity: 0, transform: `translateY(${above ? 4 : -4}px)` }, { opacity: 1, transform: "none" }], { duration: 140, easing: EASE_OUT });
    popTh = th;
  }
  function popHide() { clearTimeout(popTimer); clearTimeout(hideTimer); if (pop) pop.hidden = true; if (popTh) popTh.removeAttribute("aria-describedby"); popTh = null; }
  // light one column: its head and every body cell under it
  function colHot(table, col) {
    if (hot && hot.table === table && hot.col === col) return;
    colCold();
    for (const row of table.rows) if (!row.classList.contains("ui-drawer") && row.cells[col]) row.cells[col].classList.add("ui-col-hot");
    hot = { table, col };
  }
  function colCold() { if (hot) $$(".ui-col-hot", hot.table).forEach((c) => c.classList.remove("ui-col-hot")); hot = null; }
  // The column lights up under the pointer. Only the head shows the details card.
  function colEnter(cell) {
    const table = cell.closest("table"), row = cell.parentNode;
    if (row.classList.contains("ui-drawer")) return colCold();
    colHot(table, cell.cellIndex);
  }
  // The card opens after a short pause on a head, so a pointer passing over does not flash it;
  // once open, it moves to the next head at once. It stays while the pointer is on the head or on the
  // card itself (so its text can be selected), and closes a second after the pointer leaves both.
  function headEnter(th) {
    clearTimeout(hideTimer); clearTimeout(popTimer);
    if (popTh && !pop.hidden) popShow(th); else popTimer = setTimeout(() => popShow(th), 260);
  }
  function popLinger() { clearTimeout(popTimer); clearTimeout(hideTimer); hideTimer = setTimeout(popHide, 1000); }

  // ---------- drawer: grows out of its trigger, shrinks back into it ----------
  function drawerParts(d) {
    const wrap = d.tagName === "TR" ? d.querySelector(".ui-drawer-in") || d.cells[0] : d;
    let box = wrap.querySelector(":scope > .ui-drawer-box");
    if (!box) { box = document.createElement("div"); box.className = "ui-drawer-box"; box.append(...wrap.childNodes); wrap.append(box); }
    return { wrap, box };
  }
  function drawerOpen(trigger, d) {
    d.hidden = false;
    const { wrap, box } = drawerParts(d);
    const tr = trigger.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    const ox = Math.max(14, Math.min(wr.width - 14, tr.left + tr.width / 2 - wr.left));
    box.style.setProperty("--ox", `${ox}px`);
    trigger.classList.add("is-open"); trigger.setAttribute("aria-expanded", "true");
    if (calm()) return;
    const h = wrap.offsetHeight;
    wrap.getAnimations().forEach((a) => a.cancel()); box.getAnimations().forEach((a) => a.cancel());
    wrap.animate([{ height: "0px" }, { height: `${h}px` }], { duration: 260, easing: EASE_OUT });
    box.animate([{ transform: "scale(0.9)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 260, easing: EASE_OUT });
  }
  function drawerClose(trigger, d, now) {
    d = d || document.getElementById(trigger.dataset.drawer);
    trigger.classList.remove("is-open"); trigger.setAttribute("aria-expanded", "false");
    if (!d || d.hidden) return;
    if (now || calm()) { d.hidden = true; return; }
    const { wrap, box } = drawerParts(d), h = wrap.offsetHeight;
    box.animate([{ transform: "none", opacity: 1 }, { transform: "scale(0.9)", opacity: 0 }], { duration: 190, easing: EASE_IN, fill: "forwards" });
    const a = wrap.animate([{ height: `${h}px` }, { height: "0px" }], { duration: 190, easing: EASE_IN, fill: "forwards" });
    a.onfinish = () => {
      if (!trigger.classList.contains("is-open")) d.hidden = true;
      wrap.getAnimations().forEach((x) => x.cancel()); box.getAnimations().forEach((x) => x.cancel());
    };
  }
  function drawerToggle(trigger) {
    const d = document.getElementById(trigger.dataset.drawer);
    if (!d) return;
    if (trigger.classList.contains("is-open") && !d.hidden) return drawerClose(trigger, d);
    // One open drawer per table or group: the other one shuts at once, so rows do not jump twice.
    const group = trigger.closest(".ui-table, [data-drawer-group]");
    if (group) for (const t of $$("[data-drawer]", group)) if (t !== trigger) drawerClose(t, null, true);
    drawerOpen(trigger, d);
  }

  // ---------- modal ----------
  let openDlg = null;
  function modalOpen(id, slide) {
    const dlg = document.getElementById(id);
    if (!dlg || typeof dlg.showModal !== "function") return;
    openDlg = dlg;
    modalGo(dlg, slide || 0);
    if (!dlg.open) dlg.showModal();
  }
  function modalGo(dlg, i) {
    const slides = $$(".ui-slide", dlg);
    if (!slides.length) return;
    const n = slides.length; i = ((i % n) + n) % n;
    slides.forEach((s, k) => { s.hidden = k !== i; });
    dlg.dataset.slide = i;
    const c = dlg.querySelector(".ui-modal-count"); if (c) c.textContent = `${i + 1} / ${n}`;
    const t = dlg.querySelector(".ui-modal-head .t"); if (t && slides[i].dataset.title) t.textContent = slides[i].dataset.title;
  }

  // ---------- one listener set for the page ----------
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (menuOpen && !menuOpen.wrap.contains(t)) selClose();
    const opt = t.closest(".ui-menu [role=option]"); if (opt && menuOpen) return selChoose(Number(opt.dataset.i));
    const sb = t.closest(".ui-select-btn");
    if (sb) { const w = sb.closest(".ui-select"); return menuOpen && menuOpen.wrap === w ? selClose() : selOpen(w); }
    const srt = t.closest(".ui-th-sort");
    if (srt) {
      const th = srt.closest("th"), cur = th.getAttribute("aria-sort");
      if (th.dataset.info && e.pointerType && e.pointerType !== "mouse") popShow(th); // a tap has no hover: show the details with the sort
      // first click: low to high (lower loss is better); second: high to low; third: the original order
      return sortBy(th, !cur ? "ascending" : cur === "ascending" ? "descending" : null);
    }
    const segBtn = t.closest(".ui-seg > button"); if (segBtn) return segPick(segBtn, false);
    const st = t.closest(".ui-step [data-step]");
    if (st) { const s = st.closest(".ui-step"); return stepSet(s, Number(s.dataset.value || 1) + Number(st.dataset.step)); }
    const dc = t.closest("[data-drawer-close]");
    if (dc) {
      const d = dc.closest(".ui-drawer");
      const trig = d && document.querySelector(`[data-drawer="${CSS.escape(d.id)}"]`);
      if (trig) { drawerClose(trig, d); trig.focus({ preventScroll: true }); } else if (d) d.hidden = true;
      return;
    }
    const dr = t.closest("[data-drawer]"); if (dr) return drawerToggle(dr);
    const mo = t.closest("[data-modal]"); if (mo) return modalOpen(mo.dataset.modal, Number(mo.dataset.slide || 0));
    const dlg = t.closest("dialog.ui-modal");
    if (dlg) {
      const ms = t.closest("[data-modal-step]"); if (ms) return modalGo(dlg, Number(dlg.dataset.slide || 0) + Number(ms.dataset.modalStep));
      if (t.closest("[data-modal-close]") || t === dlg) return dlg.close(); // a click on the backdrop lands on the dialog itself
    }
  });

  // hovering a column lights it; hovering its head also shows the details card
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse" || !e.target.closest) return;
    if (e.target.closest(".ui-pop")) return clearTimeout(hideTimer);
    const cell = e.target.closest(".ui-table th, .ui-table td");
    if (cell) colEnter(cell);
    const th = e.target.closest(".ui-table thead th.has-info");
    if (th) headEnter(th);
  });
  document.addEventListener("pointerout", (e) => {
    if (!e.target.closest) return;
    const to = e.relatedTarget;
    const tbl = e.target.closest(".ui-table table");
    if (tbl && !(to && tbl.contains(to))) colCold();
    // leaving the head or the card for somewhere that is neither: start the one-second linger
    const from = e.target.closest(".ui-table thead th.has-info, .ui-pop");
    if (from && !(to && to.closest && to.closest(".ui-table thead th.has-info, .ui-pop"))) {
      clearTimeout(popTimer);
      if (popTh) popLinger();
    }
  });
  // keyboard: focusing a sortable head shows its details
  document.addEventListener("focusin", (e) => { const b = e.target.closest && e.target.closest(".ui-th-sort"); if (b && b.closest("th").dataset.info) popShow(b.closest("th")); });
  document.addEventListener("focusout", (e) => { if (e.target.closest && e.target.closest(".ui-th-sort") && !(pop && pop.matches(":hover"))) popLinger(); });

  document.addEventListener("change", (e) => {
    const sel = e.target.closest(".ui-select select");
    if (!sel) return;
    if (sel.closest(".is-menu")) selSync(sel.closest(".ui-select"));
    show(sel, sel.name || sel.dataset.name, sel.value);
  });

  // a sorted table re-sorts when a toggle changes what its cells show (pixel / surface loss)
  document.addEventListener("ui:change", (e) => {
    for (const th of $$("th[aria-sort]", scopeOf(e.target))) sortBy(th, th.getAttribute("aria-sort"));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && pop && !pop.hidden) { popHide(); colCold(); }
    if (menuOpen) {
      const n = menuOpen.sel.options.length, a = menuOpen.active ?? 0;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); return selActive((a + (e.key === "ArrowDown" ? 1 : -1) + n) % n); }
      if (e.key === "Home" || e.key === "End") { e.preventDefault(); return selActive(e.key === "Home" ? 0 : n - 1); }
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); return selChoose(a); }
      if (e.key === "Escape") { e.preventDefault(); const b = menuOpen.btn; selClose(); return b.focus(); }
      if (e.key === "Tab") return selClose();
      if (e.key.length === 1) { // type to jump
        const opts = Array.from(menuOpen.sel.options), k = opts.findIndex((o, j) => j > a && o.textContent.toLowerCase().startsWith(e.key.toLowerCase()));
        const k2 = k >= 0 ? k : opts.findIndex((o) => o.textContent.toLowerCase().startsWith(e.key.toLowerCase()));
        if (k2 >= 0) selActive(k2);
        return;
      }
    }
    const sb = e.target.closest && e.target.closest(".ui-select-btn");
    if (sb && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); return selOpen(sb.closest(".ui-select")); }
    if (openDlg && openDlg.open && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      e.preventDefault();
      return modalGo(openDlg, Number(openDlg.dataset.slide || 0) + (e.key === "ArrowRight" ? 1 : -1));
    }
    // Arrow keys move inside a segmented toggle, like a radio group.
    const b = e.target.closest && e.target.closest(".ui-seg > button");
    if (b && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) {
      const bs = $$(":scope > button:not([disabled])", b.closest(".ui-seg"));
      const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
      e.preventDefault();
      return segPick(bs[(bs.indexOf(b) + d + bs.length) % bs.length], true);
    }
    // Table cells that open drawers answer Enter and Space.
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("td[data-drawer], [data-modal]:not(button)")) {
      e.preventDefault(); e.target.click();
    }
  });
  addEventListener("scroll", () => { if (pop && !pop.hidden && popTh) popShow(popTh); }, { passive: true, capture: true });

  function init(root = document) {
    $$(".ui-seg", root).forEach(segInit);
    $$(".ui-select", root).forEach(selInit);
    $$(".ui-step", root).forEach((s) => stepSet(s, Number(s.dataset.value || 1)));
    $$(".ui-select select", root).forEach((s) => { if (s.name || s.dataset.name) show(s, s.name || s.dataset.name, s.value); });
    $$("th[data-sort], th[data-info]", root).forEach(thInit);
    for (const t of $$("[data-drawer]", root)) {
      if (!/^(BUTTON|A)$/.test(t.tagName)) { t.tabIndex = 0; t.setAttribute("role", "button"); }
      const d = document.getElementById(t.dataset.drawer);
      t.setAttribute("aria-expanded", !!(d && !d.hidden)); t.classList.toggle("is-open", !!(d && !d.hidden));
      if (d) t.setAttribute("aria-controls", d.id);
    }
    for (const m of $$("[data-modal]:not(button)", root)) { m.tabIndex = 0; m.setAttribute("role", "button"); }
  }
  window.ui = { init, modalOpen };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => init()); else init();
})();
