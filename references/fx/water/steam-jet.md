# WATER-06 — Steam Jet

An independent, offline procedural vapor effect that does not modify Smoke Plume or previous WATER effects.

## Versioned Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.water.steam-jet",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "water",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "WATER-06 Steam Jet: 12 true vapor births per second at a physical 20px target-spaced nozzle. Original diameter18px and expansion2.2x; 90px/s flow integrates editable slowing speed curve, diffusion0.55 and softness0.7. Three independent FX-owned native Pixi8.22 particle atlas layers (dense/wisps/optional droplets), 60-frame 60fps periodic loop with 40-frame stop fade ending alpha0 at frame39; isolated 512px RGBA8 PNG ZIP plus two exact-source offline developer packages.",
  "phases": [
    {
      "id": "nozzle",
      "at": 0,
      "look": "Already visible narrow dense vapor from previous cycles"
    },
    {
      "id": "expansion",
      "at": 0.5,
      "look": "Cool white soft lofted wisps, slowdown and optional condensation"
    },
    {
      "id": "seam",
      "at": 1,
      "look": "Local FX matches t0 at t1; stop mode fully transparent on included f39"
    }
  ],
  "layers": [
    {
      "id": "dense",
      "kind": "particles",
      "position": "Independent world/local/Spine4.2 anchor or inherited emitter with local XY, alpha, blend and time offset",
      "purpose": "Brightest near-nozzle vapor, age-driven size/opacity/speed"
    },
    {
      "id": "wisps",
      "kind": "particles",
      "position": "Independent world/local/Spine4.2 anchor or inherited emitter with local XY, alpha, blend and time offset",
      "purpose": "Wider translucent trailing steam, every second birth"
    },
    {
      "id": "droplets",
      "kind": "particles",
      "position": "Independent world/local/Spine4.2 anchor or inherited emitter with local XY, alpha, blend and time offset",
      "purpose": "Optional age-triggered small condensate drops, descending ballistic offset"
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
      "default": 12,
      "min": 0,
      "max": 100,
      "step": 1,
      "unit": "events/s",
      "controlGroup": "Steam physics",
      "exportPath": "settings.rate"
    },
    {
      "key": "initialSize",
      "type": "number",
      "default": 18,
      "min": 3,
      "max": 90,
      "step": 0.5,
      "unit": "diameter px",
      "controlGroup": "Steam physics",
      "exportPath": "settings.initialSize"
    },
    {
      "key": "expansion",
      "type": "number",
      "default": 2.2,
      "min": 1,
      "max": 6,
      "step": 0.05,
      "unit": "diameter multiplier",
      "controlGroup": "Steam physics",
      "exportPath": "settings.expansion"
    },
    {
      "key": "flowSpeed",
      "type": "number",
      "default": 90,
      "min": 0,
      "max": 400,
      "step": 1,
      "unit": "px/s",
      "controlGroup": "Steam physics",
      "exportPath": "settings.flowSpeed"
    },
    {
      "key": "diffusion",
      "type": "number",
      "default": 0.55,
      "min": 0,
      "max": 1,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Steam physics",
      "exportPath": "settings.diffusion"
    },
    {
      "key": "softness",
      "type": "number",
      "default": 0.7,
      "min": 0,
      "max": 1,
      "step": 0.01,
      "unit": "edge rolloff",
      "controlGroup": "Steam physics",
      "exportPath": "settings.softness"
    },
    {
      "key": "lifetimeSeconds",
      "type": "number",
      "default": 1.8,
      "min": 0.1,
      "max": 10,
      "step": 0.1,
      "unit": "seconds",
      "controlGroup": "Steam physics",
      "exportPath": "settings.lifetimeSeconds"
    },
    {
      "key": "windX",
      "type": "number",
      "default": 0,
      "min": -250,
      "max": 250,
      "step": 1,
      "unit": "px/s",
      "controlGroup": "Steam physics",
      "exportPath": "settings.windX"
    },
    {
      "key": "curlScale",
      "type": "number",
      "default": 16,
      "min": 0,
      "max": 150,
      "step": 0.5,
      "unit": "px",
      "controlGroup": "Steam physics",
      "exportPath": "settings.curlScale"
    },
    {
      "key": "nozzleWidth",
      "type": "number",
      "default": 64,
      "min": 0,
      "max": 500,
      "step": 1,
      "unit": "px",
      "controlGroup": "Nozzle spacing",
      "exportPath": "settings.nozzleWidth"
    },
    {
      "key": "originGap",
      "type": "number",
      "default": 20,
      "min": 0,
      "max": 80,
      "step": 0.25,
      "unit": "px",
      "controlGroup": "Nozzle spacing",
      "exportPath": "settings.originGap"
    },
    {
      "key": "spatialJitter",
      "type": "number",
      "default": 0.35,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Nozzle spacing",
      "exportPath": "settings.spatialJitter"
    },
    {
      "key": "intervalJitter",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Emitter time",
      "exportPath": "settings.intervalJitter"
    },
    {
      "key": "exportFrames",
      "type": "number",
      "default": 60,
      "min": 1,
      "max": 3600,
      "step": 1,
      "unit": "frames",
      "controlGroup": "Export",
      "exportPath": "settings.exportFrames"
    },
    {
      "key": "seed",
      "type": "number",
      "default": 217,
      "min": -2147483648,
      "max": 2147483647,
      "step": 1,
      "unit": "int32",
      "controlGroup": "Emitter time",
      "exportPath": "settings.seed"
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
      "controlGroup": "Emitter time",
      "exportPath": "settings.mode"
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
      "controlGroup": "Export",
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
      "controlGroup": "Palette",
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
      "controlGroup": "Nozzle spacing",
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
      "controlGroup": "Emitter time",
      "exportPath": "settings.emissionMode"
    }
  ],
  "controlGroups": [
    "Steam physics",
    "Nozzle spacing",
    "Emitter time",
    "Palette",
    "Export",
    "Independent emitters/layers"
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
      "id": "steam-sizeCurve",
      "key": "sizeCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "steam-opacityCurve",
      "key": "opacityCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "steam-flowCurve",
      "key": "flowCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "steam-emissionRateCurve",
      "key": "emissionRateCurve",
      "domain": "emitterTime",
      "contract": "curves"
    },
    {
      "id": "steam-spacingCurve",
      "key": "spacingCurve",
      "domain": "pathPosition",
      "contract": "curves"
    }
  ],
  "spacing": {
    "contract": "spacing",
    "temporal": "FxSpacing.createTemporalSchedule at 12/s; 12 events per 1s incl event t=1 -> 0 half-open wrap, no artificial duplicate; independent editable emitterTime frequency curve.",
    "spatial": "FxSpacing.createSpatialPlacement/pointAtDistance measured by true physical arc length 64px nozzle, 20px target gap with <=35 percent jitter in even mode, recentered origins; .25px maximum global arc error.",
    "history": "60f 1s loop reconstructs negative cycle pre-roll to lifetime1.8; matching exact pure local geometry at t0/t1. Stop starts from full plume and fades to alpha0 on frame39.",
    "motion": "True integrated speed: 90*1.8*(u-.425u^2), end displacement 93.15px; seeded perpendicular diffusion, wind independent. Diameter starts18px, ends39.6px; age size curve shapes intermediate growth.",
    "coordinate": "Stage logical 512x512 default world anchor (256,420). Nonperiodic external Spine poses cannot guarantee same f0/f60 world pixels.",
    "quality": "Independent capped candidates and active primitives for four emitters; no silent truncation."
  },
  "palettes": [
    {
      "id": "steam-rgba",
      "key": "palette",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#F5F9FB",
        "#ADBFC8"
      ],
      "alpha": "Separate editable RGBA alpha; normal/additive/screen/multiply per layer; white mask RGB even at zero alpha; PNG straight RGBA8."
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
    "strategy": "Effect-owned native ParticleContainer per layer, four organic masks per layer in a single ImageSource canvas atlas. Softness redraws an existing atlas only on settings change, then ImageSource.update(); dynamic Pixi8.22 particle x/y/scale/rotation/color/UV.",
    "alpha": "Separate FX-only 512px straight-RGBA8 PNG, no Spine source, guides or CSS camera. No PMA fringes.",
    "crop": "Reject side/bottom overflows; top-life exit explicitly tracked. Camera/zoom independent of bake.",
    "spine": "Optional Spine 4.2 multipage JSON/atlas, world/skeleton/bone/slot/attachment/inherit independent layers; missing layer hides only affected layer.",
    "hardware": "Real Chrome test required per WebGL1/2/WebGPU; physical phone thermal and matching binary SKEL not certified."
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
      "scripts/test_steam_core.cjs",
      "scripts/test_steam_particles.cjs",
      "scripts/test_steam_editor.cjs",
      "scripts/test_steam_export.cjs",
      "scripts/test_steam_full_bake.cjs",
      "scripts/test_steam_png_zip.cjs",
      "scripts/test_steam_layers.cjs",
      "scripts/test_steam_developer.cjs",
      "scripts/test_steam_evidence.cjs",
      "scripts/test_steam_packages.py"
    ],
    "required": [
      "Pure 12 half-open true timestamps and 20px arc-origin target, no double seam births",
      "18px to39.6px diameter, 93.15px integrated linear speed, 3 real age/time/path curves",
      "All declared controls change live pixels; true 3-layer native Pixi 8.22 source atlases with no per-frame allocation",
      "Actual WebGL1 WebGL2 WebGPU 512x512 screenshot evidence and 60-frame zero seam",
      "40f shutdown already-running start and f39 fully alpha0",
      "Spine4.2 multipage JSON source import and missing anchor independent layer isolation",
      "Full 60 PNG ZIP CRC and each decoded straight RGBA8 image, no source model or camera",
      "Two exact-source offline developer Vite ZIPs compile, render actual desired backend, no network",
      "Prior FIRE/WATER/FX-CORE regression tests and protected Burn file hashes unchanged"
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
      "initialSize": "settings.initialSize",
      "expansion": "settings.expansion",
      "flowSpeed": "settings.flowSpeed",
      "diffusion": "settings.diffusion",
      "softness": "settings.softness",
      "lifetimeSeconds": "settings.lifetimeSeconds",
      "windX": "settings.windX",
      "curlScale": "settings.curlScale",
      "nozzleWidth": "settings.nozzleWidth",
      "originGap": "settings.originGap",
      "spatialJitter": "settings.spatialJitter",
      "intervalJitter": "settings.intervalJitter",
      "exportFrames": "settings.exportFrames",
      "seed": "settings.seed",
      "mode": "settings.mode",
      "quality": "settings.quality",
      "style": "settings.style",
      "spatialMode": "settings.spatialMode",
      "emissionMode": "settings.emissionMode"
    },
    "preview": "assets/Steam_Jet_Lab.html independent offline editor with 3 layers and five curves",
    "pngBake": "SteamExports.bake() 60 frame RGBA8 ZIP or 40 frame shutdown, with source Spine hidden",
    "developerZip": "SteamExports.buildPackage webgl/webgpu exports exact core/runtime source, pinned Pixi8.22 Spine4.2.120 Vite7.1.12",
    "invariant": "One identical source for live/bake/WebGL/WebGPU, no alternate renderer/shader or remote CDN."
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject"
  },
  "implementation": {
    "status": "reference-implementation",
    "sourceFiles": [
      "assets/steam-jet/src/steam-core.js",
      "assets/steam-jet/src/steam-runtime.js",
      "assets/steam-jet/src/steam-editor.js",
      "assets/steam-jet/src/steam-export.js",
      "assets/steam-jet/src/zip-core.js",
      "assets/steam-jet/src/ui.html",
      "assets/Steam_Jet_Lab.html",
      "scripts/build_steam_editor.py"
    ],
    "notes": "WATER-06 independent Steam Jet effect in actual Pixi8.22 WebGL1/2/WebGPU, 60f 512x512 PNGs, two Vite ZIP builds. Physical-device thermal and matching binary SKEL NOT RUN."
  }
}
```

## Test-first implementation

See https://github.com/maximsokal/pixi-spine-fx-lab/issues/22 for audited formulas, RED/GREEN and backend acceptance.
