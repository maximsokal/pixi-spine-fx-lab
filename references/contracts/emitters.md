# FX-CORE-03 — Independent Multi-Emitter and Layer Contract (v1)

The common emitter contract is reusable across specialized standalone FX Labs. It does **not** make the Burn Lab a monolithic effects editor. The bundled optional **Independent emitters & layers** panel demonstrates a seven-component explosion while retaining the older Spine-surface spark emitter and burn shader unchanged by default.

## Implementation and dependency order

1. `assets/template/src/curve-core.js` and `spacing-core.js` remain available as optional reusable animation curves and time/distance schedules.
2. `assets/template/src/emitter-core.js` implements the **pure**, DOM/Pixi-free `FxEmitters` data contract, preset, deterministic numerical sampling and bounded budgets.
3. `assets/template/src/emitter-runtime.js` adds the pinned PixiJS 8.22.0 / spine-pixi-v8 4.2.120 renderer through `FxEmitterRuntime.createEmitterLayers({PIXI,app,host,model,settings,bounds,worldOffset})`.
4. `assets/template/src/emitter-ui.js` is optional specialized UI. It manages the same normalized JSON without depending on the renderer's private state. The existing Burn Lab's artist controls and the reusable curve/spacing editors are preserved.
5. The offline HTML, 60 FPS isolated PNG bake, WebGL ZIP and WebGPU ZIP contain the **same source modules**, identical sample clocks and independent emitter seeds. No network calls during editor use.

## Versioned format

`{schemaVersion:1, enabled:false, globalBudget:600, emitters:[...]}`.

- Up to **16 emitters**, **64 layers total**, and **1,400 live primitive budget**. The quality profile may impose an additional runtime cap. Every emitter and every layer has a **globally unique stable ID**; IDs must never change when its name/order/visibility changes. Duplicate IDs, unsupported fields, malformed JSON, NaN/Infinity, invalid blend/anchor or out-of-range values are errors.
- Emitter fields: `id`, `name`, `enabled`, `visible`, `x`, `y` (logical pixels), `space` = `world|local`, `anchor:{type,name,slot?}`, `rotation` (degrees), `scale`, `duration` (seconds), `timeOffset` (seconds), `seed` (int32), `order`, `placement` = `behind|front|slot`, `fallback` = `hide|front`, `blend`, `budget` (0–1400), `layers`, and optional `timeCurve` using [curves.md](curves.md) `emitterProgress/emitterTime`.
- Per-layer fields: `id`, `name`, `type`, `enabled`, `visible`, `x`, `y`, `rotation`, `scale`, `order`, `blend`, `color`, `opacity`, `radius`, `count`, `budget`.
- Seven independent renderable layer types: **glow**, **rays**, **smoke**, **debris**, **sparks**, **trails**, **postprocess**. The last is an isolated ring with its own pinned PixiJS BlurFilter, **not** a shared filter on the skeleton. All are individually disabled and repositioned; turning off rays or trails does not affect unrelated graphics, postprocess, or particle RNG. No "invisible" effects are added outside the registered layer tree.
- Available blends: normal, additive, multiply and screen. Layer `order` is sorted within emitter, while emitter `order` sorts in its behind/front group. For slot insertion, order within the slot container follows emitter and layer order.
- `FxEmitters.makeExplosionPreset()` creates two emitters with seven independently controlled layers each, but sets `enabled:false` to retain identical pre-feature behavior and GPU budget until an artist explicitly enables the explosion.
- Independent numerical evaluation `FxEmitters.sample(document, absoluteSeconds)` is a pure function. Per-emitter seed and stable layer ID + primitive index determine all RNG; **never** global `Math.random`. Seek, re-enable, change FPS, reset and undo never spawn a catch-up burst or affect another emitter's RNG. Duration and offset refer to an **absolute seconds** authoring clock. Hidden/disabled emitters/layers cost zero GPU render primitives.

## Anchoring and coordinates

**World:** x/y are absolute stage coordinates. When rendering into an isolated crop target, `worldOffset = {-crop.x,-crop.y}` converts the source preview positions into crop-local coordinates. The preview camera does not enter this transform.

**Local:** x/y are relative to the selected skeleton origin or named bone/slot/attachment. Bone position is transformed through the current Spine skeleton pose and model world matrix; attachment origin is the transformed bounding-box center of its active region/mesh world vertices. For local offsets, bone a/b/c/d transforms are used; for world offsets, the anchor is followed but x/y remain in renderer pixels.

**Slots:** When `placement:'slot'` and anchor is a named Spine slot/attachment, a single **FX-owned** wrapper is attached through `Spine.addSlotObject(slot, wrapper)` and hosts as many emitter child containers as needed. This allows actual interleaving in the Spine draw order on pinned WebGL 1/2 and WebGPU. Only one wrapper may exist per slot; an already occupied caller-owned slot is never replaced. Spine can override wrapper transforms/masks, so each emitter owns a nested child container. A slot is detached through `removeSlotObject` before its wrapper is destroyed; live emitter children are moved to a surviving owned group first. Never destroy the caller's Spine model, attachments, atlas, textures, host or pre-existing filters.

