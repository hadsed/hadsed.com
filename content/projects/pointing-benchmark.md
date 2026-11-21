---
title: Pointing benchmark
status: active
summary: How precisely vision models find the same surface point on a 3D part when the camera moves.
started: 2026-07
order: 4
hero_image: "[[home-from-an-address/plan/pointing-grease-nipple-all.png]]"
hero_image_alt: A point marked on a hex fitting, the same bench from a second camera, and where each model put the point
---
A lot of useful geometry starts from a point. Homographies, PnP, bundle adjustment, measuring a part, aiming a gripper: each takes pixel coordinates and does exact math from there. If a vision model is going to sit at the front of that pipeline, it has to put a point where it means to, and it has to find the same physical point again after the camera moves.

This benchmark measures that one skill. The model sees a CAD part with a marker on its surface, then a second image of the same part from another camera, and has to say where the marked point is now. No language, no object names, just geometry.

# The task

Parts come from BenchCAD's CAD programs, rendered in Blender. Each object family counts as one independent unit, and families never straddle the development and test halves. The target is a point inside a face. An earlier version used corners and hole centers, which turned out to be too easy.

Every target is asked under four matched conditions:

| Condition | What changes | Scored by |
|---|---|---|
| Same image | Nothing. Copy the marker's position | Pixels |
| Rolled camera | Camera rolled 20°, moved closer, shifted. No new 3D information | Pixels |
| Small view change | Camera orbits 20° (single parts) or 25 to 40° (bench) | Surface distance |
| Large view change | 60° (single parts) or 50 to 80° (bench) | Surface distance |

There are two datasets. The first is single parts on a plain background. The second puts each part on a workbench with two to four other parts dropped and settled by a physics simulation, plus a board, a wrench and the bench itself to land on by mistake.

# Scoring

Pixel distance stops meaning much once the camera moves. Five pixels can be a millimeter on a face seen head-on or the whole face seen edge-on. So for view changes the answer is cast as a ray into the scene, and the score is the distance along the part's surface from where it hits to the true point, divided by the part's surface diameter. Missing the part, answering off the image, or giving no parseable answer scores 1.

The tolerance comes from people, not from model results: one click per part at the edge of "still the same point" gives a radius of 2.4% of the part's diameter. Inside that is precise. Beyond it, answers are graded by distance bands within the right face region, then wrong region, then off the part. Symmetric parts, where a mirrored answer would look right, are flagged.

# Results so far

These are development numbers from September 2026, one model call per answer, no tools.

**Copying is solved, moving the camera is not.** Every closed model copies a marker to within a few pixels. On the workbench test half (family-balanced mean loss, lower is better):

| Model | Same image | Rolled camera | Small view | Large view |
|---|---|---|---|---|
| Claude Fable 5 | 0.0025 | 0.018 | **0.116** | 0.233 |
| Gemini Robotics-ER 2 | 0.0012 | 0.019 | 0.135 | **0.208** |
| GPT-5.6 Sol | 0.0015 | 0.027 | 0.223 | 0.258 |
| Gemini 3.1 Pro | 0.0020 | 0.028 | 0.219 | 0.298 |
| Claude Opus 5 | 0.0032 | 0.022 | 0.242 | 0.297 |
| Gemma 4 31B | 0.0048 | 0.041 | 0.284 | 0.358 |
| Qwen3-VL 235B | 0.011 | 0.067 | 0.389 | 0.358 |
| MolmoPoint 8B | 0.0033 | 0.399 | 0.648 | 0.663 |

A few things stand out. The rolled camera adds no 3D information at all, yet it already separates the field. Two models, one of them trained specifically for robot pointing, are well ahead once the view really changes. On the bench, 5 to 15% of answers land on the bench, the board or the wrench instead of the part. MolmoPoint, a dedicated pointing model, often answers with the marker's position from the first image.

**With code, the best models get sub-pixel.** Give a model a coding agent (Codex, Claude Code or pi) and both images, and the picture changes. On a ten-question development set, GPT-6 Astra at low effort in Codex was precise on 10 of 10 with a median error of 0.67 px, at $0.37 a question.

The winning recipe on flat parts is plain computer vision: read the four corners of the marked face off each image, fit a homography, map the marker through it. On curved parts like a pipe elbow, the strongest runs fit a parametric 3D model to both silhouettes, project the marker onto it and reproject. What separates models is mostly reliability. Across 96 runs, every run that read its worst corner within 3 px was precise; beyond 8 px, fewer than half were. With the images withheld, Astra still got 9 of 10 by finding the corners with SIFT and contour fits.

Newer models make the agent route cheap. Claude Opus 5.5 in Claude Code was precise on 10 of 10 at about $0.32 a question, where Opus 5 needed $5.33 for the same score. GPT-6 Sol in Codex got 9 of 10 at $0.18. Ten questions can't rank these against each other on accuracy, but the drop in cost is real.

# Where it's used

This is why GPT-6 Astra writes the fixes in [[home-from-an-address#Architecture|the 3D home reconstruction]]: on this benchmark it was the most precise model at marking the same point from another angle, and that is most of what checking a 3D model against a photo comes down to. See [[address-to-3d-home]] for that project.

# Next

- Hand cheaper models the steps they fail at as tools: a corner detector with sub-pixel refinement, zoomed crops they can actually look at, and a ready silhouette-to-3D fit for curved parts.
- Run the shortlisted agent systems on the sealed test half.
- Move from rendered parts to real photos, where textures and lighting stop being clean.
