# WATER-01 — Water Splash: deterministic impact, crown, droplets and optional ripple

This is **one independent water effect**, not a Burn Lab modification or a generic all-effect renderer. Impact frame0 emits 24 droplets simultaneously. Positive Y points downward; quadratic gravity curves trajectories. Frame39 is entirely transparent in the default 40-frame one-shot. Optional loop is **repeat-impact**, not visually seamless. Transparent PNGs are straight-alpha and do not capture the CSS preview background or any caller-owned Spine model.

## Versioned Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.water.water-splash",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "water",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "40 frame impact-driven water splash at 60fps/512px with independently owned splash crown (continuous tapered cubic geometry), exactly 24 ballistic droplets at frame 0, independent fine mist and optional concentric ripples. Positive Y is down; gravity=420 px/s² causes quadratic position. Last included frame39 is fully transparent. Default one-shot; optional repeat-impact loop at frame40 has a deliberately visible restart, NOT a seamlessly continuous water surface. All 3 editable curves, source anchors, palette and independent layer toggles affect the same numerical engine in preview, PNG bake and developer bundles.",
  "phases": [
    {
      "id": "impact",
      "at": 0,
      "look": "Frame0 crown and exactly 24 bright seeded water droplets appear simultaneously around an impact point"
    },
    {
      "id": "ejection",
      "at": 0.1,
      "look": "Frames4–16 fast expanding arcing water crown and ballistic droplet launch; optional mist"
    },
    {
      "id": "descent",
      "at": 0.4,
      "look": "Frames16–32 quadratic-gravity droplet fall, thinner crown and fading mist/ripple"
    },
    {
      "id": "fade",
      "at": 1,
      "look": "Frame39 fully transparent on last included one-shot frame; optional restart on exact frame40 is deliberately abrupt"
    }
  ],
  "layers": [
    {
      "id": "crown",
      "kind": "geometry",
      "position": "emitter-relative-local",
      "purpose": "Independent tapered 3-ribbon impact crown from the actual reusable FxPath.buildRibbon cubic arc, on by default"
    },
    {
      "id": "droplets",
      "kind": "particles",
      "position": "emitter-relative-local",
      "purpose": "Exactly 24 ballistic primary droplets at t0, per-emitter seed, gravity, launch angle and independent layer enable"
    },
    {
      "id": "mist",
      "kind": "particles",
      "position": "emitter-relative-local",
      "purpose": "Independent fine light mist with deterministic smaller droplets, on by default"
    },
    {
      "id": "ripple",
      "kind": "geometry",
      "position": "emitter-relative-local",
      "purpose": "Optional expanding transparent surface ring, off by default"
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
      "key": "durationFrames",
      "type": "integer",
      "default": 40,
      "min": 1,
      "max": 1200,
      "step": 1,
      "unit": "frames-at-60fps",
      "controlGroup": "Impact physics and 40-frame timing",
      "exportPath": "settings.durationFrames"
    },
    {
      "key": "exportFrames",
      "type": "integer",
      "default": 40,
      "min": 1,
      "max": 3600,
      "step": 1,
      "unit": "frames-at-60fps",
      "controlGroup": "Impact physics and 40-frame timing",
      "exportPath": "settings.exportFrames"
    },
    {
      "key": "droplets",
      "type": "integer",
      "default": 24,
      "min": 0,
      "max": 160,
      "step": 1,
      "unit": "particles",
      "controlGroup": "Impact physics and 40-frame timing",
      "exportPath": "settings.droplets"
    },
    {
      "key": "spread",
      "type": "number",
      "default": 140,
      "min": 0,
      "max": 360,
      "step": 1,
      "unit": "degrees-upward-centered",
      "controlGroup": "Impact physics and 40-frame timing",
      "exportPath": "settings.spread"
    },
    {
      "key": "gravity",
      "type": "number",
      "default": 420,
      "min": 0,
      "max": 1200,
      "step": 1,
      "unit": "logical-pixels-per-second-squared",
      "controlGroup": "Impact physics and 40-frame timing",
      "exportPath": "settings.gravity"
    },
    {
      "key": "launchSpeed",
      "type": "number",
      "default": 220,
      "min": 0,
      "max": 800,
      "step": 1,
      "unit": "logical-pixels-per-second",
      "controlGroup": "Impact physics and 40-frame timing",
      "exportPath": "settings.launchSpeed"
    },
    {
      "key": "dropletSize",
      "type": "number",
      "default": 6,
      "min": 1,
      "max": 22,
      "step": 0.25,
      "unit": "logical-pixels-diameter",
      "controlGroup": "Impact physics and 40-frame timing",
      "exportPath": "settings.dropletSize"
    },
    {
      "key": "crownHeight",
      "type": "number",
      "default": 55,
      "min": 0,
      "max": 160,
      "step": 1,
      "unit": "logical-pixels",
      "controlGroup": "Impact physics and 40-frame timing",
      "exportPath": "settings.crownHeight"
    },
    {
      "key": "rippleRadius",
      "type": "number",
      "default": 85,
      "min": 0,
      "max": 250,
      "step": 1,
      "unit": "logical-pixels",
      "controlGroup": "Impact physics and 40-frame timing",
      "exportPath": "settings.rippleRadius"
    },
    {
      "key": "openingSpacing",
      "type": "number",
      "default": 10,
      "min": 2,
      "max": 50,
      "step": 0.25,
      "unit": "logical-arc-pixels",
      "controlGroup": "Independent physical opening and spray",
      "exportPath": "settings.openingSpacing"
    },
    {
      "key": "openingJitter",
      "type": "number",
      "default": 0.1,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "fraction-of-gap",
      "controlGroup": "Independent physical opening and spray",
      "exportPath": "settings.openingJitter"
    },
    {
      "key": "sprayRate",
      "type": "number",
      "default": 12,
      "min": 0,
      "max": 120,
      "step": 1,
      "unit": "particles-per-second",
      "controlGroup": "Independent physical opening and spray",
      "exportPath": "settings.sprayRate"
    },
    {
      "key": "mistCount",
      "type": "integer",
      "default": 12,
      "min": 0,
      "max": 64,
      "step": 1,
      "unit": "particles",
      "controlGroup": "Independent physical opening and spray",
      "exportPath": "settings.mistCount"
    },
    {
      "key": "seed",
      "type": "integer",
      "default": 42022,
      "min": -2147483648,
      "max": 2147483647,
      "step": 1,
      "unit": "int32",
      "controlGroup": "Impact physics and 40-frame timing",
      "exportPath": "settings.seed"
    },
    {
      "key": "loop",
      "type": "boolean",
      "default": false,
      "unit": "enabled",
      "controlGroup": "Impact physics and 40-frame timing",
      "exportPath": "settings.loop"
    },
    {
      "key": "sprayEnabled",
      "type": "boolean",
      "default": false,
      "unit": "enabled",
      "controlGroup": "Independent physical opening and spray",
      "exportPath": "settings.sprayEnabled"
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
      "controlGroup": "Independent physical opening and spray",
      "exportPath": "settings.spatialMode"
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
      "controlGroup": "Quality and offline export",
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
      "controlGroup": "Editable three-domain curves",
      "exportPath": "settings.style"
    }
  ],
  "controlGroups": [
    "Impact physics and 40-frame timing",
    "Independent physical opening and spray",
    "Independent impact emitters",
    "Emitter world/Spine anchor",
    "Four independently owned layers",
    "Editable RGBA palette and style",
    "Editable three-domain curves",
    "Quality and offline export"
  ],
  "requiredContracts": [
    "parameters",
    "curves",
    "spacing",
    "pathGeometry",
    "emitters",
    "colors",
    "timeline"
  ],
  "curves": [
    {
      "id": "burst-density",
      "key": "burstDensityCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "droplet-size",
      "key": "dropletSizeCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "crown-expansion",
      "key": "crownExpansionCurve",
      "domain": "effectTime",
      "contract": "curves"
    }
  ],
  "spacing": {
    "contract": "spacing",
    "impactBurst": "Exactly droplets=24 (default) simultaneous seed-indexed events at t=0; this is NOT the FxSpacing generic burst schedule which starts after one interval",
    "residualSpray": "Optional sprayEnabled false by default; independent FxSpacing.createTemporalSchedule with 12/s at t0 decaying by 20/60seconds through the versioned burst-density curve",
    "spatial": "FxSpacing.createSpatialPlacement follows a cubic opening path by cumulative arc length (0.25px tolerance) rather than cubic parameter t, default10px seed/jitter",
    "independence": "droplet opening gap/seed/distinct event time/gravity/speed are independent; old flame emission modes do not exist",
    "caps": "Shared cumulative particle/vertices/triangles Low/Balanced/High limits across up to 4 emitters; overflow explicit error instead of silently dropping"
  },
  "palettes": [
    {
      "id": "splash-color",
      "key": "palette",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#E1F9FF",
        "#75D3EF",
        "#2787BE"
      ],
      "alpha": "1.0→0.85→0, straight RGBA8; preserve bright RGB for partial opacity"
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "Fixed stable source ID, independent index/hash streams for droplet angle/spawn/mist/geometry; no shared Math.random. Source reorder cannot mutate a sibling's output."
  },
  "rendering": {
    "approach": "composition",
    "backends": [
      "webgl1",
      "webgl2",
      "webgpu"
    ],
    "runtimePins": {
      "pixi": "8.22.0",
      "spine": "4.2.120"
    },
    "strategy": "Bounded stable four source Pixi containers; each crown uses actual FxPath.buildRibbon MeshGeometry with 0.25px arc-length oracle and tapered tips; primary and fine mist from deterministic circular Graphics; independently owned optional ring. No static PNG fake physics, CFD or new pixi-filters.",
    "alpha": "Transparent pixels only in PNG, no CSS background in GPU output, unpremultiply extracted pixels once into straight RGB. Frame39 completely transparent.",
    "loop": "Default one-shot frames0–39, t>=39/60 blank; optional repeated impact loops modulo40/60 with intentional visible restart, not seamless.",
    "physicalGpu": "Chromium headless API provenance not proof of mobile frame time, hardware memory or thermals."
  },
  "qualityBudgets": {
    "low": {
      "maxParticles": 160,
      "maxVertices": 2048,
      "maxTriangles": 2048,
      "sampleSpacingPx": 9,
      "maxEmitters": 4
    },
    "balanced": {
      "maxParticles": 360,
      "maxVertices": 8192,
      "maxTriangles": 8192,
      "sampleSpacingPx": 5,
      "maxEmitters": 4
    },
    "high": {
      "maxParticles": 800,
      "maxVertices": 16384,
      "maxTriangles": 16384,
      "sampleSpacingPx": 3,
      "maxEmitters": 4
    }
  },
  "tests": {
    "verified": true,
    "evidence": [
      "scripts/test_splash_core.cjs",
      "scripts/test_splash_runtime.cjs",
      "scripts/test_splash_editor.cjs",
      "scripts/test_splash_alpha.cjs",
      "scripts/test_splash_packages.cjs",
      "scripts/test_splash_export.cjs",
      "scripts/test_splash_developer.cjs",
      "scripts/test_splash_spine.cjs",
      "scripts/test_splash_lifecycle.cjs",
      "scripts/test_splash_roi.cjs",
      "scripts/test_splash_evidence.cjs",
      "scripts/test_splash_png_zip.cjs"
    ],
    "required": [
      "Real 24 simultaneous t0 droplets, independent residual event schedule with physical opening distance and independent curves, deterministic 0..39 frames",
      "True quadratic gravity curvature, speed/spread/size/height/width/ripple control changes, per-emitter seed, world/Spine anchors and missing anchor isolation",
      "Three separate independently toggleable and translated/rotated layered outputs crown/droplets/mist plus optional ripple",
      "Actual baked isolated straight-alpha 512px PNG (no preview CSS background or Spine source baked); zero dark PMA fringe",
      "40 frame one-shot last frame39 transparent; optional 40 frame visible restart at frame40, no claim of seamless loop",
      "No silently cropped geometry, explicit global geometry+particle quality budgets, out-of-bound and overflow fail",
      "Actual WebGL1/WebGL2/WebGPU, extracted PixiJS 8.22.0 / Spine 4.2.120 Vite developer ZIP, identical ESM and source",
      "FX-CORE-07 phase/parameter/backend screenshot evidence and published SHA; protected 8 Burn files and 30 controls unchanged"
    ]
  },
  "outOfScope": [
    "No CFD, fluid solver, volumetric water or procedural surface liquid waves",
    "No seamless overlapping-impact simulation (option B); loop restarts at next impact frame",
    "No background-baked PNG in isolated FX export; no CSS checker captured",
    "No runtime Pixi/Spine upgrade or new pixi-filters dependency",
    "No hardware phone GPU FPS/thermal certification from headless SwiftShader",
    "No automatic fallback declaring requested WebGPU as actually WebGPU"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "durationFrames": "settings.durationFrames",
      "exportFrames": "settings.exportFrames",
      "droplets": "settings.droplets",
      "spread": "settings.spread",
      "gravity": "settings.gravity",
      "launchSpeed": "settings.launchSpeed",
      "dropletSize": "settings.dropletSize",
      "crownHeight": "settings.crownHeight",
      "rippleRadius": "settings.rippleRadius",
      "openingSpacing": "settings.openingSpacing",
      "openingJitter": "settings.openingJitter",
      "sprayRate": "settings.sprayRate",
      "mistCount": "settings.mistCount",
      "seed": "settings.seed",
      "loop": "settings.loop",
      "sprayEnabled": "settings.sprayEnabled",
      "spatialMode": "settings.spatialMode",
      "quality": "settings.quality",
      "style": "settings.style"
    },
    "preview": "assets/Water_Splash_Lab.html",
    "pngBake": "SplashExports.bake 40 separate 512px transparent straight-alpha PNG frames plus sequence.json; cancel/restore/CRC and reject 512px crop",
    "developerZip": "SplashExports.buildPackage webgl/webgpu; identical FxSplash.mjs & WaterSplash.mjs + versioned FxPath.mjs, FxSpacing.mjs, FxCurves.mjs, FxColors.mjs and FxTimeline.mjs and matching Spine export",
    "invariant": "Same pure FxSplash physics/geometry UMD source in offline HTML, PNG bake and both exact Vite handoffs; no duplicate physics or hidden unrelated burn fields"
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject"
  },
  "implementation": {
    "status": "reference-implementation",
    "sourceFiles": [
      "assets/water-splash/src/splash-core.js",
      "assets/water-splash/src/splash-runtime.js",
      "assets/water-splash/src/splash-editor.js",
      "assets/water-splash/src/splash-export.js",
      "assets/water-splash/src/zip-core.js",
      "assets/water-splash/src/ui.html",
      "assets/Water_Splash_Lab.html",
      "scripts/build_splash_editor.py"
    ],
    "notes": "WATER-01 independent real Pixi/Spine water splash on fixed 60fps numerical core, real 40f straight PNG and developer package. Tests must be re-run after any relevant source change."
  }
}
```

## Build and verify

`python scripts/build_splash_editor.py --output assets/Water_Splash_Lab.html`; `node scripts/test_splash_core.cjs`; `node scripts/test_splash_runtime.cjs webgl2|webgl1|webgpu`; `node scripts/test_splash_editor.cjs --backend webgl2|webgl1|webgpu`; `node scripts/test_splash_alpha.cjs`; `node scripts/test_splash_packages.cjs`; `node scripts/test_splash_export.cjs EXTRACTED_PACKAGE`. Per-effect FX-CORE-07 only counts actual decoded GPU PNG and CLI evidence. No speculative mobile GPU/FPS or seamless-water claims.
