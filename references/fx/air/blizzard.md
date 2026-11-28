# AIR-03 — Blizzard

**Status:** specification-only. [Issue #25](https://github.com/maximsokal/pixi-spine-fx-lab/issues/25); [reviewed B01–B06 plan](https://github.com/maximsokal/pixi-spine-fx-lab/issues/25#issuecomment-7240625604). B02 numerical kernel, B03 runtime, B04 editor and B05 PNG/developer ZIP code are implemented; actual browser/GPU/export acceptance remains unverified. Build from a complete checkout with `python scripts/build_blizzard_editor.py --output Blizzard_Lab.html`. Run `node --test scripts/test_blizzard_core.cjs` from a full checkout.

## Numerical and visual contract

512×512 logical px; authored 60 FPS. Default 60-frame pre-rolled loop, optional scenic 600–960-frame loops, causal 40-frame one-shot (no pre-roll), final ten frames fade to a transparent last authored frame; layer time offsets additionally respect their local terminal fade. PNG samples are half-open, i/60. Loop seam is checked separately at N/60.

75 births/s total per emitter at density .75, effective rate particleRate*density/.75, further modulated by emissionRateCurve. Deterministic 80/20 streak/foreground allocation by event index; toggles never redistribute events. Storm intensity modulates opacity independently. Whiteout is disabled by default and does not affect particle motion. Zero rate or density means no particle births, but explicitly enabled whiteout can remain visible.

Angle is clockwise in screen space from +X. Zero wind stops advection; bounded lifetimes 3s streak / 1.2s foreground do not divide by speed. Drift-speed curve changes integrated displacement. Seeded bounded turbulence, independent layer seeds, and local support edge fade/clipping precede emitter transforms. Wrap only outside visible local support, with 864px padded wind-space field. Use physical arc-length launch sites on a perpendicular line. Spatial jitter is 0–.65 of the nearest half-gap, not ±65% of the raw gap or a change to FxSpacing's shared cap. Preserve site order. Rate edits change timestamps, spacing edits change positions.

Maximum four emitters, stable IDs, independent layer enable/visibility, XY/rotation, time offset, seed, alpha/blend, world/local or Spine bone/slot/attachment anchors and inheritance. Missing anchor hides only the affected layer. Natural, stylized and magical palettes use editable RGBA stops. Curves preserve v1 handles and domains. Live budget across all emitters includes whiteout quads; 512/2048/4096. Reject over-budget or invalid configurations before preview replacement. 4096 events per emitter; no silent truncation. Actual simultaneous live counts matter, not total events over a scenic period. The CPU guard sums conservative per-layer maxima from complete periods plus circular birth-window counts, including closed-window floating-point slack; it may refuse configurations whose layer peaks never coincide. The budget includes alpha-zero live particles. Drift displacement uses a bounded midpoint integral table split at authored curve keys; not exact analytical integration for arbitrary Bezier curves. Artist-edited mismatched loop endpoints or stepped curves can introduce intentional discontinuities. Bounds are authored local/offset bounds; Spine anchor resolution is a B03 renderer concern.

B03 `assets/blizzard/src/blizzard-runtime.js` exposes `FxBlizzardRuntime.createBlizzard` and `maskRGBA`. Owns two stage sibling groups flanking the identity Spine host, three layer-specific ParticleContainers per emitter (whiteout is a single textured quad), straight white-RGB supersampled masks, shared particle pool, bounds and stable missing-anchor diagnostics. The model must already be placed in crop-stage coordinates: world anchors receive `worldOffset` once; Spine anchors use model-to-stage transforms. Inherited anchor x/y follow their own local/world space through the base anchor; ordinary emitter/layer transform offsets are rotated by authored base rotation. Bounds enclose visible textured quads, not exact nonzero pixels. Configure stages new owners and particle allocations before replacing the accepted configuration; it does not guarantee rollback of arbitrary renderer/GPU failures after commit. Run `node --test scripts/test_blizzard_runtime.cjs` with the pinned vendors. B04 and B05 integrate the same module into preview, isolated PNG and both developer ZIPs with unchanged pinned vendors. No GPU verification, runnable editor or release status yet.

## B04 offline authoring candidate

The independent editor uses all fifteen scalar controls, six shared editable curve widgets, RGBA palette, named emitters and layer/anchor controls, absolute-time forward/reverse playback, local/world anchor dragging, preview-only background/zoom, and versioned JSON settings. It embeds the approved Doctor head sample and pinned vendor/license content via the standard-library Python builder. The builder refuses wrong pins, duplicate/missing markers and missing inputs; output must be HTML outside the protected assets subtree. No CDN or new package dependency.

Asset import supports one 4.2.x JSON/SKEL plus atlas and uniquely matched texture pages; malformed UTF-8 JSON/atlas, nonnumeric patch version, missing/ambiguous/unsafe page paths, duplicate selected texture basenames and over-budget selections are rejected. Input bytes capped at 192 MiB; decoded textures checked after decode for 8192px per axis and aggregate 48 Mi pixels (these are engineering guardrails, not a decompression-bomb-proof decoder). Imported texture sources are separately owned and disposed. A candidate scene is loaded and posed before replacing the active scene; invalid preset settings are checked before configure, and configure errors attempt restoration. Arbitrary GPU/device errors are not transactional guarantees. The preset contains effect settings only; the chosen Spine asset/skin/animation remain a separate authoring context for B05.

`FxBlizzardPose` uses the same half-open clock as the numerical core, direct fractional-time seeks for nonphysics and deterministic 60Hz fixed steps for physics including setup pose, with reset on backward seek, skin/animation changes and recovery after exceptions. It will be shared by B05. Actual WebGL/WebGPU selection is reported, not inferred from requested mode. PNG/Developer ZIP controls are enabled by B05.

Run `python scripts/test_blizzard_builder.py` and `node --test scripts/test_blizzard_editor.cjs` in a full checkout. Synthetic builder and actual pinned CPU/editor session/DOM fixture tests do not certify real browser rendering, real sample startup, interactive SVG curve widgets, texture uploads, or exports. B06 acceptance remains required.

## B05 isolated PNG and developer packages

The PNG exporter snapshots normalized settings, accepted asset mapping and actual backend. It creates a separate 512x512 transparent scene, preserves Spine pose for anchors while excluding its rendered pixels, samples i/60, uses an explicit untrimmed crop and omits preview camera/background/handles. The manifest includes authored and exported frame counts, terminal time, settings, backend and asset mapping. PNG data budget 192 MiB; stored ZIP including headers 256 MiB; individual entries 128 MiB. A backend mismatch or unresolved anchor fails closed. Cancel checks surround every awaited frame/encode/ZIP boundary and after isolated scene disposal, before publishing any result. ZIP CRC work on an individual entry is synchronous.

PixiJS 8.22.0 WebGL texture.getPixels returns raw premultiplied readback (unpremultiply disabled in pinned GlTextureSystem); WebGPU texture.getPixels reads straight RGBA via Canvas2D getImageData. The exporter generates an explicit crop texture, reads it, and disposes it even on failure. PNG codec converts premultiplied RGB once, clears RGB at alpha zero, emits color type 6 / 8-bit RGBA with CRC-checked chunks and deflate. This does not certify actual backend alpha or additive-blend parity; a straight-alpha image cannot represent arbitrary additive emission on every background. Actual raster and fringe tests are B06.

Both developer ZIPs include settings, asset/skin/animation mapping, unchanged embedded core/runtime/pose source, licenses, pinned npm dependencies and a Vite example. They also include the embedded Pixi/Spine browser scripts and local HTTP demo (python -m http.server 8000 --directory public, open /offline.html); no npm/network download required for that demo. The original atlas and referenced textures retain their bytes; deterministic portable aliases map raw atlas page names to unique case-insensitive paths. Unreferenced textures are omitted. Actual offline demo execution and Vite build remain NOT RUN.

Tests: node --test scripts/test_blizzard_export.cjs. CPU codec/ZIP, independent CRC and decoded byte fixtures, settings/module archive parity, readback crop contract and cancellation after cleanup. No browser/GPU pixels claimed.

## Machine-checkable Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.air.blizzard",
  "effectVersion": "0.1.0",
  "presetSchemaVersion": 1,
  "category": "air",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "Intense wind-driven snowstorm: diagonal fast streaks, turbulent foreground flakes and optional independent whiteout, distinct from gentle snowfall.",
  "phases": [
    {
      "id": "approach",
      "at": 0,
      "look": "Pre-rolled storm in loop; causal empty particle field in one-shot"
    },
    {
      "id": "surge",
      "at": 0.3,
      "look": "Peak rate and storm intensity"
    },
    {
      "id": "ease",
      "at": 0.75,
      "look": "Easing wind-driven field"
    },
    {
      "id": "end",
      "at": 1,
      "look": "Exact periodic seam or transparent one-shot terminal"
    }
  ],
  "layers": [
    {
      "id": "streaks",
      "kind": "particles",
      "position": "behind",
      "purpose": "Fast diagonal elongated snow streaks"
    },
    {
      "id": "foreground",
      "kind": "particles",
      "position": "front",
      "purpose": "Turbulent foreground flakes"
    },
    {
      "id": "whiteout",
      "kind": "geometry",
      "position": "front",
      "purpose": "Optional bounded whiteout quad; disabled by default"
    }
  ],
  "emitterAnchors": [
    {
      "id": "streaks",
      "space": "world/local/Spine",
      "onMissing": "hide-only-this-layer"
    },
    {
      "id": "foreground",
      "space": "world/local/Spine",
      "onMissing": "hide-only-this-layer"
    },
    {
      "id": "whiteout",
      "space": "world/local/Spine",
      "onMissing": "hide-only-this-layer"
    }
  ],
  "parameters": [
    {
      "key": "particleRate",
      "type": "number",
      "default": 75,
      "unit": "events-per-second",
      "controlGroup": "Storm",
      "exportPath": "settings.particleRate",
      "min": 0,
      "max": 400,
      "step": 1
    },
    {
      "key": "windSpeed",
      "type": "number",
      "default": 200,
      "unit": "logical-pixels-per-second",
      "controlGroup": "Motion",
      "exportPath": "settings.windSpeed",
      "min": 0,
      "max": 900,
      "step": 1
    },
    {
      "key": "windVariance",
      "type": "number",
      "default": 0.6,
      "unit": "normalized-0-1",
      "controlGroup": "Motion",
      "exportPath": "settings.windVariance",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "streakLength",
      "type": "number",
      "default": 20,
      "unit": "logical-pixels",
      "controlGroup": "Storm",
      "exportPath": "settings.streakLength",
      "min": 2,
      "max": 90,
      "step": 1
    },
    {
      "key": "density",
      "type": "number",
      "default": 0.75,
      "unit": "normalized-0-1",
      "controlGroup": "Storm",
      "exportPath": "settings.density",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "angle",
      "type": "number",
      "default": 35,
      "unit": "degrees-clockwise-from-positive-x",
      "controlGroup": "Motion",
      "exportPath": "settings.angle",
      "min": -90,
      "max": 90,
      "step": 1
    },
    {
      "key": "nearGapPx",
      "type": "number",
      "default": 8,
      "unit": "logical-pixels",
      "controlGroup": "Spacing",
      "exportPath": "settings.nearGapPx",
      "min": 1,
      "max": 75,
      "step": 1
    },
    {
      "key": "spatialJitter",
      "type": "number",
      "default": 0.25,
      "unit": "fraction-of-nearest-half-gap",
      "controlGroup": "Spacing",
      "exportPath": "settings.spatialJitter",
      "min": 0,
      "max": 0.65,
      "step": 0.01
    },
    {
      "key": "spatialMode",
      "type": "enum",
      "default": "even",
      "unit": "mode",
      "controlGroup": "Spacing",
      "exportPath": "settings.spatialMode",
      "choices": [
        "even",
        "random",
        "clustered",
        "stratified"
      ]
    },
    {
      "key": "seed",
      "type": "integer",
      "default": 7321,
      "unit": "int32",
      "controlGroup": "Advanced",
      "exportPath": "settings.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "mode",
      "type": "enum",
      "default": "loop",
      "unit": "mode",
      "controlGroup": "Timing",
      "exportPath": "settings.mode",
      "choices": [
        "loop",
        "oneShot"
      ]
    },
    {
      "key": "durationFrames",
      "type": "integer",
      "default": 60,
      "unit": "frames-at-60fps",
      "controlGroup": "Timing",
      "exportPath": "settings.durationFrames",
      "min": 40,
      "max": 960,
      "step": 1,
      "help": "40 for oneShot; 60 or 600–960 for loop"
    },
    {
      "key": "exportFrames",
      "type": "integer",
      "default": 60,
      "unit": "frames-at-60fps",
      "controlGroup": "Timing",
      "exportPath": "settings.exportFrames",
      "min": 1,
      "max": 3600,
      "step": 1
    },
    {
      "key": "quality",
      "type": "enum",
      "default": "balanced",
      "unit": "profile",
      "controlGroup": "Advanced",
      "exportPath": "settings.quality",
      "choices": [
        "low",
        "balanced",
        "high"
      ]
    },
    {
      "key": "style",
      "type": "enum",
      "default": "natural",
      "unit": "style",
      "controlGroup": "Color",
      "exportPath": "settings.style",
      "choices": [
        "natural",
        "stylized",
        "magical"
      ]
    }
  ],
  "controlGroups": [
    "Storm",
    "Motion",
    "Spacing",
    "Advanced",
    "Timing",
    "Color"
  ],
  "requiredContracts": [
    "parameters",
    "curves",
    "spacing",
    "emitters",
    "colors",
    "timeline"
  ],
  "curves": [
    {
      "id": "storm-intensity",
      "key": "stormIntensityCurve",
      "domain": "effectTime",
      "contract": "curves",
      "keys": [
        [
          0,
          0.5
        ],
        [
          0.3,
          1
        ],
        [
          0.75,
          0.8
        ],
        [
          1,
          0.5
        ]
      ]
    },
    {
      "id": "drift-speed",
      "key": "driftSpeedCurve",
      "domain": "particleAge",
      "contract": "curves",
      "keys": [
        [
          0,
          1
        ],
        [
          0.7,
          1.1
        ],
        [
          1,
          0.8
        ]
      ]
    },
    {
      "id": "whiteout-alpha",
      "key": "whiteoutAlphaCurve",
      "domain": "effectTime",
      "contract": "curves",
      "keys": [
        [
          0,
          0.1
        ],
        [
          0.4,
          0.5
        ],
        [
          1,
          0.1
        ]
      ]
    },
    {
      "id": "emission-rate",
      "key": "emissionRateCurve",
      "domain": "effectTime",
      "contract": "curves",
      "keys": [
        [
          0,
          1
        ],
        [
          0.3,
          1.5
        ],
        [
          0.75,
          1.2
        ],
        [
          1,
          1
        ]
      ]
    },
    {
      "id": "spacing",
      "key": "spacingCurve",
      "domain": "pathPosition",
      "contract": "curves",
      "keys": [
        [
          0,
          1
        ],
        [
          1,
          1
        ]
      ]
    },
    {
      "id": "particle-alpha",
      "key": "particleAlphaCurve",
      "domain": "particleAge",
      "contract": "curves",
      "keys": [
        [
          0,
          0
        ],
        [
          0.12,
          1
        ],
        [
          0.85,
          1
        ],
        [
          1,
          0
        ]
      ]
    }
  ],
  "spacing": {
    "enabledByDefault": true,
    "contract": "spacing",
    "modes": [
      "even",
      "random",
      "clustered",
      "stratified"
    ],
    "note": "Independent time schedule and perpendicular arc-length sites. Jitter is fraction of nearest half-gap, not shared spacing jitter."
  },
  "palettes": [
    {
      "id": "storm-color",
      "key": "palette",
      "domain": "particleAge",
      "contract": "colors",
      "stops": [
        [
          0,
          "#FFFFFF",
          1
        ],
        [
          1,
          "#B8D5F2",
          1
        ]
      ]
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "Stable emitter/layer/event streams; no global Math.random"
  },
  "rendering": {
    "approach": "composition",
    "strategy": "Proposed pooled streak and flake ParticleContainer batches plus optional bounded whiteout quad; local support and edge fade before transforms",
    "backends": [
      "webgl1",
      "webgl2",
      "webgpu"
    ],
    "runtimePins": {
      "pixi": "8.22.0",
      "spine": "4.2.120"
    },
    "fallback": "Explicit WebGL fallback; no silent missing layer",
    "shaderStatus": "not implemented or tested"
  },
  "qualityBudgets": {
    "low": {
      "particlesAndQuads": 512,
      "eventsPerEmitter": 4096
    },
    "balanced": {
      "particlesAndQuads": 2048,
      "eventsPerEmitter": 4096
    },
    "high": {
      "particlesAndQuads": 4096,
      "eventsPerEmitter": 4096
    }
  },
  "tests": {
    "verified": false,
    "evidence": [],
    "required": [
      "Rate versus spacing independent event and position witnesses",
      "Seeded pre-roll seam, causal one-shot, terminal transparency, zero wind and speed extremes",
      "Independent layer enable, transforms, timing, seeds, and anchor failure isolation",
      "Actual global live primitive and event caps; no silent truncation",
      "Same-backend camera-invariant PNG straight-alpha and exact crop",
      "All scalar/curve controls, palettes, both offline ZIPs and honest actual backend evidence"
    ]
  },
  "outOfScope": [
    "Volumetric 3D weather",
    "Global postprocess whiteout",
    "Automatic runtime upgrades",
    "Unverified render/export support"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "particleRate": "settings.particleRate",
      "windSpeed": "settings.windSpeed",
      "windVariance": "settings.windVariance",
      "streakLength": "settings.streakLength",
      "density": "settings.density",
      "angle": "settings.angle",
      "nearGapPx": "settings.nearGapPx",
      "spatialJitter": "settings.spatialJitter",
      "spatialMode": "settings.spatialMode",
      "seed": "settings.seed",
      "mode": "settings.mode",
      "durationFrames": "settings.durationFrames",
      "exportFrames": "settings.exportFrames",
      "quality": "settings.quality",
      "style": "settings.style"
    },
    "preview": "not-implemented",
    "pngBake": "not-implemented",
    "developerZip": "not-implemented",
    "invariant": "One shared numerical and rendering implementation for preview, isolated bake and both ZIPs"
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject",
    "policy": "Reject unknown versions; explicit migration only"
  },
  "implementation": {
    "status": "specification-only",
    "sourceFiles": [],
    "notes": "B01 blueprint through B05 editor/runtime/export sources present; B06 acceptance pending. No reference implementation or export certification."
  }
}
```
