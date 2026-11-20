# FX-CORE-08 — Common Path Geometry, Taper and Branching (v1)

**Optional, reusable 2D geometry module for *specialized* FX editors.** This is not a generic FX graph, a new default Burn Lab layer, an enabled shader, or a completed Vine Growth / Chain Lightning / Sword Slash effect. The current pinned Burn editor stays unchanged. A concrete effect must still implement its own artist controls, timeline, anchors, colors, PNG and WebGL/WebGPU exports and pass [FX-CORE-07 validation](effect-validation.md).

## Dependencies, versions and ownership

1. [FX-CORE-01 Curves](curves.md): `FxCurves.normalize/evaluate` for the optional width multiplier curve.
2. [FX-CORE-02 Spacing](spacing.md): `FxSpacing.normalizePath`, `buildArcTable` and `pointAtDistance` are the **only** arc-length oracle. The hard global arc-length error budget remains ≤0.25 logical px. `createSpatialPlacement` supplies independent leaf/shard/arc placement.
3. **This module:** `assets/template/src/path-core.js` exposes `FxPath` via CommonJS and browser global. It has no Pixi/DOM dependency, does not mutate caller data, and produces typed position/UV/index buffers.
4. Optional Emitters → Colors → Timeline contracts are loaded by each *effect's* explicit Blueprint, not required for pure geometry.

Runtime reference remains PixiJS **8.22.0** and `@esotericsoftware/spine-pixi-v8` **4.2.120**. No modification is made to the protected vendor files, offline Burn HTML, exporter, existing developer ZIP contents or bundled example.

## Versioned path and width format

Use the already-shipped `FxSpacing` path format:

```json
{
  "schemaVersion": 1,
  "closed": false,
  "segments": [
    {"p0":[0,0],"p1":[40,25],"p2":[90,40],"p3":[140,0]}
  ]
}
```

Every path coordinate uses *logical authoring pixels*, not CSS camera zoom, display pixels, or FPS. Segment anchors must join (≤1e-6 px), non-finite coordinates/unknown schema versions are rejected. A path may have at most 256 cubic segments before global quality caps; a closed path can be joined with the existing deterministic closure from FxSpacing.

The independent width profile is:

```json
{
  "start": 4,
  "middle": 24,
  "end": 2,
  "startTaper": 0.1,
  "endTaper": 0.95,
  "minVisiblePx": 0.25,
  "curve": null
}
```

- `start`, `middle`, `end` are **absolute full widths in logical px**; all nonnegative and independent. Both ends may intentionally taper to zero. Values may differ arbitrarily on an *open* path.
- `startTaper` and `endTaper` are independent multipliers in [0,1]. At 1, the corresponding tip is exactly zero; at 0, it retains the user-set full width. A smoothstep interpolation preserves the specified width at normalized path distance 0.5.
- `curve` is optional `FxCurves` v1 with `parameterKey:'widthMultiplier'`, `domain:'pathPosition'`, `inputUnit:'normalized-path'` and `valueUnit:'normalized'`. The curve multiplies the underlying width profile. Curves are **not** interpreted as arbitrary point indices or effect-frame times.
- `minVisiblePx` (0–100 px, default .25) applies at interior positive-width locations, not intentionally pointed start/end tips or a fully degenerate zero-width path.
- Closed paths require equal *evaluated* first/end width, and zero start/end taper. Nonmatching seam widths **fail** rather than making a visible seam; the first and last seam normal are equal.

This geometry format does not require user-defined GPU shader source. Rendering color, RGBA gradients and stylistic glow are defined by a specific effect, not by the shared geometry contract.

## Public API and how to create a continuous ribbon

- `FxPath.normalizeWidth(width)` and `widthAt(width,u)` reject invalid/default-less width values.
- `FxPath.smoothPath(path,strength)` with `strength` in [0,1] blends adjacent cubic control handles toward a common tangent while preserving segment join positions and each original handle length. It changes the authored curve, so **recompute** arc tables and placements after use.
- `FxPath.buildRibbon({path,width,quality:'balanced',sampleSpacingPx:4,curvatureSmoothing:0,edgeIrregularity:0,seed:11,miterLimit:2,tolerancePx:.25})` returns a single continuous strip (`positions:Float32Array`, `uvs:Float32Array`, `indices:Uint16Array`) plus the arc table, error bound, normalized width and diagnostic centerline samples.
- `sampleSpacingPx` is a geometric tessellation interval, **not** leaf spacing, branch gap, particle emission rate, or screen-pixel step. It samples by arc distance and always includes endpoints, midpoint and cubic segment boundaries.
- Smooth joins use averaged incoming/outgoing normals with a bounded miter multiplier (`miterLimit` 1–4). Sharp corners are bounded; they never produce an unbounded spike or infinite loop. Edge irregularity is seeded and fades to zero at the tips. UV U measures normalized cumulative arc length, V covers 0–1 across the full width.

For PixiJS 8.22.0, pass the returned three typed arrays **without rebuilding vertices** to `new PIXI.MeshGeometry({positions,uvs,indices,topology:'triangle-list'})` and then `new PIXI.Mesh({geometry,texture:PIXI.Texture.WHITE})` (or provide an effect-specific texture/shader). The same typed data is accepted by the pinned WebGL1, WebGL2 and WebGPU implementations, as proved by the isolated browser fixture, not a simulated renderer. Actual GPU contexts must be checked, not inferred from a requested preference.

