---
name: pixi-spine-fx-lab
description: Build configurable PixiJS filters and Spine FX editors. Preserve offline loading, viewport zoom, WebGL/WebGPU exports, presets, and transparent PNG sequence baking when creating new effects.
---

# Pixi Spine FX Lab

Build a new visual effect on top of the bundled editor; preserve its working infrastructure. Treat the burn transition as a reference implementation, not the only effect this skill can produce. Support built-in PixiJS filters, compatible `pixi-filters`, custom GLSL/WGSL, filter chains, and extra effect layers when the requested design requires them.

## Start from the actual editor

1. Read [the preserved product contract](references/product-contract.md) and [the adaptation map](references/adaptation-map.md).
2. Inspect a supplied newer editor/repository first. Preserve its behavior; never replace it with the older bundled seed. Read applicable `AGENTS.md`, repository playbooks, architecture, lockfiles and tests before changing code.
3. For a new lab, inspect `assets/Spine_Burn_Lab.html`, the complete offline reference. Bootstrap its editable equivalent:

   ```bash
   python scripts/bootstrap_editor.py --output /absolute/path/to/my-fx-lab
   python scripts/build_editor.py /absolute/path/to/my-fx-lab --output /absolute/path/to/My_FX_Lab.html
   ```

   Resolve these script paths relative to this skill. Use Python 3.10+ and the host's actual output paths. Do not edit installed skill assets to create a user's effect. Browser QA requires Node.js, Playwright and Chromium; building the generated Vite examples requires Node.js 20.19+ or 22.12+.
4. Read `assets/template/template.json` for exact runtime pins and protected files. Verify the project with `scripts/verify_project.py` before and after editing.

## Review, then implement the approved effect

Follow [the review and task workflow](references/workflow.md). Ask at most three high-value questions if appearance, endpoints, progression or scope remain unclear. Preserve an existing approval instead of requesting it again.

For this user's software work, separate planning and implementation. Invoke `grill-me` for unresolved requirements and `grill-with-docs` before implementing a completed plan when those skills actually exist. If unavailable, explicitly report that fact, perform the documented manual review and obtain approval of the reviewed implementation plan. Never claim a missing skill ran. Packaging an existing editor as a skill does not approve a future unspecified effect design.

Choose an existing compatible filter, a custom filter, or a bounded composition of filters and extra layers. Verify the exact APIs, dependency versions and backend support against official sources. Do not assume every filter supports WebGPU or WebGL 1. Add an exactly pinned `pixi-filters` 6.x dependency only when needed; the seed does not include that package. Bundle required code locally rather than fetching a CDN at runtime.

## Preserve the shell; change the effect deliberately

Read [the effect contract](references/effect-contract.md) and [controls and performance](references/controls-performance.md).

- Keep all UI, messages, controls, tooltips, export instructions and developer documentation in English.
- Preserve staged JSON/SKEL + atlas + texture loading, multipage atlases, animation/skin selection, input errors, and the working sample.
- Preserve PixiJS 8.22.0 and spine-pixi-v8 4.2.120 unless a separately approved upgrade includes compatibility tests. Preserve vendor files and notices.
- Use one shared effect implementation for preview, both developer exports and isolated baking. Do not recreate a separate export shader.
- Give every meaningful artist parameter a stable key, type, valid range, default, units and export mapping. Expose advanced controls in collapsible groups. Remove irrelevant burn controls when creating a different effect.
- Keep mutable effect/application state in modules/closures or the host project's state system. Do not add mutable application state to `window`.
- Keep the viewport large and authoring controls in the independently scrolling sidebar. Separate camera zoom from skeleton scale and output size.
- Apply one camera mapping to the canvas, crop frame and handles; invert it for interaction. Camera zoom and guide visibility must not change exported images.
- Preserve transparent, identically sized, untrimmed PNG frames at fixed 60 FPS authoring times. Preserve seeded randomness, cancellation and cleanup.
- Preserve separate WebGL and WebGPU developer ZIPs, a real WebGPU implementation where required, and tested WebGL fallback. Include presets, assets, shared module, shaders, runnable example and English integration instructions.

Do not promise automatic translation of “any effect” to every backend. Generalize this workflow, then implement and validate each requested effect. Present a concrete limitation and reviewed alternative when a design cannot fit a backend or device budget; do not silently omit it.

## Build and verify

1. Update the controls, effect implementation, UI wiring, shader exports, preset, generated integration example/README and bake instantiation together. Use the adaptation map to find burn-specific assumptions.
2. Build the self-contained HTML with `scripts/build_editor.py`; it requires only Python's standard library and local assets.
3. Run `python scripts/verify_project.py PROJECT --html OUTPUT.html`.
4. Run the portable browser check:

   ```bash
   node scripts/smoke_editor.cjs --html /absolute/path/to/My_FX_Lab.html --backend both --output /absolute/path/to/qa-results
   ```

   Use an available local Playwright installation. Set `PLAYWRIGHT_MODULE` to its module path and `BROWSER_EXECUTABLE` to Chromium if not exposed normally. Do not assume the original workspace/browser paths exist elsewhere.
5. Follow [the acceptance matrix](references/validation.md). Add effect-specific endpoint, alpha and appearance tests. A compile or visible canvas alone is insufficient.
6. Extract/build both developer ZIPs, run their examples and test fallback. Reuse passing focused checks unless later changes invalidate them. Report unavailable physical-device tests honestly.

## Deliver and reuse

Deliver the offline HTML and explicitly requested packages. Do not create a public GitHub repository, deploy, publish customer assets or change production without authorization. GitHub is optional for version history, not required for installing the skill.

Read [installation and portability](references/installation.md) for Claude chat/settings and Claude Code. Read [evaluation scenarios](references/evaluations.md) for example requests and decision boundaries. Load only the references needed for the task.

Report what changed, what stayed compatible, checks actually run and remaining limitations. Separate a new effect's evidence from the tested burn baseline.
