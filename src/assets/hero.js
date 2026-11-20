// Animated heroes (lib/hero.mjs): a still frame until hovered, then the motion. The motion downloads
// in the background once the page has loaded and gone idle, so hovering plays at once; it waits for a
// hover instead on Save-Data or 2G/3G-class connections.
// A card in a list plays when the pointer is anywhere on it. Touch screens have no hover, so there a
// hero plays while it is mostly on screen, unless the visitor asked for reduced motion.
(function () {
  var heroes = document.querySelectorAll(".hero-anim[data-motion]");
  if (!heroes.length) return;
  var canHover = matchMedia("(hover: hover)").matches;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function control(el) {
    var motion = null;
    var wanted = false;
    function make() {
      var src = el.dataset.motion;
      if (/\.mp4$/.test(src)) {
        motion = document.createElement("video");
        motion.muted = true; motion.loop = true; motion.playsInline = true; motion.preload = "auto";
        motion.setAttribute("muted", ""); motion.setAttribute("playsinline", "");
        motion.addEventListener("playing", function () { if (wanted) el.classList.add("playing"); });
      } else {
        motion = document.createElement("img");
        motion.alt = "";
        motion.decoding = "async";
        motion.addEventListener("load", function () { if (wanted) el.classList.add("playing"); });
      }
      motion.className = "hero-motion";
      motion.setAttribute("aria-hidden", "true");
      motion.src = src;
      el.appendChild(motion);
    }
    return {
      preload: function () { if (!motion) make(); },
      play: function () {
        wanted = true;
        if (!motion) make();
        if (motion.tagName === "VIDEO") { var p = motion.play(); if (p && p.catch) p.catch(function () {}); }
        else if (motion.complete) el.classList.add("playing");
      },
      stop: function () {
        wanted = false;
        el.classList.remove("playing");
        if (motion && motion.tagName === "VIDEO") { motion.pause(); motion.currentTime = 0; }
      },
    };
  }

  var seen = canHover || reduced || !("IntersectionObserver" in window) ? null :
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.__hero[e.isIntersecting ? "play" : "stop"](); });
    }, { threshold: 0.6 });

  var controls = [];
  heroes.forEach(function (el) {
    var c = control(el);
    controls.push(c);
    if (canHover) {
      var area = el.closest(".panel, .posts > li") || el;
      area.addEventListener("pointerenter", c.play);
      area.addEventListener("pointerleave", c.stop);
      area.addEventListener("focusin", c.play);
      area.addEventListener("focusout", function (e) { if (!area.contains(e.relatedTarget)) c.stop(); });
    } else if (seen) {
      el.__hero = c;
      seen.observe(el);
    }
  });

  // Background preload, after the page's own load and an idle moment, so nothing competes with text.
  var net = navigator.connection || {};
  if (net.saveData || /(^|-)(2g|3g)$/.test(net.effectiveType || "")) return;
  function preloadAll() {
    var idle = window.requestIdleCallback || function (f) { setTimeout(f, 200); };
    idle(function () { controls.forEach(function (c) { c.preload(); }); }, { timeout: 3000 });
  }
  if (document.readyState === "complete") preloadAll();
  else addEventListener("load", preloadAll, { once: true });
})();
