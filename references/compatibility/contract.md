# Runtime Adapter Contract (specification — not yet implemented)

## Goals and explicit non-goals
Goal: enable a **reviewed, opt-in** Spine export/runtime adapter and a **reviewed, opt-in** PixiJS engine adapter for a generated, dedicated FX Lab, while keeping the default baseline exactly as shipped. These documents describe integration procedures; they are not executable modules.
Non-goals: simultaneous mixing of incompatible runtime major/minor versions in one Pixi renderer; automatic conversion of binary `.skel`; rewriting old exports by string replacement; automatic PixiJS upgrade; a single monolithic all-version editor; changing licenses; turning off PNG/ZIP tests.

## Selection schema — proposed JSON, not accepted application API
```json
{
  "schemaVersion": 1,
  "profileId": "spine4.2-pixi8-baseline",
  "pixi": {"major": 8, "exactVersion": "8.22.0", "renderer": "webgl"},
  "spine": {"exportMajorMinor": "4.2", "package": "@esotericsoftware/spine-pixi-v8", "exactVersion": "4.2.120"},
  "integration": {"offline": true, "assetFormats": ["json", "skel"], "selection": "explicit"},
  "validation": {"status": "baseline-only", "evidence": null}
}
```
Every profile needs: exactly pinned package, package origin + legal notice, integrity hash, renderer support, supported export version, asset loader, creation API, renderer capabilities, shader API, bake strategy, fallback policy, performance profile, QA matrix, provenance and limitations. Only exact profiles with evidence may be labeled `certified`.

## Universal interface goals (to review before implementing)
- `inspectExport(input)` inspects JSON metadata or calls the correct format-aware binary reader in a sandbox; it returns detected major.minor and confidence, **never** assumes one parser can read all versions. For JSON, read skeleton export metadata rather than user-edited filenames. Fail safely for corrupt/unknown `.skel`.
- `resolveProfile({pixi,spine,renderer})` returns one compatible, pinned profile or actionable error. No silently substituting Pixi 8 / Spine 4.2 after an incompatible selection.
- `createEngine(options)` initializes correct Pixi generation, returns renderer/backend facts, stage/ticker and lifecycle hooks.
- `loadSkeleton(skeleton, atlas, images)` validates complete multi-page atlas, PMA/alpha interpretation, loader asset aliases, binary/JSON and release version before constructing.
- `createSkeleton(data, options)` uses version-appropriate class and `autoUpdate:false` for manual deterministic bake. Expose `skeleton`, `state`, `update`, `setSkin`, `setAnimation`, `getGeometry`, `dispose`, with feature gates rather than pretending identical APIs.
- `createEffectHost()/renderFrame()/readPixels()/exportPNG()` preserve exact crop, time, alpha and ownership. Shader capability is explicitly tied to Pixi version and renderer, including WebGL-only legacy paths.
- `exportDeveloperPackage()` emits the *selected profile's actual pinned* dependencies, assets, integration sample, licenses and renderer caveats; the package must not claim baseline versions when another profile is active.

## Connection sequence / migration protocol
1. Request target Pixi generation, Spine export version and actual assets (including original `.spine` for re-export). Determine expected WebGL/WebGPU and Canvas limitations.
2. Select both Markdown modules and compare package support; **reject mismatch at the planning stage**. Re-export from the exact Spine Editor major.minor when the runtime changes; never rename `skeleton.spine` to bypass guards.
3. Choose *one* package set and exact tested versions. Add local vendored bundles separately; audit licenses/notice and supply chain hashes. No CDN at runtime.
4. Map old code seams: app initialization, loader/atlas, `Spine` constructor, skeleton update/pose, mesh/clipping, filter/shader, batch/render targets, pixel extraction, ZIP and manifest.
5. Create focused fixtures for selected version: JSON, SKEL, multi-page atlas, weighted mesh, skins, clipping, 2-color tint, events, sequences/physics only when supported.
6. Execute isolated RED→GREEN checks before replacing the baseline runtime; only then build standalone HTML and test selected developer ZIP. Baseline remains available as its own profile.
7. Record a compatibility certificate (tool versions, test SHA, browser+GPU, actual backend, results, limitations). Unless independently reviewed and approved, do not modify main `SKILL.md` or pinned baseline.

## Invariants
- `SKILL.md` stays a small router; read one Pixi module + one Spine module + this contract, not the whole catalog.
- No silent version downgrade/upgrade, no multiple incompatible Pixi singletons in one page, no false WebGPU support, no invisible alpha holes or dark fringes.
- Engine selection does not modify current project's animation contents, atlas data or texture PMA. Runtime may not alter authored curve/time semantics.
- PNG always straight-alpha RGBA; vendor-specific WebGL extraction bug #1/#2 must be accounted for. Fixed 60 FPS authored samples and same-backend camera invariance.
- A compatibility *document* is not evidence of a functioning implementation.

## Approval and stop conditions
Before source changes: grill-me if unresolved; grill-with-docs or clearly disclosed manual read-only review; show required corrections, edge cases and test matrix; obtain explicit approval. Stop on unverified patch/API, licensing ambiguity, no re-export source, unsupported renderer, or mismatch.

Sources: https://esotericsoftware.com/spine-versioning · https://esotericsoftware.com/spine-pixi · https://pixijs.com/8.x/guides/migrations/v8