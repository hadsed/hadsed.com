# SR-71 / Seedance motion prototype

October 4, 2026. Route B is selected. This experiment tests camera movement and atmosphere before further aircraft modeling or environment work.

## Creative brief

Begin with a tiny aircraft low beneath a huge, dark, quiet storm ceiling. Tilt the camera upward so the sky dominates; keep water to a narrow, indistinct strip. Let the aircraft approach, smoothly match its speed by retreating, rise over the nose and slide to the side, then settle into the poster's profile composition. Hold the final view. Keep the aircraft on a consistent straight, level flight path.

Cold desaturated blue-gray, matte metal, heavy diffuse cloud, subtle haze, and restrained grain. No visible UI or text. No lightning flashes, combat, explosive action, camera shake, or energetic cloud churn. Silent video.

## Research and workflow

- [ByteDance's Seedance 2.5 announcement](https://seed.bytedance.com/en/blog/one-take-creation-flexible-referencing-introducing-seedance-2-5) is the latest official release found. It explicitly demonstrates timed camera descriptions and separately assigned references for blocking versus materials/atmosphere. It also supports clay-render references. This supports using a written storyboard together with our simple board and the poster; it does not guarantee exact camera reproduction.
- [Runway's Seedance 2.5 documentation](https://help.runwayml.com/hc/en-us/articles/53542207042323-Creating-with-Seedance-2-5) distinguishes Reference mode from Keyframe mode. Reference mode assigns each input a role; Keyframe mode fixes first/last frames. The first prototype uses references, rather than forcing the crude proxy render to be the opening image.
- The connected Runway workspace exposes Seedance 2.5. Its tool accepts ordered reference images, text, ratio, resolution, and an audio toggle.

## Reference roles

1. **`@Image1`: [original poster](inspo/sr71-metal-print-reference.png).** Aircraft identity, silhouette, materials, cold grade, storm light, and final mood. Use only the inner artwork, not the black screenshot surround or poster edges.
2. **`@Image2`: [revised Route B storyboard](storyboards/route-b.png).** Camera progression and composition only. Read the five frames top-left to top-right, middle-left to middle-right, then the centered bottom frame. Do not reproduce the contact-sheet layout, simple geometry, shiny material, fake mirrored aircraft, or orange proxy exhaust cones.

The exact timed text is in [the reusable generation prompt](prompts/sr71-seedance-route-b.txt). Time ranges describe one continuous camera move, not five hard cuts. The prompt should be evaluated for spatial continuity, low opening aircraft placement, preserved aircraft identity, restrained weather, and a stable poster-like ending.

## First draft settings

- Model: `seedance-2.5`.
- 16:9 widescreen.
- 10 seconds, the generation tool's default duration.
- 480p for a composition/motion draft.
- Audio disabled.
- Two ordered image references; no starting frame or reference video.

Runway lists 480p at 20 credits per output second, so this draft is approximately 200 credits. Higher resolution is deferred until the camera move is worth keeping.

## Submission status

Both reference files were uploaded successfully. The generation tool rejected the request for insufficient workspace credits. No video task or output was created. A credit/top-up card was shown in the chat. Resume submission after funding; do not silently substitute another model or compress the whole camera sequence into an excessively short clip.

Hosted reference URLs are temporary, signed URLs and are deliberately not stored in Git. Re-upload the versioned local files when resuming if necessary.

## Possible next iteration

If the reference-based draft has the right mood but loses the shot, try a short clay-render camera reference or clean opening/final stills. Decide from the first output rather than preparing those additional assets now.
