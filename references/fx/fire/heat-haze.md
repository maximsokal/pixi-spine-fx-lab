# FIRE-06 — Heat Haze: explicit captured-scene refraction and typed data/export

**Rendered input required.** This editor applies a real PixiJS built-in dual-WebGL/WebGPU DisplacementFilter to an **explicitly captured Pixi scene** (original background + masked displaced copy). A transparent PNG cannot refract unknown future game backgrounds. Therefore PNG representations are **three distinct products:** (1) opaque R/G signed displacement B coverage *DATA* map, (2) optional straight-alpha thermal glow overlay, (3) 512×512 image with the selected background already refracted and composited.

**Author defaults:** amplitude 8px, .035 cycles/px noise, 25 px/s vertical advection, width 90px, falloff 18px, pulse1.5Hz, 28px centerline spacing, seeded 120-frame 60fps loop (0 and frame120 equivalent), optional stop60 + fade60, one to four independent sources; thermal glow off.

## Versioned Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.fire.heat-haze",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "fire",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "True background-aware heat shimmer and refraction over a selected host Pixi scene only; original unchanged outside feathered centerline ROI. Optional independent glowing heat only, default off. Three explicitly typed exports: opaque XY displacement/coverage DATA PNG, straight RGBA glow PNG and background-baked composited PNG.",
  "phases": [
    {
      "id": "low",
      "at": 0,
      "look": "Initial faint but real background refraction on high-frequency captured grid, optional glow disabled"
    },
    {
      "id": "peak",
      "at": 0.25,
      "look": "Strongest rising shimmer and pulse, distortion strictly inside heat region"
    },
    {
      "id": "cooldown",
      "at": 0.75,
      "look": "Shimmer subsides while rising movement continues, no change outside region"
    },
    {
      "id": "seam",
      "at": 1,
      "look": "Exact pixel equivalent to frame zero at seamless 120-frame boundary"
    }
  ],
  "layers": [
    {
      "id": "refraction",
      "kind": "filter",
      "position": "emitter-and-layer-relative-Pixi-centerline",
      "purpose": "Actual captured-scene displacement, copied and alpha-masked over original; ON by default, normal compositing"
    },
    {
      "id": "thermalGlow",
      "kind": "geometry",
      "position": "emitter-and-layer-relative-Pixi-centerline",
      "purpose": "Independent optional colored RGBA glow overlay (OFF by default), normal/add blend controlled by author"
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
      "key": "amplitude",
      "type": "number",
      "default": 8,
      "min": 0,
      "max": 32,
      "step": 0.25,
      "unit": "logical-px",
      "controlGroup": "Refraction strength, region and lifecycle",
      "exportPath": "settings.amplitude"
    },
    {
      "key": "noiseFrequency",
      "type": "number",
      "default": 0.035,
      "min": 0.005,
      "max": 0.2,
      "step": 0.001,
      "unit": "cycles-per-logical-px",
      "controlGroup": "Refraction strength, region and lifecycle",
      "exportPath": "settings.noiseFrequency"
    },
    {
      "key": "verticalFlow",
      "type": "number",
      "default": 25,
      "min": -100,
      "max": 150,
      "step": 1,
      "unit": "logical-px-per-second",
      "controlGroup": "Refraction strength, region and lifecycle",
      "exportPath": "settings.verticalFlow"
    },
    {
      "key": "regionWidth",
      "type": "number",
      "default": 90,
      "min": 10,
      "max": 350,
      "step": 1,
      "unit": "logical-px",
      "controlGroup": "Refraction strength, region and lifecycle",
      "exportPath": "settings.regionWidth"
    },
    {
      "key": "edgeFalloff",
      "type": "number",
      "default": 18,
      "min": 0,
      "max": 100,
      "step": 1,
      "unit": "logical-px",
      "controlGroup": "Refraction strength, region and lifecycle",
      "exportPath": "settings.edgeFalloff"
    },
    {
      "key": "density",
      "type": "number",
      "default": 1,
      "min": 0,
      "max": 1,
      "step": 0.01,
      "unit": "opacity-0-1",
      "controlGroup": "Refraction strength, region and lifecycle",
      "exportPath": "settings.density"
    },
    {
      "key": "durationFrames",
      "type": "integer",
      "default": 120,
      "min": 1,
      "max": 1200,
      "step": 1,
      "unit": "frames-at-60fps",
      "controlGroup": "Refraction strength, region and lifecycle",
      "exportPath": "settings.durationFrames"
    },
    {
      "key": "stopFrame",
      "type": "integer",
      "default": 60,
      "min": 1,
      "max": 600,
      "step": 1,
      "unit": "frames-at-60fps",
      "controlGroup": "Refraction strength, region and lifecycle",
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
      "controlGroup": "Refraction strength, region and lifecycle",
      "exportPath": "settings.fadeFrames"
    },
    {
      "key": "exportFrames",
      "type": "integer",
      "default": 120,
      "min": 1,
      "max": 3600,
      "step": 1,
      "unit": "frames-at-60fps",
      "controlGroup": "Refraction strength, region and lifecycle",
      "exportPath": "settings.exportFrames"
    },
    {
      "key": "seed",
      "type": "integer",
      "default": 407,
      "min": -2147483648,
      "max": 2147483647,
      "step": 1,
      "unit": "int32",
      "controlGroup": "Refraction strength, region and lifecycle",
      "exportPath": "settings.seed"
    },
    {
      "key": "pulseRate",
      "type": "number",
      "default": 1.5,
      "min": 0,
      "max": 12,
      "step": 0.1,
      "unit": "hertz",
      "controlGroup": "Temporal pulses, gusts and lattice nodes",
      "exportPath": "settings.pulseRate"
    },
    {
      "key": "pulseJitter",
      "type": "number",
      "default": 0.12,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "fraction-of-interval",
      "controlGroup": "Temporal pulses, gusts and lattice nodes",
      "exportPath": "settings.pulseJitter"
    },
    {
      "key": "gustRate",
      "type": "number",
      "default": 0.5,
      "min": 0,
      "max": 5,
      "step": 0.1,
      "unit": "hertz",
      "controlGroup": "Temporal pulses, gusts and lattice nodes",
      "exportPath": "settings.gustRate"
    },
    {
      "key": "gustJitter",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "fraction-of-interval",
      "controlGroup": "Temporal pulses, gusts and lattice nodes",
      "exportPath": "settings.gustJitter"
    },
    {
      "key": "nodeGap",
      "type": "number",
      "default": 28,
      "min": 0.25,
      "max": 100,
      "step": 0.25,
      "unit": "logical-px",
      "controlGroup": "Temporal pulses, gusts and lattice nodes",
      "exportPath": "settings.nodeGap"
    },
    {
      "key": "nodeJitter",
      "type": "number",
      "default": 0.12,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "fraction-of-node-gap",
      "controlGroup": "Temporal pulses, gusts and lattice nodes",
      "exportPath": "settings.nodeJitter"
    },
    {
      "key": "gustEnabled",
      "type": "boolean",
      "default": false,
      "unit": "enabled",
      "controlGroup": "Temporal pulses, gusts and lattice nodes",
      "exportPath": "settings.gustEnabled"
    },
    {
      "key": "mode",
      "type": "enum",
      "default": "loop",
      "choices": [
        "loop",
        "stop"
      ],
      "unit": "enum",
      "controlGroup": "Temporal pulses, gusts and lattice nodes",
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
      "controlGroup": "Temporal pulses, gusts and lattice nodes",
      "exportPath": "settings.style"
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
      "controlGroup": "Temporal pulses, gusts and lattice nodes",
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
      "controlGroup": "Export and developer handoff",
      "exportPath": "settings.quality"
    }
  ],
  "controlGroups": [
    "Refraction strength, region and lifecycle",
    "Temporal pulses, gusts and lattice nodes",
    "Independent heat-region emitters",
    "Editable heat centerline",
    "Selected emitter anchor",
    "Selected emitter layers",
    "Optional thermal glow",
    "Versioned distortion, softness and pulse curves",
    "Export and developer handoff"
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
      "id": "distortion",
      "key": "distortionCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "edge",
      "key": "edgeCurve",
      "domain": "pathPosition",
      "contract": "curves"
    },
    {
      "id": "pulse",
      "key": "pulseCurve",
      "domain": "emitterTime",
      "contract": "curves"
    }
  ],
  "spacing": {
    "contract": "spacing",
    "timeSchedule": "Separate deterministic FxSpacing.createTemporalSchedule: pulseRate=1.5Hz, optional gustRate=0.5Hz (off). Jitter changes event timestamps but never vertical flow speed",
    "spatial": "Actual FxSpacing.createSpatialPlacement along editable cubic centerline, default nodeGap=28 logical px, 0.25px maximum arc-length error and seeded even/random/clustered options",
    "independence": "noiseFrequency=.035 cycles/px is independent of physical nodeGap and verticalFlow=25px/s; spatial cell placement affects actual fields; pulse weight affects amplitude only",
    "caps": "Low/Balanced/High maxNodes=128/256/512 and global 4 emitter limit"
  },
  "palettes": [
    {
      "id": "neutral-thermal-glow",
      "key": "palette",
      "contract": "colors",
      "domain": "effectTime",
      "defaultStops": [
        "#FFFFFF",
        "#FFFDEA",
        "#FFFFFF"
      ],
      "alpha": "0→.45→0; off by default; RGB preserved at zero alpha; never tint refracted scene unless independent glow is explicitly on"
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "Fixed seed + stable emitter ID + event index. Reordering sibling emitters cannot alter pulse or lattice streams of existing emitter. Deterministic loop modulo and analytic flow interpolation."
  },
  "rendering": {
    "approach": "filter",
    "backends": [
      "webgl1",
      "webgl2",
      "webgpu"
    ],
    "runtimePins": {
      "pixi": "8.22.0",
      "spine": "4.2.120"
    },
    "strategy": "One explicitly supplied Pixi sceneSource captured once per Haze seek into an owned 512x512 RenderTexture. Built-in dual-API PIXI.DisplacementFilter filters a copy, PIXI.Sprite.setMask({mask,channel:'alpha'}) clips it to a CPU-generated ROI, original is composited untouched behind, optional glow is composed independently. No capture of CSS/DOM/screen and no recursive filter feedback.",
    "sourceInput": "Caller-owned Pixi sceneSource (or internal Pixi checker/dark/light grid; optional user local texture). Source is never mutated or freed.",
    "noSource": "Explicit NO REFRACTION INPUT diagnostic. Composite PNG export rejects absent scene input. Displacement map is not a transparent visual overlay.",
    "dataPNG": "Opaque RGB+A map: R/G signed X/Y [128 neutral, (byte-128)*32/127 px], B coverage, A255. Consumer must bypass B0 and sample host live background.",
    "quality": "Low/Balanced/High compute grids 128²/256²/512² updated in CanvasSource, no full-screen blur, no new filters dependency.",
    "hardwareClaim": "Headless Chromium software backend results do not certify mobile GPU FPS/thermal budgets."
  },
  "qualityBudgets": {
    "low": {
      "maxNodes": 128,
      "fieldSize": 128,
      "maxEmitters": 4
    },
    "balanced": {
      "maxNodes": 256,
      "fieldSize": 256,
      "maxEmitters": 4
    },
    "high": {
      "maxNodes": 512,
      "fieldSize": 512,
      "maxEmitters": 4
    }
  },
  "tests": {
    "verified": true,
    "evidence": [
      "scripts/test_haze_core.cjs",
      "scripts/test_haze_editor.cjs",
      "scripts/test_haze_evidence.cjs",
      "scripts/test_haze_lifecycle.cjs",
      "scripts/test_haze_export.cjs",
      "scripts/test_haze_developer.cjs",
      "scripts/test_haze_spine.cjs",
      "scripts/test_haze_background.cjs",
      "scripts/test_haze_roi.cjs"
    ],
    "required": [
      "Actual cropped scene sampled from Pixi sceneSource, no sampling of CSS/DOM; filter does not replace refraction with own-glow-only distortion",
      "All 22 root controls change rendered RGBA/data output or are explicitly disabled under documented mode; 3 editable curve domains distinct",
      "Real browser on WebGL1/WebGL2/WebGPU: original pixels unchanged outside exact B mask; amplitude0 pixel identical; high-frequency selected-scene distortion changes pixels inside",
      "120f seamless loop, optional 60f stop fade (last included frame119 neutral), 30/60/120fps timestamp independence and reverse deterministic seek",
      "R/G/B displacement data, glow-only transparent straight alpha, composite with baked source all distinct and declared; no full-background arbitrary overlay claim",
      "4 independently seeded stable emitters, two toggleable independent layers, draggable centerline and world/local Spine bone/slot/attachment, isolated missing anchor",
      "Full 120f triple PNG sequences with CRC, no-crop and cancellation/restore, 1-3600 frame bounds, 512x512, no PMA fringe",
      "Pinned WebGL/WebGPU Vite developer ZIP builds/ESM exact parity and live browser source capture, FX-CORE-07 real screenshots with SHA matched to pushed main",
      "Preserve all prior FIRE-01..05, FX-CORE and protected Burn baseline vendor/30 controls"
    ]
  },
  "outOfScope": [
    "No physically modeled volumetric heat waves or CFD; deterministic procedural spatial noise is an approximation",
    "No capture of DOM/CSS/external iframe/whole screen, no background input inference",
    "No blanket blur, unsupported full-scene refraction, new pixi-filters dependency or Pixi/Spine runtime upgrade",
    "No claim of mobile GPU FPS/thermal performance from headless Chromium",
    "Transparent glow PNG can never reproduce future game-background refraction; use typed displacement map with an integration filter"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "amplitude": "settings.amplitude",
      "noiseFrequency": "settings.noiseFrequency",
      "verticalFlow": "settings.verticalFlow",
      "regionWidth": "settings.regionWidth",
      "edgeFalloff": "settings.edgeFalloff",
      "density": "settings.density",
      "durationFrames": "settings.durationFrames",
      "stopFrame": "settings.stopFrame",
      "fadeFrames": "settings.fadeFrames",
      "exportFrames": "settings.exportFrames",
      "seed": "settings.seed",
      "pulseRate": "settings.pulseRate",
      "pulseJitter": "settings.pulseJitter",
      "gustRate": "settings.gustRate",
      "gustJitter": "settings.gustJitter",
      "nodeGap": "settings.nodeGap",
      "nodeJitter": "settings.nodeJitter",
      "gustEnabled": "settings.gustEnabled",
      "mode": "settings.mode",
      "style": "settings.style",
      "spatialMode": "settings.spatialMode",
      "quality": "settings.quality"
    },
    "preview": "assets/Heat_Haze_Lab.html",
    "pngBake": "HazeExports.bake all/displacement/glow/composite; real 512px 60fps PNG ZIP with types, R/G signed displacement, B coverage, A255 or straight glow; explicit Pixi source composited RGBA",
    "developerZip": "HazeExports.buildPackage('webgl'|'webgpu') pinned Vite with exact FxHaze.mjs and HeatHaze.mjs, consumer-supplied source-scene contract",
    "invariant": "Single exact pure FxHaze numerical source and Pixi runtime in preview and both exported Vite apps, independent typed displacement/glow/composite products"
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject",
    "policy": "No coercion of unknown schema/version/effect IDs. Add explicit versioned migration tests before compatibility changes."
  },
  "implementation": {
    "status": "reference-implementation",
    "sourceFiles": [
      "assets/heat-haze/src/haze-core.js",
      "assets/heat-haze/src/haze-runtime.js",
      "assets/heat-haze/src/haze-editor.js",
      "assets/heat-haze/src/haze-export.js",
      "assets/heat-haze/src/zip-core.js",
      "assets/heat-haze/src/ui.html",
      "assets/Heat_Haze_Lab.html",
      "scripts/build_haze_editor.py"
    ],
    "notes": "FIRE-06 isolated real PixiJS 8.22.0 and Spine4.2 heat displacement/coverage/glow renderer, typed PNG ZIP and pinned developer packages."
  }
}
```

## Sources and verification

Build: `python scripts/build_haze_editor.py --output assets/Heat_Haze_Lab.html`. Numerical: `node scripts/test_haze_core.cjs`. Actual browser: `node scripts/test_haze_editor.cjs --backend webgl1|webgl2|webgpu --output OUT`. Evidence: `node scripts/test_haze_evidence.cjs OUT` then `python scripts/effect_validation.py OUT/effect-evidence.json --require-pass`. Developer: extract ZIP, compare ESM, npm install/build, run each actual browser example. No claim of future-background refraction from a static transparent PNG.
