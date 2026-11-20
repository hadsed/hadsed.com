---
title: A house from its address
date: 2026-11-20
slug: home-from-an-address
summary: Rebuilding a real San Francisco house in editable 3D from public data, with agents doing the work and fixed code doing the judging.
---
![[home-from-an-address/address-to-3d-home-2x-crop.gif|600]]

I recently worked with a company which ran marketing and sales for remodeling contractors. The main entity of business is a home remodeling project.

There are lots of ways to understand a remodeling project, but probably the most fun way is to start with a digital replica of the home. And it’s more than just cool--it’s the highest-resolution language to communicate details of the project. What does the homeowner envision? What can the contractor build? Which details contribute to higher costs or longer timelines? The central product capability is an editable model to support the planning, visualization, and cost calculation of different options in a remodeling project.

You just need a few things to create an editable digital replica of a home:
- An address
- An advanced coding agent (GPT-6 Astra or similar)
- Compute ($50-200 for partial runs, an estimated $1-2.5k+ for a full attempt)
- Some AI and ML know-how

Most 3D scene reconstruction demos of homes, streets, and cities show feasibility in some sense but don't give clarity on the methodology and costs. I'll show you a design for one use-case and use it to help gauge costs. I do one run to show what the design can lead to "out-of-the-box", and a second run which optimizes a few things from the first. It shows a glimmer of how a specialized design, harness features, and ML models can help drive down time and cost, while also giving some intuition on where we're bottlenecked by VLLM capabilities. This isn't a scientific study, just some practical field notes to give some intuition around technical feasibility and cost structure.

3D reconstruction is a mature field with many limitations. Scanning apps that rely on LiDAR create a mesh that still needs structuring. Photogrammetry, NeRF, and Gaussian splats create a nice visual scene but are not structured 3D models that can easily be edited. Some apps go from floor plans to 3D models, but those are wall extrusions and need extra work for objects. And in general, computer vision models and algorithms provide a great toolbox but models don't generalize well. Modern coding agents using strong vision-augmented LLMs bring their own vision capabilities in addition to being able to leverage all past work, making them a strong contender for a general-purpose 3D reconstruction method based on photos alone.
# Experimental setup
I ran the agent twice on the address of a San Francisco house I used to live in. The house was put up for sale a couple years ago so a lot of the necessary data was available online. All data used here is publicly available.

It is worth noting that AI doing new things with public data may create new legitimate privacy issues, so do exercise caution if you plan to leverage this work. My best advice is to put yourself in the shoes of homeowners and ask how your application may impact them in the immediate term as well as in the long run.

The first run was to develop the methodology against an architecture I had in mind (see the Architecture section). For each of the tasks and subagents I tested different methods to review their performance manually, and to try and quantify errors to come up with good task objectives. Once the methods were nailed down I did a full run which took 9.5 hours and a $200 budget cap.

