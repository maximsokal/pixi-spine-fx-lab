# WATER-05 ? Rising Bubbles

Standalone underwater buoyant bubbles editor. Visual and numerical requirements for FX Lab; this does not change any other water effect implementation.

## Versioned Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.water.rising-bubbles",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "water",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "Independent WATER-05 buoyant underwater rising bubbles. Periodic deterministic 60-frame 60FPS loop retains historic bubbles with lifetime up to 8sec; 40-frame shutdown fades to transparent frame39. Native pooled Pixi8.22 ParticleContainers for translucent colored rim, sparse specular arc highlight and optional lifetime-caused expanding pop rings, with 3 separately anchored/visible layers per emitter. True quadratic y0-.5*a*age^2 and editable seeded lateral wobble; 16 bubbles/sec and 22px origin gap on 320px cubic nozzle with editable bend. Five independent lifetime/rate/physical-gap curves. Straight-alpha 512x512 PNG and two offline exact-core WebGL/WebGPU developer packages, same simulation for preview, bake and packages.",
  "phases": [
    {
      "id": "spawn",
      "at": 0,
      "look": "Already-rising translucent bubbles from prior loop, first frame fully active rather than starting empty"
    },
    {
      "id": "ascent",
      "at": 0.5,
      "look": "Bubbles independently rise with quadratic velocity and lateral wobble; partial-alpha rims and specular highlights move without solid squares"
    },
    {
      "id": "wrap",
      "at": 1,
      "look": "Exact 60-frame loop boundary has no particle reset, raster at t1 matches t0; optional 40-frame shutdown has alpha0 frame39"
    }
  ],
  "layers": [
    {
      "id": "bubbles",
      "kind": "particles",
      "position": "World/local/Spine4.2 anchor per emitter or independent layer offset",
      "purpose": "Transparent softly filled colored circles with anti-aliased annular rim, analytic ascent and size/age/alpha curves, native pooled Pixi ParticleContainer"
    },
    {
      "id": "highlights",
      "kind": "particles",
      "position": "Independent anchor/XY/rotation/timeOffset/alpha/blend; draggable highlight handle in same canvas",
      "purpose": "Sparse anisotropic specular arcs textured separately; highlightStrength zero creates no highlight; hiding bubbles never forces highlight invisible"
    },
    {
      "id": "popRings",
      "kind": "particles",
      "position": "Independent world/local/Spine4.2 anchor and per-layer visibility",
      "purpose": "Thin briefly expanding translucent ring emitted only at a qualifying lifetime event inside capture area, not random offscreen flashes"
    }
  ],
  "emitterAnchors": [
    {
      "id": "world",
      "space": "512x512 logical px",
      "onMissing": "n/a"
    },
    {
      "id": "skeleton",
      "space": "Spine skeleton local",
      "onMissing": "hide only affected layer"
    },
    {
      "id": "bone",
      "space": "Spine bone local",
      "onMissing": "hide only affected layer"
    },
    {
      "id": "slot",
      "space": "Spine slot local",
      "onMissing": "hide only affected layer"
    },
    {
      "id": "attachment",
      "space": "Spine attachment centroid",
      "onMissing": "hide only affected layer"
    },
    {
      "id": "inherit",
      "space": "Per-emitter current world pose and local offsets",
      "onMissing": "hide only affected layer and keep siblings"
    }
  ],
  "parameters": [
    {
      "key": "rate",
      "type": "number",
      "default": 16,
      "min": 0,
      "max": 90,
      "step": 1,
      "unit": "candidate events/s",
      "controlGroup": "Bubble physics",
      "exportPath": "settings.rate"
    },
    {
      "key": "radius",
      "type": "number",
      "default": 8,
      "min": 2,
      "max": 22,
      "step": 0.5,
      "unit": "px",
      "controlGroup": "Bubble physics",
      "exportPath": "settings.radius"
    },
    {
      "key": "buoyancy",
      "type": "number",
      "default": 90,
      "min": 0,
      "max": 450,
      "step": 5,
      "unit": "px/s?",
      "controlGroup": "Bubble physics",
      "exportPath": "settings.buoyancy"
    },
    {
      "key": "wobble",
      "type": "number",
      "default": 12,
      "min": 0,
      "max": 45,
      "step": 1,
      "unit": "px",
      "controlGroup": "Bubble physics",
      "exportPath": "settings.wobble"
    },
    {
      "key": "lifetime",
      "type": "number",
      "default": 1.8,
      "min": 0.1,
      "max": 8,
      "step": 0.1,
      "unit": "seconds",
      "controlGroup": "Bubble physics",
      "exportPath": "settings.lifetime"
    },
    {
      "key": "highlightStrength",
      "type": "number",
      "default": 0.6,
      "min": 0,
      "max": 1,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Bubble physics",
      "exportPath": "settings.highlightStrength"
    },
    {
      "key": "originGap",
      "type": "number",
      "default": 22,
      "min": 4,
      "max": 100,
      "step": 1,
      "unit": "arc-length-px",
      "controlGroup": "Nozzle spacing and emission",
      "exportPath": "settings.originGap"
    },
    {
      "key": "originSpan",
      "type": "number",
      "default": 320,
      "min": 10,
      "max": 480,
      "step": 1,
      "unit": "px",
      "controlGroup": "Nozzle spacing and emission",
      "exportPath": "settings.originSpan"
    },
    {
      "key": "nozzleBend",
      "type": "number",
      "default": 9,
      "min": -80,
      "max": 80,
      "step": 1,
      "unit": "px",
      "controlGroup": "Nozzle spacing and emission",
      "exportPath": "settings.nozzleBend"
    },
    {
      "key": "spatialJitter",
      "type": "number",
      "default": 0.25,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Nozzle spacing and emission",
      "exportPath": "settings.spatialJitter"
    },
    {
      "key": "radiusVariation",
      "type": "number",
      "default": 0.2,
      "min": 0,
      "max": 0.8,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Bubble physics",
      "exportPath": "settings.radiusVariation"
    },
    {
      "key": "popLifetime",
      "type": "number",
      "default": 0.22,
      "min": 0.05,
      "max": 0.6,
      "step": 0.01,
      "unit": "seconds",
      "controlGroup": "Bubble physics",
      "exportPath": "settings.popLifetime"
    },
    {
      "key": "exportFrames",
      "type": "integer",
      "default": 60,
      "min": 1,
      "max": 3600,
      "step": 1,
      "unit": "frames-at-60Hz",
      "controlGroup": "Time, quality and seed",
      "exportPath": "settings.exportFrames"
    },
    {
      "key": "seed",
      "type": "integer",
      "default": 87119,
      "min": -2147483648,
      "max": 2147483647,
      "step": 1,
      "unit": "signed-int32",
      "controlGroup": "Time, quality and seed",
      "exportPath": "settings.seed"
    },
    {
      "key": "mode",
      "type": "enum",
      "default": "loop",
      "choices": [
        "loop",
        "shutdown"
      ],
      "unit": "enum",
      "controlGroup": "Time, quality and seed",
      "exportPath": "settings.mode"
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
      "controlGroup": "Nozzle spacing and emission",
      "exportPath": "settings.spatialMode"
    },
    {
      "key": "temporalMode",
      "type": "enum",
      "default": "uniform",
      "choices": [
        "uniform",
        "clustered"
      ],
      "unit": "enum",
      "controlGroup": "Nozzle spacing and emission",
      "exportPath": "settings.temporalMode"
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
      "controlGroup": "Time, quality and seed",
      "exportPath": "settings.quality"
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
      "controlGroup": "Style and palette",
      "exportPath": "settings.style"
    }
  ],
  "controlGroups": [
    "Bubble physics",
    "Nozzle spacing and emission",
    "Style and palette",
    "Time, quality and seed",
    "Independent emitters and layers"
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
      "id": "particle-size-lifetime",
      "key": "sizeCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "particle-lateral-drift",
      "key": "lateralDriftCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "particle-alpha-lifetime",
      "key": "alphaCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "birth-event-rate-time",
      "key": "emissionRateCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "nozzle-physical-gap",
      "key": "originGapCurve",
      "domain": "pathPosition",
      "contract": "curves"
    }
  ],
  "spacing": {
    "contract": "spacing",
    "temporal": "FxSpacing.createTemporalSchedule 16 candidates/s default at 60FPS authoring independent of rendered FPS. Uniform uses integrated emissionRateCurve multiplied by base rate, clustered uses seeded clustered wave; event count and true birth timestamps are traceable.",
    "spatial": "FxSpacing.createSpatialPlacement using cumulative cubic nozzle arc length, global errorBound <=0.25 logical px. Hard originGap22 enforced as minimum physical distance even with spatialJitter .25 and clustered/random distributions; originSpan320 and nozzleBend9 editable in canvas.",
    "history": "Loop duration1s with bubble age lifetime1.8s: sample reconstructs sufficient prior periods including >=9 for max8s; t0 and t1 identical for same backend with no reset.",
    "motion": "Straight quadratic ascent y=y0-.5*buoyancy*age? and x drift with curve and wobble amplitude; 0 wobble means straight path, 0 buoyancy means stationary y.",
    "coordinate": "Logical 512x512, default emitter anchor (256,440). Nozzle positioned relative to emitter world or Spine pose. Top viewport exit is intentional and differs from invalid side/bottom crop.",
    "quality": "Low/Balanced/High total candidates and active particle limit across up to four emitters; no silent downshift, rejects impossible combinations."
  },
  "palettes": [
    {
      "id": "rising-bubbles-rgba",
      "key": "palette",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#E6FDFF",
        "#6BCFEC"
      ],
      "alpha": "Editable separate straight RGBA alpha, translucent rim and anisotropic specular arc; normal/additive layer blend with tested PMA handling and procedural pooled 64px textures."
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "Per-emitter ID+seed stable indexed deterministic phase randomness; no frame-driven RNG and no Math.random. Reordering emitters does not change their own pixels/particles."
  },
  "rendering": {
    "approach": "particles",
    "backends": [
      "webgl1",
      "webgl2",
      "webgpu"
    ],
    "runtimePins": {
      "pixi": "8.22.0",
      "spine": "4.2.120"
    },
    "strategy": "Native PixiJS 8.22 ParticleContainer per layer/emitter with dynamic position/vertex/color/rotation properties, pooled precomputed 64px translucent antialiased annular bubble, anisotropic highlight and pop textures. Scale each particle by (2*radius/64), never treat scaleX/Y as pixel diameter. Pure CJS/UMD simulation reused byte-identically in ESM developer ZIP.",
    "alpha": "True straight RGBA8 PNG, decoder-verifiable partial alpha; WebGL vs WebGPU extraction uses backend-aware PMA conversion. Independent source model excluded from isolated bake.",
    "crop": "Top exit of aged rising bubble explicitly allowed; invalid lateral/bottom emitter geometry gives explicit ROI error before export. Camera zoom and HTML handles excluded.",
    "spine": "Spine4.2.43 Doctor head multipage JSON fixture, animated bone/slot/attachment and missing anchor sibling isolation. Exact matching binary .skel not tested.",
    "hardware": "Browser Chrome WebGL1/2/WebGPU checked; real phone GPU thermal performance not certified."
  },
  "qualityBudgets": {
    "low": {
      "maxCandidates": 350,
      "maxVisible": 400,
      "maxOrigins": 200,
      "maxEmitters": 4
    },
    "balanced": {
      "maxCandidates": 1100,
      "maxVisible": 1600,
      "maxOrigins": 400,
      "maxEmitters": 4
    },
    "high": {
      "maxCandidates": 2800,
      "maxVisible": 3500,
      "maxOrigins": 800,
      "maxEmitters": 4
    }
  },
  "tests": {
    "verified": true,
    "evidence": [
      "scripts/test_bubbles_core.cjs",
      "scripts/test_bubbles_particles.cjs",
      "scripts/test_bubbles_smoke.cjs",
      "scripts/test_bubbles_drag_zoom.cjs",
      "scripts/test_bubbles_spine.cjs",
      "scripts/test_bubbles_roi.cjs",
      "scripts/test_bubbles_lifecycle.cjs",
      "scripts/test_bubbles_png_zip.cjs",
      "scripts/test_bubbles_export.cjs",
      "scripts/test_bubbles_packages.cjs",
      "scripts/test_bubbles_repeat_zip.cjs",
      "scripts/test_bubbles_editor.cjs",
      "scripts/test_bubbles_evidence.cjs",
      "scripts/test_bubbles_alpha.cjs",
      "scripts/test_bubbles_developer.cjs"
    ],
    "required": [
      "60f exact loop and visible f0/f30/f59 with previous-period bubbles, separate 40f shutdown alpha0 f39",
      "Analytic quadratic ascent with wobble0/acceleration0 controls, seed-isolated 4 emitters, five real curves",
      "Real actual Pixi WebGL1/2/WebGPU rendering, translucent circles and highlights not solid boxes, pooled resources stable after 60f warmup",
      "Rate16/s integrated birth events vs 22px hard origin gap with jitter and cubic nozzle bend/span, global arc error<=0.25px",
      "Three independently enabled, positioned/rotated/blended Spine anchors with missing layer isolation; preview canvas dragging 50/100/200%",
      "Full 60 PNG RGBA8 frames plus manifest and CRC, byte-identical repeated bake, backend-aware straight alpha, no camera/model in output",
      "Two offline executable developer ZIPs with exact same numerical/runtime source, pinned Pixi and Spine and Vite build, real browser demonstrations and zero off-origin network",
      "FX-CORE-07 evidence on all three actual GPU backends and every declared 19 controls/5 curves; no fabricated PASS",
      "Protected Burn hashes and previous WATER/FX-CORE numeric regression suites intact"
    ]
  },
  "outOfScope": [
    "Navier-Stokes fluid mechanics or 3D refraction",
    "Modifying other FX implementations, catalog adapters or protected Burn Lab",
    "Spine runtime 4.3 or unapproved Pixi upgrades",
    "Mobile thermal and physical GPU FPS claims without device testing",
    "Binary .skel validation without actual matching 4.2 fixture",
    "Automatically clipping invalid emitter side/bottom crop"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "rate": "settings.rate",
      "radius": "settings.radius",
      "buoyancy": "settings.buoyancy",
      "wobble": "settings.wobble",
      "lifetime": "settings.lifetime",
      "highlightStrength": "settings.highlightStrength",
      "originGap": "settings.originGap",
      "originSpan": "settings.originSpan",
      "nozzleBend": "settings.nozzleBend",
      "spatialJitter": "settings.spatialJitter",
      "radiusVariation": "settings.radiusVariation",
      "popLifetime": "settings.popLifetime",
      "exportFrames": "settings.exportFrames",
      "seed": "settings.seed",
      "mode": "settings.mode",
      "spatialMode": "settings.spatialMode",
      "temporalMode": "settings.temporalMode",
      "quality": "settings.quality",
      "style": "settings.style"
    },
    "preview": "assets/Rising_Bubbles_Lab.html independent offline source with three layers and five shared editors",
    "pngBake": "BubblesExports.bake, 60 real 512x512 straight-alpha frames and sequence.json; optional 40f fade frame39 alpha0; crop/cancellation safe",
    "developerZip": "BubblesExports.buildPackage webgl/webgpu, exact FxCurves/Spacing/Colors/Timeline and FxBubbles/Bubbles source modules with pinned Pixi8.22 Spine4.2.120 Vite7.1.12, sample assets/licenses",
    "invariant": "One identical CJS numerical engine and Pixi runtime source for preview/PNG/packages, never a secondary exporter shader. Same settings/seeds/anchors/curves and zoom independent."
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject"
  },
  "implementation": {
    "status": "reference-implementation",
    "sourceFiles": [
      "assets/rising-bubbles/src/bubbles-core.js",
      "assets/rising-bubbles/src/bubbles-runtime.js",
      "assets/rising-bubbles/src/bubbles-editor.js",
      "assets/rising-bubbles/src/bubbles-export.js",
      "assets/rising-bubbles/src/zip-core.js",
      "assets/rising-bubbles/src/ui.html",
      "assets/Rising_Bubbles_Lab.html",
      "scripts/build_bubbles_editor.py"
    ],
    "notes": "WATER-05 standalone deterministic periodic translucent bubble editor, three pooled native Pixi particle layers, three real GPU backends, 60f loop and 40f shutdown, 19 author parameters and five curves. Physical phone tests and binary SKEL NOT RUN."
  }
}
```

## Implementation safety and checks

Use the exact deterministic source across live preview, transparent PNG, and WebGL/WebGPU Vite developer packages. No new runtime dependencies. See the reviewed Spec Kit task list in [WATER-05 GitHub issue #21](https://github.com/maximsokal/pixi-spine-fx-lab/issues/21). Run focused test scripts and record true PASS/FAIL/NOT RUN; device thermal performance, mismatched Spine binary fixtures and unsupported GPUs remain NOT RUN.
