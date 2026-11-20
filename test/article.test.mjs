import { test } from "node:test";
import assert from "node:assert/strict";
import markdownIt from "markdown-it";
import { markdownCallouts, tocFrom } from "../lib/article.mjs";

const md = markdownIt({ html: true }).use(markdownCallouts);

test("an Obsidian callout becomes a titled box with its body", () => {
  const html = md.render("> [!note] Why *this*?\n> First line.\n>\n> **Second.**\n");
  assert.match(html, /^<div class="callout callout-note">\n<p class="callout-title">Why <em>this<\/em>\?<\/p>\n<p>First line.<\/p>\n<p><strong>Second.<\/strong><\/p>\n<\/div>/);
});

test("a callout with no title is named after its type; a title-only callout has no empty body", () => {
  assert.equal(md.render("> [!tip]\n"), '<div class="callout callout-tip">\n<p class="callout-title">Tip</p>\n</div>\n');
});

test("folding callouts use details, open with +", () => {
  assert.match(md.render("> [!warning]- Careful\n> body\n"), /^<details class="callout callout-warning">\n<summary class="callout-title">Careful<\/summary>\n<p>body<\/p>\n<\/details>/);
  assert.match(md.render("> [!faq]+ Q\n> A\n"), /^<details class="callout callout-faq" open="">/);
});

test("plain blockquotes stay blockquotes", () => {
  assert.match(md.render("> just a quote\n"), /^<blockquote>/);
});

test("the table of contents is an outline of three levels, counted from the first", () => {
  const html = '<h2 id="a"><a class="anchor" href="#a" aria-hidden="true">#</a>A &amp; B</h2><h3 id="b">B <em>x</em></h3><h4 id="c">C</h4><h5 id="d">D</h5><h2 id="e">E</h2>';
  assert.deepEqual(tocFrom(html), [
    { id: "a", text: "A & B", children: [{ id: "b", text: "B x", children: [{ id: "c", text: "C", children: [] }] }] },
    { id: "e", text: "E", children: [] },
  ]);
  assert.deepEqual(tocFrom("<p>none</p>"), []);
});
