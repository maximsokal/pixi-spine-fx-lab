# Runtime compatibility modules — draft specification

> Documentation-only proposal. These Markdown files are opt-in knowledge modules, **not** code adapters or a claim that alternate runtimes work in the shipped v0.1.0 editor. The shipped runtime and protected baseline files are unchanged. The main SKILL router provides only a conditional link to these optional documents; reading them must never modify or replace the baseline.

## Why separate files?
The baseline remains PixiJS **8.22.0** + official **spine-pixi-v8 4.2.120** + Spine Editor exports **4.2.x**. Its vendor scripts, tests, sample assets, PNG bake, shader API, project manifest and developer ZIPs are pinned. Compatibility needs two independent selection axes and a **single reviewed pairing** per generated editor, not a universal automatic plugin.

## Read only what is needed
1. Read `references/compatibility/contract.md` and the matrix below **only when** a user requests a different PixiJS generation or Spine export version.
2. Read `pixi/<major>.md` for the selected Pixi generation, then `spine/<major.minor>.md` for the asset export version. Never load all modules into model context.
3. Read `qa-matrix.md` for the exact proof obligations. Legacy adapters also require `legacy-policy.md`.
4. Perform grill-me when the exact engine/version, original `.spine` source, supported renderer or required advanced feature is unresolved. Before implementation, perform grill-with-docs / equivalent manual review against current code, installed deps and official docs, **without changing source**.
5. Present a reviewed migration plan with tested package versions and explicit loss/regression risks. Start changes **only after separate approval**. If a version pair is unsupported, stop; do not try to coerce parser output with renaming.

## Compatibility routing — documentation status
| Spine Editor export | PixiJS 5 | PixiJS 6 | PixiJS 7 | PixiJS 8 |
|---|---|---|---|---|
| 3.7 | Community `pixi-spine` v3 research | Community v3 research | Community v4 research | **No official pair** |
| 3.8 | Community v3 research | Community v3 research | Community v4 research | **No official pair** |
| 4.0 | Community v3 research | Community v3 research | Community v4 research | **No official pair** |
| 4.1 | Community v3 research | Community v3 research | Community v4 / deprecated official `spine-pixi` research | **No official pair** |
| 4.2 | **Not certified** | **Not certified** | Official `spine-pixi-v7` 4.2.x, **unverified here** | Official `spine-pixi-v8` 4.2.120, **baseline** |
| 4.3 | **Not certified** | **Not certified** | Official `spine-pixi-v7` 4.3.x, **unverified here** | Official `spine-pixi-v8` 4.3.x, **unverified here** |

Matrix `research` means upstream source indicates a possible package family, NOT project support. Every major/minor Spine export requires the matching runtime family. Pixi 9 is outside this matrix until official support and tested pair are established. Do not treat Pixi 8 WebGPU as available on Pixi 5/6/7.

## File inventory
- `contract.md`: selector, manifest schema, integration seams, version guards, no-fallback policy.
- `qa-matrix.md`: RED→GREEN, pairs, features, bundles, release gates.
- `legacy-policy.md`: community packages, renderer/lifecycle/Spine feature audit.
- `pixi/5.md`, `pixi/6.md`, `pixi/7.md`, `pixi/8.md`: engine-specific installation and API changes.
- `spine/3.7.md`, `spine/3.8.md`, `spine/4.0.md`, `spine/4.1.md`, `spine/4.2.md`, `spine/4.3.md`: export/runtime-specific hookup and changed behavior.

## Baseline source seams to audit (no automatic patch)
- `assets/template/template.json` runtime pin, protected vendor hashes and browserScripts.
- `assets/template/src/ui.html` editor loading, asset parsing, instance construction, renderer init and baking.
- `assets/template/src/effect-core.js` Spine geometry/clipping, GLSL/WGSL filters and alpha sampling.
- `assets/template/src/export-ui.js` developer ZIP pins, preset schema, sample integration example and shaders.
- `scripts/build_editor.py`, `scripts/verify_project.py`, `scripts/smoke_editor.cjs`, `references/{product-contract,effect-contract,adaptation-map,validation}.md`.

## Authoritative sources
- https://esotericsoftware.com/spine-versioning
- https://esotericsoftware.com/spine-pixi
- https://github.com/EsotericSoftware/spine-runtimes/tree/4.3/spine-ts
- https://github.com/pixijs-userland/spine
- https://pixijs.com/8.x/guides/migrations/v8
- https://pixijs.com/8.x/guides/migrations/v7

**Do not copy 10 version documents into `SKILL.md`.** Its short conditional pointer loads this directory only for explicitly requested nonbaseline runtimes; this does not enable any adapter.