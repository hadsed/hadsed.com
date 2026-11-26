---
title: Point tracking as a proxy for spatial intelligence
status: drafting
date: 2026-11-24
slug: draft-vlm-pointing-benchmark
summary: Draft preview
---
![[pointing-hero.gif]]

Vision-language models (VLMs) are excellent at basic computer vision tasks like captioning images, detecting objects, reading charts, and many more.

But they are not yet fully "spatially intelligent". While they seem to understand the 3D nature of a scene from an image, they aren't able to fully reconstruct that scene in order to execute some task. For instance, VLMs cannot create a digital twin of a scene, or flawlessly control a robot without bumping into objects.

I wanted to find the most basic required capability to test how much VLMs understood about the 3D nature of objects and scenes. I argue **point correspondence** is a good proxy task.

Many studies like [CroPond](https://www.alphaxiv.org/abs/2512.04686) and [MolmoPoint](https://www.alphaxiv.org/abs/2603.28069) demonstrate that VLMs can implement semantic pointing, i.e., given an intent they can identify and point to objects in question and reason about them.

But there are many applications where the intent is complex, the objects are hard to describe, and the precision required from pointing is very high. For instance, the ability to identify a particular part within a drone assembly can be critical to setting up a physics simulation correctly. Camera pose-tracking in a video similarly relies on identifying high-quality keypoints for good results.

< show an image or diagram of a soccer goal in a video clip that needs reconstruction requiring camera pose estimation >
![[Pasted image 20261123173359.png]]
In this article I'll describe a benchmark for point tracking using simple mechanical parts in two different scenes and report costs and performance on open- and closed-source VLMs in a single-shot scenario as well as in a coding harness.
# Experimental setup
For benchmarking VLM pointing capability, I chose a set of parts from [BenchCAD](https://benchcad.com/) and setup a few tasks that rely on painting a surface point in one view of the object and asking the VLM to recover the surface point given a different view that is unmarked.
![[CleanShot 2026-11-23 at 17.54.25@2x.png]]
This can be a little too hard of a task. Many mechanical parts have symmetries or smooth surfaces that can be hard even for humans to track. It's also not clear from a visual standpoint if a part rotated somehow or the camera did. To suss out those confounders I also tested on a workbench scene where parts sit on a table and shadows, bench features, and other parts give helpful landmarks to suggest a simple perspective shift in a static scene.
![[home-from-an-address/plan/pointing-grease-nipple-all.png|Pointing benchmark example]]
# Losses and error
![[CleanShot 2026-11-23 at 17.55.03@2x.png]]

> Claude: LaTeX of the three losses from the lab page (source: `benchmarks/point_correspond/lab/home.html` on the vision-agents branch `claude/fable-handoff-simplify-6b38a3`). Symbol lists copied from the lab page; edit or drop.

**Pixel loss** (conditions that stay in the image plane)

$$
\ell_{\text{px}} = \min\!\left(1,\ \frac{\lVert \hat{u} - u^{*} \rVert}{\sqrt{W^{2} + H^{2}}}\right)
$$

- $\hat{u}$: the pixel the system answered
- $u^{*}$: the marked point's pixel in the same image
- $W, H$: the image size, 512 × 512 here, so the divisor is the diagonal

**Surface loss** (conditions where the camera moves)

$$
\ell_{\text{surf}} = \min\!\left(1,\ \frac{g}{G}\right)
$$

- $g$: the geodesic distance across the part's surface, from where the answer's ray lands to the true point
- $G$: the part's geodesic diameter, the longest such distance anywhere on it

**Total loss** (the number in every cell)

$$
L = \operatorname*{mean}_{f \in F}\ \operatorname*{mean}_{a \in A_f}\ \ell(a)
$$

- $F$: the part families in the condition, the unit of independence
- $A_f$: the answers given on family $f$
- $\ell$: the pixel or surface loss, depending on the condition

**Grading classes**, with $d = \lVert \hat{u} - u^{*} \rVert$ in the answered image and $r = 6.7$ px:

$$
\text{class}(d) =
\begin{cases}
\text{precise} & d \le r \\
\text{near} & r < d \le 2r \\
\text{mid} & 2r < d \le 3r \\
\text{wrong place} & d > 3r \text{ (on the right object)} \\
\text{off the part} & \text{the ray meets no part of the object} \\
\text{wrong object} & \text{the ray lands on another object in the scene}
\end{cases}
$$
![[CleanShot 2026-11-23 at 17.55.35@2x.png]]
reproduce in latex and as nice diagrams (altho those are pretty nice they just need formatting for here. taken from https://hadsed--point-correspond-v2-lab-lab.modal.run/. you should look up in vision-agents repo where it comes from since it'll help with some other stuff too more efficiently)

![[pointing-grading-classes.png]]
> Claude: grading-class diagram built from the study's own answers, styled for the site. One real answer per class, classes by the r = 6.7 px rule above.

# Results
## Qualitative understanding
I've put a small explorer here to review individual samples easily. It's helpful to flip through this before trying to look at the aggregate results.
![[CleanShot 2026-11-23 at 17.57.12@2x.png]]
i like this thing from the existing site, wondering if we can embed along with a single-shot vs harness switcher, and a single-part vs workbench switcher. all precomputed of course

![[pointing-figures/widgets.js|explorer]]
> Claude: Obsidian does not render the interactive figures (the `widgets.js` embeds), so each one has a static PNG preview under it. The site renders them in the page itself; drop the `preview-*.png` lines when publishing. The hero GIF is now the body's first line, which the site uses as the hero.
> Claude: explorer embed. Switches: single-shot (test half) or harness (mini dev set), single part or workbench. Arrow keys step through answers; click an image for the full-size pair.
## Single-shot single-part
![[CleanShot 2026-11-23 at 18.02.11@2x.png]]
it would be cool to replicate this table, though have ability to toggle between pix and surf losses so there's only one number to look at (mean)

then clicking into any cell highlights that cell while popping open a little drawer/row 2.5 rows worth right underneath with a scrollable grid. clicking any of those grid images does a modal where they can see it in full. just like that site.

![[pointing-figures/widgets.js|results-single-part]]
> Claude: test half, pixel/surface switch at the top.
## Single-shot workbench scene
same as above

![[pointing-figures/widgets.js|results-workbench]]

## Harness workbench scene
same as above

![[pointing-figures/widgets.js|results-harness-workbench]]
> Claude: harness runs exist only for the mini dev set: five workbench questions, Small view change, one answer each. Rows sorted by loss, with precise count, mean $ per question and median time. The plan 41 runs (Opus 5.5, GPT-6 Sol, pi) are not in the lab index, so they are not here.

# Discussion
