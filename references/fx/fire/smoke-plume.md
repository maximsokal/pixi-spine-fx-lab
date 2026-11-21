# FIRE-05 — Smoke Plume: independent soft-alpha FX Lab

**Baseline:** persistent 120-frame loop at 60fps (pre-rolled warm source), or stop with a 60-frame fade, or 40 emission frames followed by a full 60-frame fade (100-frame one-shot). 512×512 straight-alpha. Smoke source defaults 18 puffs/s, 12px, expansion 2.5×, upward 55px/s, swirl .4, density .65, mouth gap 16px and nozzle width 64px; all editable. No opaque rectangular texture borders.

## Versioned Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.fire.smoke-plume",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "fire",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "Persistent layered soft organic plume with warm-started seamless 120-frame loop, or 60-frame stop fade, or 40-frame birth + 60-frame fade (100-frame one-shot). Smoothly lofts, broadens, curls, becomes transparent, without hard rectangles or dark PMA seams. Seeded 18 puffs per second with no hidden lines or unrelated fire blast geometry.",
  "phases": [
    {
      "id": "established",
      "at": 0,
      "look": "Warm-started loop already has multiple gray, soft alpha puffs at first frame, not a cold empty source"
    },
    {
      "id": "lofting",
      "at": 0.25,
      "look": "Dense small core puffs rise and broaden into translucent mid-size irregular lobes"
    },
    {
      "id": "broadening",
      "at": 0.75,
      "look": "Older puffs diffuse and cool to charcoal while fresh emission continues near source"
    },
    {
      "id": "seam",
      "at": 1,
      "look": "Seamlessly equal frame zero at loop boundary; stop/burst presets separately reach full transparent fade end"
    }
  ],
  "layers": [
    {
      "id": "core",
      "kind": "particles",
      "position": "emitter-relative-local",
      "purpose": "Dense, irregular alpha-feathered organic puffs; on by default, normal source-over blending"
    },
    {
      "id": "wisps",
      "kind": "particles",
      "position": "emitter-relative-local",
      "purpose": "Larger, lower-opacity turbulent wisps with independent enable/XY/rotation/alpha/blend; on by default"
    },
    {
      "id": "ash",
      "kind": "particles",
      "position": "emitter-relative-local",
      "purpose": "Optional fine ash flecks, off by default; no invisible lines/rays"
    }
  ],
  "emitterAnchors": [
    {
      "id": "world",
      "space": "world",
      "onMissing": "n/a"
    },
    {
      "id": "skeleton",
      "space": "Spine-skeleton-local",
      "onMissing": "hide selected emitter and diagnose"
    },
    {
      "id": "bone",
      "space": "Spine-bone-local",
      "onMissing": "hide selected emitter and diagnose"
    },
    {
      "id": "slot",
      "space": "Spine-slot-local",
      "onMissing": "hide selected emitter and diagnose"
    },
    {
      "id": "attachment",
      "space": "Spine-active-attachment-centroid-local",
      "onMissing": "hide selected emitter and diagnose"
    }
  ],
  "parameters": [
    {
      "key": "rate",
      "type": "number",
      "default": 18,
      "min": 0,
      "max": 120,
      "step": 1,
      "unit": "puffs-per-second",
      "controlGroup": "Emission / lifecycle / fade",
      "exportPath": "settings.rate"
    },
    {
      "key": "initialSize",
      "type": "number",
      "default": 12,
      "min": 2,
      "max": 80,
      "step": 0.5,
      "unit": "logical-px",
      "controlGroup": "Puff geometry, lofting and density",
      "exportPath": "settings.initialSize"
    },
    {
      "key": "expansion",
      "type": "number",
      "default": 2.5,
      "min": 1,
      "max": 6,
      "step": 0.05,
      "unit": "multiplier",
      "controlGroup": "Puff geometry, lofting and density",
      "exportPath": "settings.expansion"
    },
    {
      "key": "riseSpeed",
      "type": "number",
      "default": 55,
      "min": 0,
      "max": 250,
      "step": 1,
      "unit": "logical-px-per-second",
      "controlGroup": "Puff geometry, lofting and density",
      "exportPath": "settings.riseSpeed"
    },
    {
      "key": "swirl",
      "type": "number",
      "default": 0.4,
      "min": 0,
      "max": 1,
      "step": 0.01,
      "unit": "normalized",
      "controlGroup": "Puff geometry, lofting and density",
      "exportPath": "settings.swirl"
    },
    {
      "key": "density",
      "type": "number",
      "default": 0.65,
      "min": 0,
      "max": 1,
      "step": 0.01,
      "unit": "normalized-opacity",
      "controlGroup": "Puff geometry, lofting and density",
      "exportPath": "settings.density"
    },
    {
      "key": "lifetimeSeconds",
      "type": "number",
      "default": 2,
      "min": 0.1,
      "max": 10,
      "step": 0.1,
      "unit": "seconds",
      "controlGroup": "Emission / lifecycle / fade",
      "exportPath": "settings.lifetimeSeconds"
    },
    {
      "key": "windX",
      "type": "number",
      "default": 0,
      "min": -250,
      "max": 250,
      "step": 1,
      "unit": "logical-px-per-second",
      "controlGroup": "Puff geometry, lofting and density",
      "exportPath": "settings.windX"
    },
    {
      "key": "nozzleWidth",
      "type": "number",
      "default": 64,
      "min": 0,
      "max": 500,
      "step": 1,
      "unit": "logical-px",
      "controlGroup": "Puff geometry, lofting and density",
      "exportPath": "settings.nozzleWidth"
    },
    {
      "key": "originGap",
      "type": "number",
      "default": 16,
      "min": 0,
      "max": 80,
      "step": 0.25,
      "unit": "logical-px",
      "controlGroup": "Puff geometry, lofting and density",
      "exportPath": "settings.originGap"
    },
    {
      "key": "spatialJitter",
      "type": "number",
      "default": 0.2,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "fraction-of-gap",
      "controlGroup": "Puff geometry, lofting and density",
      "exportPath": "settings.spatialJitter"
    },
    {
      "key": "intervalJitter",
      "type": "number",
      "default": 0.15,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "fraction-of-interval",
      "controlGroup": "Emission / lifecycle / fade",
      "exportPath": "settings.intervalJitter"
    },
    {
      "key": "emissionFrames",
      "type": "integer",
      "default": 40,
      "min": 1,
      "max": 600,
      "step": 1,
      "unit": "frames-at-60fps",
      "controlGroup": "Emission / lifecycle / fade",
      "exportPath": "settings.emissionFrames"
    },
    {
      "key": "stopFrame",
      "type": "integer",
      "default": 60,
      "min": 1,
      "max": 600,
      "step": 1,
      "unit": "frames-at-60fps",
      "controlGroup": "Emission / lifecycle / fade",
      "exportPath": "settings.stopFrame"
    },
    {
      "key": "fadeFrames",
      "type": "integer",
      "default": 60,
      "min": 1,
      "max": 600,
      "step": 1,
      "unit": "frames-at-60fps",
      "controlGroup": "Emission / lifecycle / fade",
      "exportPath": "settings.fadeFrames"
    },
    {
      "key": "durationFrames",
      "type": "integer",
      "default": 120,
      "min": 1,
      "max": 1200,
      "step": 1,
      "unit": "frames-at-60fps",
      "controlGroup": "Emission / lifecycle / fade",
      "exportPath": "settings.durationFrames"
    },
    {
      "key": "exportFrames",
      "type": "integer",
      "default": 120,
      "min": 1,
      "max": 3600,
      "step": 1,
      "unit": "frames-at-60fps",
      "controlGroup": "Emission / lifecycle / fade",
      "exportPath": "settings.exportFrames"
    },
    {
      "key": "seed",
      "type": "integer",
      "default": 217,
      "min": -2147483648,
      "max": 2147483647,
      "step": 1,
      "unit": "int32",
      "controlGroup": "Emission / lifecycle / fade",
      "exportPath": "settings.seed"
    },
    {
      "key": "minGapSeconds",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 2,
      "step": 0.01,
      "unit": "seconds",
      "controlGroup": "Emission / lifecycle / fade",
      "exportPath": "settings.minGapSeconds"
    },
    {
      "key": "curlScale",
      "type": "number",
      "default": 16,
      "min": 0,
      "max": 150,
      "step": 0.5,
      "unit": "logical-px",
      "controlGroup": "Puff geometry, lofting and density",
      "exportPath": "settings.curlScale"
    },
    {
      "key": "spacingCurveEnabled",
      "type": "boolean",
      "default": false,
      "unit": "enabled",
      "controlGroup": "Emission and spatial distribution",
      "exportPath": "settings.spacingCurveEnabled"
    },
    {
      "key": "mode",
      "type": "enum",
      "default": "loop",
      "choices": [
        "loop",
        "stop",
        "burst"
      ],
      "unit": "enum",
      "controlGroup": "Emission / lifecycle / fade",
      "exportPath": "settings.mode"
    },
    {
      "key": "style",
      "type": "enum",
      "default": "natural",
      "choices": [
        "natural",
        "stylized",
        "magical"
      ],
      "unit": "enum",
      "controlGroup": "Emission and spatial distribution",
      "exportPath": "settings.style"
    },
    {
      "key": "quality",
      "type": "enum",
      "default": "balanced",
      "choices": [
        "low",
        "balanced",
        "high"
      ],
      "unit": "enum",
      "controlGroup": "Emission and spatial distribution",
      "exportPath": "settings.quality"
    },
    {
      "key": "spatialMode",
      "type": "enum",
      "default": "even",
      "choices": [
        "even",
        "random",
        "clustered"
      ],
      "unit": "enum",
      "controlGroup": "Emission and spatial distribution",
      "exportPath": "settings.spatialMode"
    },
    {
      "key": "emissionMode",
      "type": "enum",
      "default": "time",
      "choices": [
        "time",
        "distance",
        "both"
      ],
      "unit": "enum",
      "controlGroup": "Emission and spatial distribution",
      "exportPath": "settings.emissionMode"
    }
  ],
  "controlGroups": [
    "Emission / lifecycle / fade",
    "Puff geometry, lofting and density",
    "Emission and spatial distribution",
    "Independent emitters",
    "Optional moving emitter",
    "Selected emitter anchor",
    "Selected emitter layers",
    "Editable gray-to-charcoal RGBA smoke gradient",
    "Puff size, opacity, rise and emission curves",
    "Preset and export"
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
      "id": "emission",
      "key": "emissionRateCurve",
      "domain": "emitterTime",
      "contract": "curves"
    },
    {
      "id": "puff-size",
      "key": "sizeCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "puff-opacity",
      "key": "opacityCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "puff-rise-speed",
      "key": "riseCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "mouth-gap",
      "key": "spacingCurve",
      "domain": "pathPosition",
      "contract": "curves"
    }
  ],
  "spacing": {
    "enabledByDefault": true,
    "contract": "spacing",
    "modes": [
      "time",
      "distance",
      "both"
    ],
    "note": "Default time emission 18 puffs/s is independent of source motion. Nozzle width 64px and origin gap 16px distribute actual birth positions across stationary source cross-section (gap 0 means co-located); seed-driven clustered/random variants. Moving path distance/both uses FxSpacing arc-length accurate to <=0.25px. Stationary distance/both is disabled/diagnosed. Time jitter is independent from physical origin spacing and puff rise velocity; custom rate curve uses emitterTime domain."
  },
  "palettes": [
    {
      "id": "gray-to-charcoal",
      "key": "palette",
      "domain": "particleAge",
      "contract": "colors",
      "defaultStops": [
        "#A6A4A5",
        "#66636A",
        "#2D3037"
      ],
      "alpha": "Editable per-stop straight alpha; opacity curve fades each puff from alpha zero to partial to zero"
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "Deterministic timeline and independent per-puff (ID, seed, event index) feature streams. Loop duplicates previous cycle births as warm pre-roll, with event-local hashes so t=0 equals t=cycleDuration; changing siblings cannot alter existing streams."
  },
  "rendering": {
    "approach": "particles",
    "strategy": "Pure DOM-free smoke birth/lifetime scene model with analytic deterministic rise-speed curve integral and curl. PixiJS v8 renderer owns exactly four 96x96 Canvas-backed RGBA8 soft organic alpha masks and bounded pools of reusable Sprite instances (normal blend), with optional owned Ash Graphics. Sprite texture is shared and never regenerated per frame. No full-screen blur, shared Spine filters, explicit shader or ParticleContainer dependence.",
    "backends": [
      "webgl1",
      "webgl2",
      "webgpu"
    ],
    "runtimePins": {
      "pixi": "8.22.0",
      "spine": "4.2.120"
    },
    "fallback": "Report real renderer backend; never claim hardware performance from headless Chromium/SwiftShader. Full emitted geometry is conservatively bounded and export rejects cropping. Optional fit exhaustively checks exported frames.",
    "shaderStatus": "No new shader; soft multi-lobe alpha images synthesized locally and owned. Straight RGB passed to Pixi's alpha compositing. Blur/experimental ParticleContainer deferred."
  },
  "qualityBudgets": {
    "low": {
      "maxPuffs": 64,
      "maxPrimitives": 64
    },
    "balanced": {
      "maxPuffs": 192,
      "maxPrimitives": 192
    },
    "high": {
      "maxPuffs": 384,
      "maxPrimitives": 384
    }
  },
  "tests": {
    "verified": true,
    "evidence": [
      "scripts/test_smoke_core.cjs",
      "scripts/test_smoke_editor.cjs",
      "scripts/test_smoke_evidence.cjs",
      "scripts/test_smoke_lifecycle.cjs",
      "scripts/test_smoke_export.cjs",
      "scripts/test_smoke_developer.cjs"
    ],
    "required": [
      "Numeric exact 120 frame seam and pre-roll warm start, 60 frame stop alpha fade and cold 40+60=100 frame one-shot no truncation",
      "All 26 root artist parameters independently change output or visibly disabled under documented mode; all 5 curves visibly/numerically affect time/age/spacing domain",
      "Layer core, wisps and ash independent toggle/alpha/XY/rotation/blend; all disabled yields empty transparent output, no beams or unrelated rays",
      "Four stable independent emitters, deterministic RNG and reordered/sibling unchanged, optional moving source and nozzle, animated Spine bone/slot/attachment and missing anchor isolated",
      "Four 96x96 procedural masks generated once: zero alpha on borders and corners, soft organic irregular center, no hard rectangles or dark PMA fringes with overlapping alpha",
      "Actual WebGL1/2/WebGPU real browser renders 512x512 RGBA PNG, CSS zoom and checkerboard do not alter exported RGBA, backends recorded and verified",
      "One 120 frame default looping PNG ZIP + 100 frame one-shot and sampled frames on all backends, CRC and straight RGBA8; optional Stop fade; no-crop precheck or Fit",
      "Cancellation and live editor time/pose restoration; WebGL and WebGPU developer ZIP builds/ESM parity and real pinned Vite browser examples",
      "FX-CORE-07 phase/parameter/screenshot evidence tied to final pushed main SHA; preserve Burn protected vendor and previous Torch/Explosion/Fireball/Embers suites"
    ]
  },
  "outOfScope": [
    "No edits to existing FIRE-01/02/03/04 numerical/rendering code or protected baseline vendor",
    "No full CFD fluid solver or volumetric ray-marching, no full-screen blur/normal map refraction, no global shader",
    "No experimental PixiJS ParticleContainer until separate performance benchmark",
    "No hardware GPU/thermal/mobile device certification from headless Chromium",
    "A 40-frame excerpt is explicitly incomplete: full fade one-shot is 100 frames",
    "No new engine version or hidden plume/ash layers"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "rate": "settings.rate",
      "initialSize": "settings.initialSize",
      "expansion": "settings.expansion",
      "riseSpeed": "settings.riseSpeed",
      "swirl": "settings.swirl",
      "density": "settings.density",
      "lifetimeSeconds": "settings.lifetimeSeconds",
      "windX": "settings.windX",
      "nozzleWidth": "settings.nozzleWidth",
      "originGap": "settings.originGap",
      "spatialJitter": "settings.spatialJitter",
      "intervalJitter": "settings.intervalJitter",
      "emissionFrames": "settings.emissionFrames",
      "stopFrame": "settings.stopFrame",
      "fadeFrames": "settings.fadeFrames",
      "durationFrames": "settings.durationFrames",
      "exportFrames": "settings.exportFrames",
      "seed": "settings.seed",
      "minGapSeconds": "settings.minGapSeconds",
      "curlScale": "settings.curlScale",
      "spacingCurveEnabled": "settings.spacingCurveEnabled",
      "mode": "settings.mode",
      "style": "settings.style",
      "quality": "settings.quality",
      "spatialMode": "settings.spatialMode",
      "emissionMode": "settings.emissionMode"
    },
    "preview": "assets/Smoke_Plume_Lab.html",
    "pngBake": "SmokeExports.bake, transparent straight RGBA8 512x512 PNG sequence at frameIndex/60, 1-3600 frame setting, full 120 loop or 100 burst+fade",
    "developerZip": "SmokeExports.buildPackage('webgl'|'webgpu') exports same FxSmoke.mjs pure core and SmokePlume.mjs owned pooled Pixi renderer with exact pinned Vite packages",
    "invariant": "Single core/runtime shared by offline preview, sequence and two developer handoffs"
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject",
    "policy": "Schema and effect changes require explicit matching fixture and version migration; unsupported settings/version rejected, no silent defaults"
  },
  "implementation": {
    "status": "reference-implementation",
    "sourceFiles": [
      "assets/smoke-plume/src/smoke-core.js",
      "assets/smoke-plume/src/smoke-runtime.js",
      "assets/smoke-plume/src/smoke-editor.js",
      "assets/smoke-plume/src/smoke-export.js",
      "assets/smoke-plume/src/zip-core.js",
      "assets/smoke-plume/src/ui.html",
      "assets/Smoke_Plume_Lab.html",
      "scripts/build_smoke_editor.py"
    ],
    "notes": "FIRE-05 standalone soft-alpha multi-emitter 512px PixiJS 8.22 / Spine4.2 editor. Full backend and evidence tests via dedicated suite."
  }
}
```

## Reproduce & test

Build via `python scripts/build_smoke_editor.py --output assets/Smoke_Plume_Lab.html`. Numerical `node scripts/test_smoke_core.cjs`. Browser `node scripts/test_smoke_editor.cjs --backend webgl1|webgl2|webgpu --output OUT` (use `--full` for full two-sequence PNG bake). Then `node scripts/test_smoke_evidence.cjs OUT` and `python scripts/effect_validation.py OUT/effect-evidence.json --require-pass`. Check developer ZIP ESM and `npm run build` for each Vite target and run both browser examples.
