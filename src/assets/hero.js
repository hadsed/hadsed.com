// Animated heroes (lib/hero.mjs): the page paints a still first frame; the motion (an MP4) loads once
// the page has loaded and gone idle, then plays on screen ("auto") or on hover ("hover"), see below.
(function () {
  var heroes = document.querySelectorAll(".hero-anim[data-motion]");
  if (!heroes.length) return;
  var canHover = matchMedia("(hover: hover)").matches;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Some browsers refuse muted autoplay (Safari in Low Power Mode, some battery savers). Then the
  // first tap, click, key or scroll on the page counts as a gesture, and every refused hero retries.
  var refused = [];
  function blocked() {
    if (!refused.length) ["pointerdown", "keydown", "touchstart", "wheel"].forEach(function (t) {
      addEventListener(t, retry, { once: true, passive: true });
    });
    refused.push(this);
  }
  function retry() {
    var list = refused; refused = [];
    list.forEach(function (c) { if (c.wanted()) c.play(); });
  }

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
    var api = {
      wanted: function () { return wanted; },
      preload: function () { if (!motion) make(); },
      play: function () {
        wanted = true;
        if (!motion) make();
        if (motion.tagName === "VIDEO") { var p = motion.play(); if (p && p.catch) p.catch(blocked.bind(api)); }
        else if (motion.complete) el.classList.add("playing");
      },
      stop: function () {
        wanted = false;
        el.classList.remove("playing");
        if (motion && motion.tagName === "VIDEO") { motion.pause(); motion.currentTime = 0; }
      },
    };
    return api;
  }

  // One switch (heroMotion in eleventy.config.js, on <html data-hero-motion>): "auto" plays every
  // hero while it is on screen; "hover" keeps the still until the card or image is hovered.
  // Either way the still paints first and the motion loads after the page is idle. Reduced motion
  // and Save-Data never autoplay; there, hovering still plays. (Chrome's effectiveType is not used:
  // it reports "3g" on ordinary Wi-Fi with a slow moment, which turned autoplay off for real visitors.)
  var net = navigator.connection || {};
  var light = !!net.saveData;
  var auto = document.documentElement.dataset.heroMotion !== "hover" && !reduced && !light;
  var onScreen = !("IntersectionObserver" in window) ? null :
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.__hero[e.isIntersecting ? "play" : "stop"](); });
    }, { threshold: auto ? 0.25 : 0.6 });

  var controls = [];
  heroes.forEach(function (el) {
    var c = control(el);
    controls.push(c);
    el.__hero = c;
    if (canHover && !auto) {
      // Hover anywhere on the card (or the image itself, on its own page) plays it.
      var area = el.closest("[data-hero-area], .panel, .posts > li") || el;
      area.addEventListener("pointerenter", c.play);
      area.addEventListener("pointerleave", c.stop);
      area.addEventListener("focusin", c.play);
      area.addEventListener("focusout", function (e) { if (!area.contains(e.relatedTarget)) c.stop(); });
    }
  });

  if (light) return;
  function start() {
    var idle = window.requestIdleCallback || function (f) { setTimeout(f, 200); };
    idle(function () {
      controls.forEach(function (c) { c.preload(); });
      // Autoplay (or, on touch screens in hover mode, play while mostly on screen).
      if (onScreen && (auto || (!canHover && !reduced))) heroes.forEach(function (el) { onScreen.observe(el); });
    }, { timeout: 3000 });
  }
  if (document.readyState === "complete") start();
  else addEventListener("load", start, { once: true });
})();
