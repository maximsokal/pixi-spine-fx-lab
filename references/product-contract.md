# Preserved product contract

Use `assets/Spine_Burn_Lab.html` as the executable reference and `assets/template/` as its editable equivalent. This records decisions visible in the supplied conversation; do not claim access to unseen chats.

## Runtime and loading

- Pin PixiJS 8.22.0 and `@esotericsoftware/spine-pixi-v8` 4.2.120. Accept exported Spine 4.2.x JSON/SKEL. The included Doctor head sample (two atlas pages, sequence attachments, nine animations) reports 4.2.43; it is declared in the `sample` block of `assets/template/template.json`, and `build_editor.py` embeds it from there.
- Preserve separate Skeleton JSON / SKEL, Atlas and Textures selectors, accumulated texture selections, selected-file list and explicit Load preview. Retain the current preview until a new model loads successfully.
- Preserve complete-set selection and drag/drop, all atlas pages, image formats, PMA handling, clipping, meshes, skins and animation selection. Report missing/ambiguous pages and unsupported versions clearly.
- Do not open editor `.spine` files as runtime exports. Do not advertise other runtime versions without separate approval and tests.
- Keep vendors and sample embedded/local. Loading, editing and baking must work offline without uploads or login.

## Editing and viewport

- Keep all authoring controls in the right sidebar on desktop; scroll it independently. Keep the left viewport large and stationary. Preserve an accessible narrow-screen arrangement.
- Preserve transport, effect enable, animation/skin/background, animation speed, progress, timing and applicable reverse/loop controls.
- Synchronize seconds and whole frames at 60 FPS. Use inverse easing for elapsed time/frame readouts if visual progress is eased mask position.
- Preserve Linear/Circular/Organic modes for burn extensions. For another effect, replace irrelevant controls explicitly while retaining timeline infrastructure. Circular transitions must use actual pixel distances, not separate X/Y normalization.
- Preserve camera minus/plus, percentage, Fit, 100% and wheel zoom at the pointer. Keep skeleton scale distinct. Apply the same camera to scene and guides; invert it for crop/center dragging.
- Camera state and guide visibility are display-only. They must not alter crop metadata or baked PNG bytes.

## PNG baking

- Bake the selected playing animation and every enabled effect layer, including particles outside the filter host.
- Accept Width/Height and crop-center offsets in whole authoring pixels. Show the exact labeled crop boundary and outside mask; permit dragging its label.
- Export a ZIP with `frames/frame_00000.png` onwards, `sequence.json` and English instructions. Keep all PNGs exactly W by H, RGBA, transparent and untrimmed. Never capture checkerboard, guides, toolbar or other HTML UI.
- Start the selected animation from frame zero with the selected skin/speed; loop as recorded in metadata. Preview pause does not freeze the animation being baked. Start transition progress at zero.
- For N frames, use duration N/60 and samples i/60, i=0..N-1. The end is exclusive: 1.5 seconds = 90 frames; 91 frames include a sample at exactly 1.5 seconds. Do not add a hidden duplicate endpoint.
- Freeze crop, transform, settings and seed during the job. Use fixed simulation steps, not encoding time. Preserve live preview pose/state. Test deterministic outputs within the same backend.
- Preserve progress, Cancel, resource cleanup, actual GPU limits and memory bounds. Current caps: dimensions 1..4096, frames 1..3600, encoded frames <=192 MiB. Reject device limits below these maxima.

## Developer handoff and compatibility

Preserve separate WebGL and WebGPU-preferred ZIPs with tested WebGL fallback. Include exact preset/timing, current Spine assets, shared effect module, appropriate readable shaders, pinned package dependencies, runnable example, notices and English README. Document coordinate units, alpha/blending, tick order, resize, external progress control and cleanup.

Preserve Low/Balanced/High. Use WebGL 1 + Low as the older-phone compatibility path, subject to real browser capabilities. A 2019–2020 model year is not an FPS guarantee.

The supplied implementation is a tested burn-to-grayscale lab with flame/sparks. It is not an already implemented universal filter graph. MP4/WebM export, `.spine` editor import/export and arbitrary Spine versions are outside the shipped baseline.