**Missing anchors:** Missing/inactive bone, slot or attachment **hides the affected emitter**, reports a stable diagnostic, and does not teleport it to (0,0). `fallback:'front'` explicitly requests front-of-Spine placement if slot *insertion* is unsupported or occupied; missing named anchors still hide. `fallback:'hide'` is the default. When actual per-slot rendering is unavailable on a future backend, no false claim of slot interleaving is permitted.

**Viewport editing:** emitter centers and the selected layer have independent SVG handles inside the existing `cameraPlane`; the camera matrix applies equally to the canvas, crop and handles. Pointer deltas use `previewToScene`, then invert the current anchor/model matrix for the emitter or the parent container matrix for a layer. Numeric x/y remain precise even when local Spine scaling means that 10 screen pixels are not 10 bone-local pixels.

## Rendering, alpha and lifecycle

- One identity-transform host per Spine model. Two owned stage groups (behind/front) plus optional per-slot wrappers contain *only* FX-owned containers, graphics and per-layer filters. They do not modify caller stage filters or the Spine atlas. Layer `visible` and `enabled` are separate controls; both false mean zero drawn primitives.
- Low/Balanced/High retain their original burn shader profile. The multi-emitter document and each emitter/layer budget cap the additional primitives, with a hard global bound. Color and alpha are premultiplied by Pixi's existing pipeline, then converted to straight-RGBA by the proven PNG readback. Disabled layers do not execute their filters.
- Every update is by absolute authored time (`seek(seconds)`); no per-frame accumulation or resource reallocations. Construct graphics and blur filters only when an emitter/layer is added; reuse them while playing. Editing or deleting one emitter destroys only its owned objects. A call to `destroy()` removes slot objects and disposes every owned filter, graphic and group, but not model/host/atlas.
- The PNG bake instantiates a **separate** emitter runtime with the same settings and isolated Spine model, seeks at exact `frameIndex / 60`, and renders all front/behind/slot layers, including off-model particles inside the selected crop. `sequence.json.emitters` contains enabled status, per-frame primitive count, visible layer IDs and resolved positions; UI guides/handles do not appear in PNG.
- Both developer packages include `FxEmitters.mjs` and `FxEmitterRuntime.mjs`; their `example.js` initializes and updates a real multi-FX instance, not only a schema stub. The disposable example tears down multiFX before destroying the caller's skeleton.

## UI acceptance boundary

The optional emitter panel sends a normalized candidate to its synchronous `onChange` acceptance callback before publishing the local document or proposed selection. The template host configures the runtime before assigning `cfg.multiEmitters`. On rejected or locked edits the panel redraws the accepted controls and reports the error. The optional `onCommit` callback updates handles after acceptance; a subsequent UI-refresh error must not be represented as an uncommitted edit. This covers panel edits only, not the global defaults action or full native renderer rollback after partially applied setup/seek. Do not use it as an agent transaction API until those remaining boundaries are reviewed and verified. The protected prebuilt Burn HTML and vendor/sample pins remain unchanged.

Focused regression: `node --test scripts/test_emitter_ui_transaction.cjs` (actual UI/core and host mount callback, minimal injected DOM and renderer, not a real-browser/GPU test).

## RED→GREEN acceptance

```sh
node scripts/test_emitters.cjs
node scripts/test_emitter_editor.cjs --html assets/Spine_Burn_Lab.html --backend webgl --output qa-emitter-gl
node scripts/test_emitter_editor.cjs --html assets/Spine_Burn_Lab.html --backend webgl --webgl1 --output qa-emitter-gl1
node scripts/test_emitter_editor.cjs --html assets/Spine_Burn_Lab.html --backend webgpu --output qa-emitter-gpu
```

- Unit tests: independent position and per-layer motion, stable IDs, seven visually defined layers, strict JSON, seeded isolation, monotonic budget enforcement, absolute-time seek, no catch-up frames at 30/60/120 FPS, malformed anchors.
- Browser: real pointer drag at camera zoom 50/100/200%; local and world transforms; actual missing-bone diagnostic; region/mesh attachment centroid; one shared Spine slot object for two emitters; slot teardown on placement changes; color/filter/toggles; duplicate/add/remove and independent resources.
- PNG: 40 frames with all layers versus explicit full disable; verify encoded PNG **bytes differ** and the metadata matches the actual sampled state; world emitter positions remain correct under isolated crop. Previously working burn/spacing/curves stay untouched when the multiFX toggle is disabled.
- Developer: both ZIPs export the pure core and runtime, import as ESM without changing pinned dependencies, build and run via Vite. Confirm WebGL 1 *actual* renderer, WebGL 2, WebGPU and offline, and prior PNG-PMA/lifecycle/spacing/curve tests. GPU and physical-device budgets need separate measurement; do not claim certifications without hardware testing.
