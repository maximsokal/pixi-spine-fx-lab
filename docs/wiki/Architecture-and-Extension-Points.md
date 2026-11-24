# Architecture and Extension Points

## Repository map

| Location | Responsibility |
| --- | --- |
| [SKILL.md](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/SKILL.md) | Agent entry point, effect routing and preserved rules |
| [assets/Spine_Burn_Lab.html](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/assets/Spine_Burn_Lab.html) | Self-contained original Burn reference |
| [assets/template/](https://github.com/maximsokal/pixi-spine-fx-lab/tree/main/assets/template) | Editable baseline source, sample, vendored runtimes, manifest |
| [assets/](https://github.com/maximsokal/pixi-spine-fx-lab/tree/main/assets) | Separate effect-specific editors and source folders |
| [references/fx/](https://github.com/maximsokal/pixi-spine-fx-lab/tree/main/references/fx) | Machine-routed Blueprints and documented lifecycle |
| [references/contracts/](https://github.com/maximsokal/pixi-spine-fx-lab/tree/main/references/contracts) | Reusable curves, spacing, path, emitters, colors, timeline, parameters, Blueprint contracts |
| [scripts/](https://github.com/maximsokal/pixi-spine-fx-lab/tree/main/scripts) | Offline builders, verification, regression/visual tests |
| [references/compatibility/](https://github.com/maximsokal/pixi-spine-fx-lab/tree/main/references/compatibility) | Optional runtime migration **specifications**, not plugins |

## Burn baseline editing seams

- `assets/template/src/ui.html` — loading, controls, animation/skin selection, camera, crop and bake orchestration.
- `assets/template/src/effect-core.js` — shared Burn effect logic, shaders, state and rendering.
- `assets/template/src/export-ui.js` — presets, ZIPs, integration examples, shader and dependency packaging.
- `assets/template/template.json` — pinned runtime, bundled sample, protected file checksums.

An effect-specific editor typically lives in `assets/<effect>/src/` with its matching `scripts/build_*_editor.py`. Modify only that effect's own code unless a separate common-contract change is explicitly approved. Do not retrofit Torch, Rain or Bubbles logic into the Burn-specific module.

## Change boundaries

- The camera is a view transform; effect/bake coordinates must not depend on zoom.
- The effect factory owns only its own filters, render textures, buffers, event handlers and procedural layers.
- Caller-owned Spine assets are not disposed when destroying an effect instance.
- Absolute timeline/seed and normalized settings must drive preview, isolated bake and both developer examples consistently.
- Shader/backends must be genuine: an inert WGSL placeholder or silent WebGPU-to-WebGL substitution is not acceptable as proof of WebGPU correctness.
- Validate effective shader bounds, alpha/PMA, cleanup and resource budgets under Low/Balanced/High.

## How to design a new editor

Use the [adaptation map](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/adaptation-map.md) to locate actual call sites and avoid global search-and-replace of Burn names. Define a typed parameter schema and a Blueprint, update only the necessary effect source, UI, export package and tests, then build and verify all relevant artifacts. This is an **implementation workflow** requiring a separately reviewed and approved plan, not a license to change code while reading the Wiki.

See [[Agent-Workflow-and-Contracts]] and [[Validation-and-Tests]].
