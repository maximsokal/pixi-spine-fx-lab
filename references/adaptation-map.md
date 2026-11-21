# Adaptation map

For a new effect, first select its [FX Blueprint](fx/index.md) using the [versioned schema](contracts/blueprint.md), then load only the required contracts. Bind the specific effect's stable [parameters](contracts/parameters.md) to the anchors below. A spec-only Blueprint is not an existing implementation. Do not copy burn/grayscale controls into an ICE or GAME editor.

The template preserves working infrastructure but contains burn-specific names and behavior. Copying it is a starting point, not a finished new effect. **FIRE-05:** `assets/smoke-plume/src/` and `scripts/build_smoke_editor.py` implement soft-alpha pooled sprites for a persistent warm-loop smoke plume, independent stop/burst fade, optional fine ash, editable nozzle/path source and pinned Spine anchors. Do not edit other FIRE sources.

**FIRE-04:** `assets/embers-sparks/src/` and `scripts/build_embers_editor.py` implement independent one-to-four combustion sources, age-cooled sparks, optional streaks/bloom, actual pinned Spine anchors, shared FxSpacing/FxColors/FxTimeline and standalone export. Preserve all prior FIRE editors.

**FIRE-03:** `assets/fireball-projectile/src/` plus `scripts/build_projectile_editor.py` implement independently controlled motion-aware fireball and ribbon/editor with true FxSpacing path distance events and five layers. No modifications to existing Burn, Torch or Explosion sources.

**FIRE-02:** `assets/fire-explosion/src/` and `scripts/build_explosion_editor.py` implement an independent one-shot explosion with six layers, true burst schedules and bounds-checked 512×512 PNG baking. No Fire Explosion code belongs in the Burn or Torch editor.

**Already implemented FIRE-01:** `assets/torch-flame/src/` and `scripts/build_torch_editor.py` are a separate purpose-built Torch Flame editor. When using it, preserve its own `FxTorch` renderer-neutral core, `FxTorchRuntime` Pixi layer ownership, editable controls, PNG bake and dual developer packages. Do not retrofit Torch into `assets/template/src/effect-core.js`, the Burn-only exporter, or vendor files.

| File / anchor | Responsibility | Adaptation |
| --- | --- | --- |
| `src/ui.html`: defaults, groups, displayValue | Parameters and artist controls | Define new keys/ranges/defaults/units/groups; retain shell IDs used by regression. |
| `src/ui.html`: syncUniforms, field, factory calls | Shared effect wiring | Map every control; replace burn-only fields/markers and remove ineffective controls. |
| `src/ui.html`: installAsset, loadFiles, loadSample, setAnimation, setSkin | Spine input/lifetime | Preserve loading, errors, atlas/source ownership and selected animation/skin. Add effect textures separately. |
| `src/ui.html`: fit, bakeCrop, layoutPreview | Authoring bounds | Preserve fixed output geometry; camera zoom must not calculate bake size or skeleton scale. |
| `src/ui.html`: cameraState, projections, applyCameraTransform, updateCameraShades | Display-only camera | Preserve common scene/guide mapping, inverse pointer mapping and mask coverage. |
| `src/effect-core.js` | Shared runtime | Seed exports SpineBurnFx.createBurnTransition, GLSL/WGSL, application helper and RNG injection. Generalize a facade or adapt every explicit call site. |
| `src/ui.html`: bakeSequence | Isolated deterministic bake | Instantiate the same new effect and include all layers; preserve alpha, fixed steps, limits, cancel and cleanup. |
| `src/export-ui.js`: preset, example, readme, buildPackage | Developer exports | Update names, schema, module imports, shaders, dependencies and instructions together. Both examples must run the actual effect. |
| `src/export-ui.js`: ZIP encoder / sequenceZip | Offline packaging | Keep bounds, error handling and cancellable packing. |
| vendor, sample, licenses, template.json | Protected baseline | Preserve hashes/pins/notices unless a separate runtime upgrade is approved and validated. |

## Working rules

1. Bootstrap into a separate working directory; never edit installed assets.
2. List the shared API and all call sites before implementation. Retain loader, camera, transport, ZIP and PNG infrastructure.
3. Prefer a small compatibility facade over an incomplete global rename. An internal legacy name is acceptable in an intentional adapter; delivered UI/preset/instructions must identify the new effect correctly.
4. Do not globally replace “burn” in minified libraries or unrelated APIs. Do not accidentally preserve grayscale in a glow or alpha removal in a displacement effect.
5. A continuous effect needs an explicit timeline/progress policy. Texture-driven effects need additional validated resource inputs and exported resources.
6. Extend the local builder and package dependencies together when adding a filter package. Do not introduce runtime CDN requests.

`build_editor.py` assembles the final modular source directly. Do not recreate the original conversation's incremental patch scripts: they can overwrite newer work.

If a newer editor arrives as a single HTML, inspect named script slots (`sharedCore`, `runtimeLicenses`, `sampleData`) and application/export scripts without dumping minified vendors into context. Preserve the newer file instead of bootstrapping over it.
