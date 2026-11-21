// Project mosaic (_includes/panels.njk): the grid has 4px rows and each card spans as many as its
// height needs, so the next card lands in the first free spot under the shortest column. Order stays
// left to right. Without this script the cards still show, as a plain grid.
(function () {
  var rowPx = 4;
  function pack() {
    document.querySelectorAll(".mosaic").forEach(function (m) {
      var grid = getComputedStyle(m).display === "grid";
      var gap = parseFloat(getComputedStyle(m).columnGap) || 16;
      m.querySelectorAll(":scope > .panel").forEach(function (c) {
        c.style.gridRowEnd = grid ? "span " + Math.ceil((c.getBoundingClientRect().height + gap) / rowPx) : "";
      });
      m.classList.toggle("packed", grid);
    });
  }
  pack();
  addEventListener("resize", pack);
  addEventListener("load", pack);
  if (document.fonts) document.fonts.ready.then(pack);
})();