The second run was to distill the lessons from the first run into reusable skills to see if I could reproduce similar results with less cost in less time. This run had a $100 budget cap and took 2 hours, though it did not do the same amount of work (about half of the first run's work, in fact).

Both runs executed in a Claude Code harness modified with skills and an execution plan for stages and tasks.

This visual shows the difference in work between the two:

![[home-from-an-address/results/house-compare.svg|Results in 3D by run]]

Much of the shell of the house was mapped out in both runs, but the second run only focused on the main floor.

See the Costs section for how the work and budget break down further. We don't have ground-truth data since this is a real home. I show performance measures in specific contexts to help with comparing runtime costs, but the ultimate performance measure is 3D model fidelity as judged through photos by a human (me, and I suppose you).
# Data
It's useful to just look at inputs and outputs as a start. We'll see how cross-referencing can help the model triangulate sizes, measurements, positions, etc. in the tasks sections.
## Input
The following data was all found in the Research phase (see Architecture).

| Input                 | Example                                     | What it tells us                                                  | 653 Arkansas has                                           |
| --------------------- | ------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| **Floor plans**       | ![[home-from-an-address/plan/input-A.svg]] | Rooms, walls, doors, windows, dimensions, per level               | 3-level dimensioned plan, site plan, assessor map          |
| **Interior photos**   | ![[home-from-an-address/plan/input-B.svg]] | What each room looks like: cabinets, finishes, ceiling heights    | ~100 listing photos covering every main room               |
| **Exterior photos**   | ![[home-from-an-address/plan/input-C.svg]] | Facades, front steps, decks, yard                                 | Street View (15 dates), listing exteriors, yard/deck shots |
| **Aerial photos**     | ![[home-from-an-address/plan/input-D.svg]] | Roof shape, rear and sides, yard layout                           | Satellite, 8 obliques, 9 drone                             |
| **Measured geometry** | ![[home-from-an-address/plan/input-E.svg]] | True outline and height in meters                                 | City footprint polygon, LiDAR (USGS 3DEP, 2023)            |
| **Records**           | ![[home-from-an-address/plan/input-F.svg]] | Size, beds/baths, year built, past remodels, listing descriptions | Assessor, permits, 2025 and 2006 listings                  |

## Outputs
### Site tree
```
Site: 653 Arkansas St
├── Level: Lower
│   ├── Space: Garage
│   ├── Space: In-law kitchen
│   └── ...
├── Level: Main
│   ├── Space: Kitchen
│   │   ├── Object: Island
│   │   └── Object: Upper cabinets (east wall)
│   ├── Space: Living room
│   └── Space: Rear main deck
├── Level: Upper
├── Roof
└── Outside: Rear yard
    ├── Space: Lower patio
    └── Space: Lawn
```
The index of the home. Every place in the home is a node, and photos and plans link to these nodes.

Spaces are the backbone where we can associate photos, parts of floor plans, and 3D reconstructions. Doors, openings and stairs are links between two spaces so they don't have nodes,
### Site model

![[home-from-an-address/cleanshot-2026-11-10-at-12-02-29-2x.png|The site model]]

A coarse 3D model of the home. It has the shell, floor slabs at the right heights, walls, doors, windows, and roof. Each of these gets its own node in the tree
### Scene models & photo cameras

![[home-from-an-address/pasted-image-20261109112514.png|The kitchen scene: a point cloud and estimated photo-camera positions. The red landmark appears in all four photos.]]

Every space with enough photos will have scenes like the above. The scenes consist of camera objects and colored points in a point cloud, and they can cover several spaces. For instance, kitchen and dining room are one scene in this case.
### Object models

![[home-from-an-address/pasted-image-20261109145133.png|Editable object models for the kitchen, shown as separate cabinet runs and appliances.]]

We'll need 3D models of all of the objects in the scene. They'll be positioned and posed using the other scene data for structure and photos for evaluation of correctness.

On a technical note: they don't have to be meshes. In the above they're actually parametric code. This enables fine-grained editability useful for modeling different choices in a remodeling project.
# Architecture

![[home-from-an-address/plan/architecture-stacked-2.png|Architecture: Research, Build and Refine, stacked]]

This task graph is orchestrated by an intelligent model in a coding harness (Claude Opus 5.5). There are three phases of work:
- **Research:** find all of the input data from the internet
- **Build:** create an initial set of output data using task-specific subagents
- **Refinement:** use the smartest vision agent to find and correct errors

In the Research stage we simply instruct the orchestrator (Opus in Claude Code) to execute a fairly standard deep research run on the internet to find as much of the input data as possible.

In the Build stage, each task has one or more error metrics to optimize against. Implementation is done by a subagent, and verification by another subagent. Tasks get up to 5 iterations until the orchestrator moves downstream in the task graph.

The Refinement stage deploys Astra and Fable for finding errors, the orchestrator (Opus) for planning fixes, and Astra again for implementing fixes.

The orchestrator has an interesting role that can be quite involved in each phase:
- It does the full research job
- It monitors task subagents to see if error is declining after each iteration, stopping early if it looks to be flat-lining
- Coming up with a plan based on error analysis in refinement to give the implementation subagent

The orchestrator is the connective tissue across all phases and subagents. I think of the orchestrator as a really great player-coach manager--it can do each job itself at a mediocre level, but the subagents are much better at it. The orchestrator can then synthesize findings, make decisions, and in general keep the team moving towards its goals.

It may seem like the orchestrator is overextended, but the beauty of this approach is that it's extremely flexible and able to learn continuously. With the help of the right data structures and target outputs, it can notice issues anywhere in the system and both correct the output data as well as improve the system itself.

> [!note] Why Astra over Fable?
> Understanding the spatial intelligence of various models is challenging. I created a benchmark that judged how well a model could mark the same surface point on a 3D object from a different angle. Astra was the most precise model. Since I haven't written up that benchmark yet, I'll just provide a preview of what it looks like:
> ![[home-from-an-address/plan/pointing-example-grease-nipple-2.png|Pointing benchmark example]]

# Design principles
## Task decomposition & refinement
"Reconstruct this home in 3D" is a tall order. Task decomposition breaks it down into a series of more manageable tasks.

The output data gives a few hints for how this helps. It's easy to build the shell of the home if you don't have to think about floor plans or objects. And it's easier to first build the 3D scene for a room without thinking about the objects in it, or about other rooms.

Decomposition lets us turn a very hard problem that has never been solved into small problems that have already been solved by ML and computer vision, sometimes decades ago (e.g., RANSAC plane fitting, closed-form similarity fit, DINO, SAM, and Pi3X).

Decomposition is cheap in time and money, and works most of the time. But the world is not perfectly decomposable. Sometimes you need to treat the full thing holistically. For examples of what refinement can detect that a single task objective would miss, see _What it caught_ in _Refinement_.
## Site decomposition
Task decomposition organizes the capabilities we need from the agent. We'll want to do the same thing with the data.

Fundamentally the home is a collection of rooms, doors, spaces (indoor and out), and more. We saw the site tree before:
```
Site: 653 Arkansas St
├── Level: Lower
│   ├── Space: Garage
│   ├── Space: In-law kitchen
│   └── ...
├── Level: ...
```
This is the result of **decomposing the site** into a data structure we can share across tasks. As we'll see later, having the site tree shared across tasks means it can start simple and grow as needed. It can also start imperfectly, becoming more accurate across tasks and iterations.
## Verifiable goals
Once we have small targeted tasks we can use the raw data to come up with verifiable goals.

The keyword is verifiable. A computer needs a comparison function to compute how big of an error its made. For instance, if the floor plan derived from the 3D model does not match the actual floor plans, we’ll want to know which parts and by how much.

![[home-from-an-address/pasted-image-20261109152003.png]]

Similarly, if a photo taken in the 3D model doesn’t match a real photo from the same angle, we’ll want good ways to quantify those mistakes.

![[home-from-an-address/pasted-image-20261109153212.png]]

## Continual learning
In theory we could skip the Build phase and fully rely on Refinement. This is fine to start, but obviously we incur significantly more costs this way.

If we take a continual learning view, we might push our evaluations and learnings from the Refine stage to the Build phase over some number of full agent runs. In this study I only execute two runs, but even there we can see glimmers of this working (the initial run takes 9.5 hours, but the second run is only 2 hours). The optimization for run 2 was done by an agent. In a loop, you might call this a **self-improving harness**.

There's another aspect of continual learning. In the Refine section we discuss a number of errors as well as the score. The scores are continuously updated to capture things the scorers miss but are detected through other means like visual inspection. I like to call this a **self-improving evaluation**.
# Build
## Outer shell

![[home-from-an-address/tasks/01-overview.svg|Building the shell from measured geometry and aerial photos.]]

Thanks to Google Maps and other services there are almost always satellite images available. Aerial drone photos are also common if a home was recently on the market. The USGS 3DEP project provides LIDAR data which gives us a point cloud of the outer surface of the home, generally just the top. With this it’s fairly straightforward to create the “shell” of a home by fitting planes to the surface data.

![[home-from-an-address/results/01-build-shell/sections.png|Three shell models over LiDAR cross-sections.]]

Useful error measures:
- The intersection-over-union of the city's lot footprint outline
- Absolute distance error of top surfaces (roofs) given by LiDAR
## Site tree construction

![[home-from-an-address/tasks/02-overview.svg|Reading the floor plan into rooms and a site tree.]]

In this step we take any available floor plans and use them for site decomposition. The output is called a **Site Tree**.

Coding agents are now quite capable of drawing polygons to approximate shapes. Then simple error measures like intersection-over-union and a simple difference in polygon area (room size) work well as a task objective. A combination of more granular measures (like wall distance) or visual context to determine general topology can be useful for an agent to iterate towards an optimized solution.

Error measures used in the run (target → result):
- Room size vs the printed dimensions, median / max: ≤ 1 / ≤ 2 in → 0.89 / 8.66 in
- Topology failures (overlaps, unlabeled regions, unpaired stairs): 0 → 0
- Room IoU against the vector PDF (report only; the agent never saw the PDF): mean 0.936, min 0.838
- Wall F1 within 3 in of the PDF walls (report only): 0.93

> [!note] The benefits of shared data structures
> Some details were not captured correctly on this floor plan, like doors and windows. They were discovered later when looking at photos for a reconstruction task. The site tree continuously improves across tasks and iterations.
> 
> **The lesson:** it helps to be flexible about where information comes from when doing task decomposition. The agent will notice discrepancies between raw data and our data structures like the site tree regardless of task. Making the site tree shared allows these mistakes be corrected.

## Floor plan into shell

![[home-from-an-address/tasks/03-overview.svg|Fitting floor plans and floor heights into the shell.]]

Once floor plans are determined we need to orient them within the shell of the home. This task boils down to placing each floor plan with position, rotation, scale, and floor height correct.

LiDAR and satellite data can be helpful to tie parts of the floor plan with things like decks, patios, yards, and garages that we can observe from the outside.

Useful error metrics in this task:
- Overlap of floor plan with lot outline for each level (intersection-over-union)
- Floor height error (multiple sources for ground-truth, e.g., LiDAR for decks, stair counting, door heights, stair misalignment between levels)
- Living area (sum from floor plans and compare with listed square-footage online)
## Photo assignment

![[home-from-an-address/tasks/04-overview.svg|Assigning listing photos to spaces.]]

Once we have spaces mapped out, we can assign photos to them. This boils down to a pretty easy classification problem which modern vision AIs are very good at.

Classification tags photos to spaces, shows what other spaces are visible, and determines what direction the camera faces.

Useful error measures:
- Space adjacency rules: if a neighboring room is seen in a photo, it must be adjacent in the floor plan
## Photos to 3D scenes

![[home-from-an-address/tasks/05-overview.svg|Reconstructing a point cloud and cameras from kitchen photos.]]

As we explained in the 3D scene models section earlier, we can reverse engineer each photo to create a camera and a colored point cloud. The key idea is to think about stereo vs monocular vision: the fact that you have two eyes from slightly different positions allows for 3D reasoning.

Similarly, we can cross-reference the same point from different photos and match points from their point clouds to create the final scene data.

For this task it was useful to have multiple ML models and computer vision algorithms to come up with point clouds and depth maps. Specifically:
- Select a group of photos that overlap in the space
- Produce an initial guess on camera position, orientation, settings, and a depth map using Pi3X
- Find matching points across different photos with RoMa v2, setting aside 20% for a later validation
- Improve camera poses and positions of the matching point details using bundle adjustment. Project points back to the photos to measure distance between those matching points.
- Use the held-out 20% of points as validation

Useful error measures for this task:
- **Pose agreement:** two models place cameras, how much do their camera directions (degrees) and positions (by % of scene size) agree?
- **Bounding drift:** some number of matching points are held out (not used in matching) until the scene is finished being built. Then the points are projected back into the photos to measure the pixel distance from their initial positions.
## Space to site alignment

![[home-from-an-address/tasks/06-overview.svg|Aligning the point cloud to the floor plan.]]

Once the 3D scene for a space is constructed we can position it within the site using the floor plans.

The method uses an agent to select corresponding points between the floor plan and the point cloud. Then it does a 2D similarity fit (Umeyama's algorithm), which can resize, rotate, and translate the point cloud to minimize the objective (RMS).
## Object modeling

![[home-from-an-address/tasks/07-overview.svg|Building editable object models from photo crops.]]

There are loads of great methods for generating object meshes, but the product goal is an editable space for remodeling for which a parametric construction works better. Agents are plenty good at constructing simple polygonal shapes which works well for cabinets and appliances.

The following criteria were used to construct cabinets and appliances:
- Standard cabinet sizes (width, height, depth)
- Edge match error with photos
- Existence of doors and drawers
- Lengths from floor plans (if available)
- Editability tested by changing the model's parameters and observing the change
## Object placement

![[home-from-an-address/tasks/08-overview.svg|Placing object models in the kitchen scene.]]

Placing the object models was done by an agent using a few criteria:
- Object boundary overlap (intersection-over-union) between 3D model and photos. Object masks in photos were obtained using GroundingDINO and SAM 2.1
- Distance from camera by comparing 3D model distance with depth maps from Photo-to-3D
- Rules for basic physics, like cabinet support from below and against the wall, no intersections, etc. Code to snap objects to walls and floors or other objects helped reduce ~90% of errors.

Here is how the overlap is measured on one kitchen photo:

![[home-from-an-address/results/08-place-objects/place-explainer-2.png|Comparing photo masks with rendered object masks.]]

1. GroundingDINO identifies objects in the listing photo using short text prompts like "kitchen cabinet" and "range hood"
2. SAM 2.1 creates a mask from each object's bounding box
3. The 3D model is rendered through the same camera as the photo. Each object is colored the same as its corresponding photo mask
4. Measure the IoU (intersection-over-union) and color intersections in blue and differences in orange and pink. IoU is then just blue / (blue + orange + pink)

In the above there are 15 objects and the mean object IoU is 0.53. It's worth noting that the average is across object, so even though blue is the dominant color beyond ~50%, smaller objects bring down the average. The distribution of IoU across objects is informative.

![[home-from-an-address/pasted-image-20261117182325.png|Per-object overlap scores in one kitchen photo.]]

## Outer facade

![[home-from-an-address/tasks/09-overview.svg|Adding facade openings from photos.]]

The outer facade details were input by an agent using the following criteria:
- Ensuring doors and windows match the floor plans
- Approximating Street View cameras and matching windows and doors from those photos (intersection-over-union using agent-drawn boxes)
- Adjusting deck height using LiDAR
# Refine
Once all task iterations are exhausted it's time for holistic refinement. This is a natural point where the output data is considered together to find errors.
## Refinement loop

![[home-from-an-address/tasks/10-render-vs-photo.svg|Render vs photo: model edges over a listing photo]]

The refinement loop is as follows:
1. **Generate artifacts for review.** The 3D model is rendered from the photo camera views and overlayed on top of the photos (see above diagram). Other checks, like room counting or shell structure overlaps, are done and a score is computed.
2. **Review.** Astra and Fable separately review the artifacts and list their findings.
3. **Plan.** The orchestrator (Opus) deduplicates and drops unimportant findings before writing up to 8 fixes, attaching the evidence for each
4. **Fix.** Astra writes a script for each finding. Importantly, each fix is independently applicable so we can do ablations. Astra can decide against implementing any fix if it doesn't agree with the evidence backing the plan.
5. **Acceptance (deterministic).** The "fixed" 3D model is accepted if the score doesn't drop, hard failures don't increase, and there are no regressions on tests.
6. **Find culprits (deterministic).** The fixes are ablated to see which ones improved the score
## Measuring errors
There are three ways to measure errors:
- A summary score, which consists of a weighted sum over "soft" checks like:
	- room counts matching public records
	- walls matching the floor plans
	- object outlines imaged from the same angle overlap with objects in the photos
- A ranked list of hard failures like:
	- a door as wide as the wall
	- two walls crossing each other
	- the ground floor in-law unit being unreachable
- A ranked list of high-severity findings:
	- a bathroom with no toilet, tub or vanity
	- a "window" that is really a bookcase
	- cabinets that poke through the ceiling.

The summary score and hard failures are evaluated using code, and high-severity findings are judged by an AI reviewer (two in fact, GPT-6 Astra and Claude Fable 5.1). The latter is a particularly effective way to judge progress because it's flexible enough to incorporate new types of errors discovered along the way.
## Example errors
Holistic verification caught a number of things that the task-specific context did not:
- **Shell was missing structures or otherwise disagreed with photos**
	- The shell missed dozens of walls that appeared in the photos
	- The shell missed a number of doors and windows
    - The shell initially drew a wall between the kitchen and living room, but the photos show that it's an open concept
    - The garage door was hidden behind the front face of the shell
    - The podium out front had no space for an external walkway to the in-law suite downstairs
- **3D scene errors**
    - The actual kitchen ceiling was 88 inches vs. 107 inches in the photos and 3D scan
    - The object models task created cabinets too tall for the space's ceiling height, so the cabinets poked through the floor
	- The fridge was placed inside a row of cabinets
	- A photo camera was placed inside of a wall
- **Misidentified windows**
    - Two “windows” in the study were bookcases
    - The bay windows were wrong
    - The primary bath has two windows, not one
    - A number of panes were actually opaque instead of glass
## Results
I will reiterate that the ultimate performance measure is a visual comparison between photos and the 3D model by a human. It is useful however to examine the effectiveness of quantitative measures as they are important for giving us insight. They are also core to the functioning of the system and the types of solutions we can expect.

Below is a graph of summary score and hard failures over refinement iterations.

![[home-from-an-address/results/10-outer/scores-4.png|Score and hard fails per round]]

In general the summary score improved over time, but scoring isn't perfect. Sometimes a fix that improves a model qualitatively scores higher. There are multiple cases of this:
- **Round 1: removing "ghost walls" that weren't actually there lowered the score.** Removing a wall separating the open kitchen-to-living view scored −0.0008. Adding a number of missing interior walls scored −0.0005. A blank wall got a better score than the open room because only existing edges were compared, not missing ones. Missed photo edges were added for round 2.
2. **Round 4: fixing duplicated stairs lowered the score.** Every flight of stairs was stored twice. The copies created speckled edges that counted as a match for the real edge, so removing the copy decreased the score by 0.0008.
3. **Round 4: objects in a room exceeded the room's height.** The in-law suite has 85 inch ceilings, but its kitchen cabinets were made to be 96 inches. A floor-ceiling check was added for round 5.
4. **Round 5: real fixes made no impact.** The floor plan incorrectly drew windows where there were actually bookcases. But since the scoring didn't include that, making that fix had no effect. Similar thing happened with the living room's chimney.
5. **Round 6: correcting the garage ceiling decreased the score.** The garage has ducts and beams in the ceiling, but these ceiling features hadn't been implemented yet. In some photos the error was better with an incorrect ceiling height because of that.

![[home-from-an-address/tasks/10-plan-vs-photo-3.svg|Plan or photo: the study's two "windows"]]

These were all cases where the scorer could not detect a particular issue. Note how the scorer itself is updated to capture these cases, making it an example of **continual learning**.

A similar thing happens with hard failures. These are checks made by code, but some of the drop in failures results from a false alarm which triggers an agent review and a subsequent updating of the failure checking code. The four remaining ones were judged as false alarms, though worth noting that agent effort was spent on fixing issues rather than updating the checking code for those cases. There's a reasonable case here to make for separating evaluation improvements explicitly.

Below we show three visual examples of what happens across refinement iterations in a space from one camera. The first round (v000) is immediately after the Build phase.

![[home-from-an-address/results/10-outer/refine-kitchen-living-bath-4.gif|Kitchen, living room and primary bath, v000 to v007]]

As we can see, the errors and scores didn't necessarily improve consistently with what we can tell is a visual improvement or degradation. The trends do agree however, and therefore it's interesting to see (edge) errors across iterations for all photos:

![[home-from-an-address/results/10-outer/edge-error-by-version.svg|Edge error per listing photo, all 55 photos, by version]]

The v000 shows that edge errors are actually quite small coming out of the Build stage, and the 26% from the living room is an outlier. Some errors grow after the first round before dropping or flatlining.
# Costs
Unfortunately the amount of work done between runs 1 and 2 are not the same, so a simple quantitative comparison is not possible. There is still lots to be gained by a segmentation of a full run and doing local comparisons. This section should motivate my initial claim that an optimized harness can significantly impact the cost of a full run.

It's useful to start by showing the 3D model with work in terms of photos and objects overlaid from earlier to get a sense of the work done by each run.

![[home-from-an-address/results/house-compare.svg|What each run built, room by room]]

To make the comparison easier, I've put this into a table below. Each cell shows **Run 1 / Run 2**, i.e., Living room had 11 photos placed in run 1 vs 8 for run 2. **Note:** this is the result at the end of each run, including both Build and Refine stages.

| Site tree | Photos placed | Objects |
|---|---|---|
| **Level: Lower** | | |
| Living area | 3 / – | – / – |
| Dining area | 3 / – | – / – |
| In-law kitchen | 2 / – | 8 / – |
| Bedroom | 1 / – | – / – |
| Bath | – / – | 5 / – |
| Laundry | – / – | 3 / – |
| Mech room | – / – | – / – |
| Garage | 2 / – | 3 / – |
| *+ closets, storage, passage, stairs, patio* | – / – | – / – |
| **Level: Main** | | |
| Living room | 11 / 8 | 1 / 1 |
| Dining area | 2 / 2 | – / – |
| Kitchen | 8 / 8 | 20 / 19 |
| Foyer | 3 / 3 | – / – |
| Study | 3 / 3 | 4 / 1 |
| Powder room | – / – | 3 / – |
| *+ hall, stairs, storage, front and rear decks* | – / – | – / – |
| **Level: Upper** | | |
| Primary bedroom | 4 / – | 1 / – |
| Primary bath | 4 / – | 5 / – |
| Middle bedroom | 3 / – | – / – |
| Front bedroom | 3 / – | – / – |
| Bath | 3 / – | 5 / – |
| *+ hall, closets, stairs, rear deck* | – / – | – / – |
| **Total** | **55 / 24** | **58 / 21** |
Overall, we can see that about half the work was done in terms of photos and objects in the 3D model. There's more work per space than just photos and objects, but as you'll see below in the cost breakdown most of the effort is expended on tasks that create and place those two.

Below is a breakdown of the costs by task for each run. The cells show **Run 1 / Run 2**, i.e., _Build the shell_ cost $8 for run 1 and $3 for run 2.

| Phase     | Task                    | Artifacts created             | Iterations  | Cost                                 |
| --------- | ----------------------- | ----------------------------- | ----------- | ------------------------------------ |
| Build     | Build the shell         | –                             | 3 / 1       | 4% ($8) &nbsp;/&nbsp; 3% ($3)        |
|           | Read the floor plan     | 50 / 53 spaces                | 1 / 1       | 1% ($3) &nbsp;/&nbsp; 8% ($7)        |
|           | Fit the plan into shell | 3 / 3 levels                  | 2 / 1       | 4% ($7) &nbsp;/&nbsp; 7% ($6)        |
|           | Sort photos             | 204 / 204 photos              | 1 / 1       | 4% ($8) &nbsp;/&nbsp; 8% ($7)        |
|           | Photos → 3D             | 12 / 11 scenes                | 7 / 1       | 10% ($20) &nbsp;/&nbsp; 7% ($6)      |
|           | Align spaces to site    | 12 / 4 scenes                 | 3 / 1       | 13% ($25) &nbsp;/&nbsp; 8% ($7)      |
|           | Make object models      | 33 / 19 objects               | 3 / 3       | 5% ($9) &nbsp;/&nbsp; 9% ($7)        |
|           | Place objects           | 20 / 19 objects               | 3 / 1       | 9% ($17) &nbsp;/&nbsp; 6% ($5)       |
|           | Facade details          | 38 / 74 elements              | 1 / 1       | 2% ($3) &nbsp;/&nbsp; 5% ($5)        |
|           | _Subtotal_              |                               | _24 / 11_   | _52% ($100) &nbsp;/&nbsp; 61% ($53)_ |
| Refine    | Check and fix           | 38 / 8 fixes                  | 7 / 2       | 43% ($81) &nbsp;/&nbsp; 13% ($11)    |
|           | Final review            | 6 / 16 high-severity problems | 1 / 1       | 5% ($9) &nbsp;/&nbsp; 8% ($6)        |
|           | _Subtotal_              |                               | _8 / 3_     | _48% ($90) &nbsp;/&nbsp; 21% ($17)_  |
| Whole run | Orchestrator            | –                             | –           | – &nbsp;/&nbsp; 17% ($14)            |
| **Total** |                         |                               | **32 / 14** | **~$190 &nbsp;/&nbsp; ~$83**         |
Two main takeaways from the table:
- How much goes into Build vs Refine
- Which tasks require most of the effort (*Photos->3D*, *Align spaces to site*, and *Place objects*)

It's useful to look at a single space for cost-performance comparisons. We can do this for the three tasks that take the most effort.
## Photos to 3D scenes
I'll scope this task to the kitchen space only. Below is a comparison of what the iterations attempted and produced. Run 1 showed Pi3X is more effective than other alternative models, and sometimes changing which photos or how many are used can improve the accuracy. Run 2 leverages that to get the job done more quickly.

![[home-from-an-address/results/costs/photos3d-steps-kitchen-3.png|Kitchen, Photos to 3D: every step of each run, with the depth gap drawn over it]]

Each tile above represents an attempt to reconstruct the current photo using other photos in the kitchen space. The colors represent error buckets which measure the difference in depth between the two. The depth gap error for each tile is the median across pixels. Both runs came to a median depth gap of 0.7% for the kitchen space, but run 1 spent $4.60 across 6 attempts whereas run 2 spent only $1.50 across 2 attempts.
## Align spaces to site
Continuing with the kitchen space, below is the result of the 3D point cloud fit to the floor plan.

![[home-from-an-address/results/costs/align-finals-kitchen-2.png|Kitchen, final alignment to the floor plan, Run 1 and Run 2]]

The cost of this task for this space is roughly the same: run 1 was $1.60 and run 2 was $1.95. This is because the point clouds are more or less the same from the prior task. However, notice the error is slightly smaller for run 1, likely as a result of incorporating more "votes" from more models in photo-to-3D.
## Place objects
The below diagram shows the two runs and what the result of each task iteration was visually and quantitatively.

![[home-from-an-address/results/costs/place-steps-kitchen-2.png|Kitchen, object placement: every step of each run, scored against the photo's object masks]]

Run 1 came in at $17.18 running almost for an hour, and run 2 came in at $5.22 in just 12 minutes. The diagram above shows the breakdowns for cost and timing. Expensive ideas in run 1 like grid search and an agent loop didn't pan out which run 2 can avoid to reduce its cost. Both runs ended with close IoU scores (0.43-0.46).
## Refinement
A significant amount of the budget in both runs went to the Refine stage. As we saw in the Build tasks above, the 3D model resulting from both runs is fairly comparable.

Below is the kitchen space during refinement. Run 1 came in at $14.01, and run 2 at $3.20.

![[home-from-an-address/results/10-outer/refine-compare-kitchen-2.gif|Kitchen through Refine, Run 1 and Run 2]]

And similarly for the living room. Run 1 came in at $4.55 and run 2 at $1.42.

![[home-from-an-address/results/10-outer/refine-compare-living-2.gif|Living room through Refine, Run 1 and Run 2]]

In both cases it seems each iteration focuses on one part of the space at a time.
## Run comparison
Below I compare the largest costs across the two runs.

| Kitchen / living room  | Run 1             | Run 2             |
| ---------------------- | ----------------- | ----------------- |
| Photos → 3D, kitchen   | $4.60, 6 attempts | $1.50, 2 attempts |
| Place objects, kitchen | $17.18, ~1 h      | $5.22, 12 min     |
| Refine, kitchen        | $14.01            | $3.20             |
| Refine, living room    | $4.55             | $1.42             |
| Align to site, kitchen | $1.60             | $1.95             |
We can't quantify how much better run 2 was since the amount of work is not the same. The point is to show the impact of a small amount of optimization, and to motivate more effort in improvement via the harness and its tools.
# Discussion, limitations, and future work
3D reconstruction from photos and other measurements with vision-augmented LLMs in coding harnesses is clearly feasible. It is also prohibitively expensive--I estimate a full model for each space in this home to the same degree as the kitchen and living room spaces would've costed $1-2.5k+.

I've also shown a little evidence that improvements at the harness level with this design can drive down costs. That evidence isn't quite enough to quantify by how much. Given the heterogeneity of tasks, models, tools, and the data distribution with different spaces and styles across geographies, a quantification would be very expensive at this stage.

It's useful to point out what a better-resourced study could do in order to motivate future work. There are a number of interesting ablations to run. For instance, does this work without a floor plan or LiDAR? How could additional targeted measurements, photography, or videos help with accuracy, speed, or cost? Can the agent become more efficient, perhaps by batching fixes or increasing the caps on identifying issues? And the big one: how well does it work for other homes, sites, and spaces?

There are limitations to the agent system as it stands. Object modeling is quite poor and limited to polygonal structures. There are no textures. Surface materials are not identified. And visual comparison between 3D model and real photos by a human hides lots of incorrect details.

A big practical question remains for myself and likely many readers. This looks great as a demo, but can it become the substrate for a serious product? It would be useful to test the output in a real remodeling scenario. Is it sufficiently editable? Can countertops, appliances, and cabinetry be replaced and redesigned informed by real suppliers easily? What is a natural UX for editing? And can it be linked to a real product and labor supply chain to estimate costs? Do the finer geometric details make a difference? These are product questions of course, but eventually turn into capabilities that impact the design.

While there are many questions to ask, I believe we can also answer several from what we've seen here. For instance, computer vision models and techniques are extremely important. Photo-to-3D would not be possible without Pi3X and others, and creating object models with more than 6 planar surfaces would be prohibitively expensive compared to mesh diffusion models as even the rectangular ones took significant tokens.
# Conclusion
I had a lot of fun with this one, and its been well received as a pretty wicked AI capability.

While Astra and Fable are the first models with this level of spatial reasoning, I have no doubt that models elsewhere on the Pareto frontier will continue the trend to drive down costs. Specialized computer vision models also have a role to play, since they can compress specific capabilities into fast and cheap inference. Distilling task decompositions, spatial decomposition, continual learning, and other methodologies and toolsets into skills also has, and I suspect will continue to have, an impact on cost and runtime.

Agents that can do 3D scene reconstruction in a generalizable way will certainly impact a physical industry like home remodeling. I've shown that it is technically feasible, but cost-prohibitive. That may last for some time, but soon with a combination of cheaper and faster VLLMs as well as harness and tool-level improvement we should continue to see cheaper runs that support new and interesting products!