## Branch graph and independently seeded procedural variants

`FxPath.buildGraph({schemaVersion:1,root:{id:'stem',path,width},branches:[...],seed,quality,sampleSpacingPx,edgeIrregularity,miterLimit,curvatureSmoothing})` builds a bounded **directed tree** of ribbon strips. Each branch has stable `id`, `parentId`, `attachDistancePx`, `path`, optional `width` and `widthRatio` (0.01–4, default .6). Root and child IDs must be unique. Cycles, missing parents and attachment past the parent's true path length are rejected.

A child path uses *parent-local tangent/normal coordinates* starting at [0,0]. The origin is placed at exactly `FxSpacing.pointAtDistance(parentTable,attachDistancePx)`. Parent-before-child output order is deterministic independent of the input array order, even for grandchildren. By default the child start width is the **parent's width at the physical attachment distance × branch width ratio**, not the parent's width at the number of polygons.

`FxPath.generateBranches({parentId,parentPath,seed,branchCount,branchSpacingPx,branchLengthPx,spreadDeg,widthRatio,countRandomness,curvatureRandomness,thicknessRandomness,intervalRandomness})` produces bounded, stable child descriptors. The four variation classes use **independently salted PRNG streams**: changing curvature randomness cannot change branch positions or thickness; changing thickness cannot change count/spacing. The branch gap is measured in logical arc-length pixels, not in subdivision count.

For leaves, sparks, shards or attached arcs use `FxPath.placeElements({path,spacingPx,seed,mode:'even'|'random'|'stratified'|'clustered',jitter,minSpacing,maxSpacing,maxPoints,spacingCurve})`. This function delegates directly to `FxSpacing.createSpatialPlacement`, so changing the number of path subdivisions **does not** change placement distances. Different element types use **independent spacing controls** (for example branches 30 px and leaves 18 px); the implementation must use a different seed stream per effect category.

A branch is a **separate attached continuous strip**. At translucent or very acute junctions there may be overlapping alpha rather than a watertight mesh union; a specific FX requiring seamless translucent branch fusions needs an independently reviewed junction tessellator. Do not claim geometric Boolean union here.

## Quality budgets (per complete path graph)

| Quality | Max cubic segments (sum) | Max child branches | Max vertices (sum) | Max triangles (sum) |
| --- | ---: | ---: | ---: | ---: |
| Low | 64 | 8 | 2,048 | 2,048 |
| Balanced | 128 | 32 | 8,192 | 8,192 |
| High | 256 | 64 | 16,384 | 16,384 |

Input caps are checked before potentially large allocations; global accumulated vertices/triangles/segments are checked after **each** branch. Invalid or excessive geometry **throws** rather than silently dropping branches, creating unbounded meshes, or changing quality during rendering. Vertices fit in unsigned 16-bit indices.

## Edge cases and testable outcomes

- **Zero-length or everywhere-zero-width path:** returns empty geometry (no invisible triangles, no visible pixels, no exceptions).
- **Sharp corners:** bounded miter; `curvatureSmoothing` optionally makes tangent directions continuous; geometry is regenerated after handles change.
- **Self-intersections:** deterministic overdraw; no implicit clipping or physics, no infinite loop. Explicit mesh topological union is out of scope.
- **Closed curve:** seam positions/normals agree; no duplicate placed element at the seam; explicit width discontinuity rejected.
- **Camera:** geometry uses logical coordinates; 50/100/200% preview CSS zoom must not change exported isolated RGBA PNG bytes.
- **Seed:** same seed/settings produce identical arrays and same-backend PNG, while separate stream settings affect only their declared parameter family.
- **Exports:** future specialized editor packages may include `FxPath.mjs` after importing `FxCurves.mjs` and `FxSpacing.mjs`, using the **exact source** already tested. Neither the reference Burn Lab developer ZIP nor its shipped JS is modified merely to expose a module it does not use.

## Verification: RED → GREEN, real backend and optional ESM parity

```sh
node scripts/test_path_geometry.cjs
node scripts/test_path_export.cjs
node scripts/test_path_browser.cjs --backend webgl --output OUT/webgl2
node scripts/test_path_browser.cjs --backend webgl --webgl1 --output OUT/webgl1
node scripts/test_path_browser.cjs --backend webgpu --output OUT/webgpu
python scripts/verify_project.py assets/template --html assets/Spine_Burn_Lab.html
```

The Node suite checks independent taper, width curves, closed seam, sharp/degenerate/self-crossing geometry, true arc placement, seeded branch count/curvature/thickness/gap changes, branch cycles, cap overflow and pure input validation. The browser fixture `scripts/fixtures/path-qa.html` renders real Pixi `MeshGeometry`, extracts **transparent PNGs** (not CSS-composited canvas screenshots), checks actual renderer/GL version, size, alpha, middle width, visible branch count, seed parity and exported PNG invariance under 50/100/200% preview zoom. Its PNG decoder is independent of the rendering engine. The ESM test imports exact source modules for optional WebGL/WebGPU developer handoff, with original pins.

**Acceptance boundary:** This proves the reusable *geometry module* and standalone Pixi mesh fixture, **not** a complete Vine Growth (#33), Chain Lightning (#38), Sword Slash (#42), UI editor, or developer ZIP of a new effect. Those are separately approved effects with their own preview/PNG/ZIP parity and artist-control evidence requirements.
