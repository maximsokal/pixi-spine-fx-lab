# AIR-01 — Wind Gust

Independent 40-frame directional wind streaks and optional dust; additional 60-frame seamless mode.

## Versioned Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.air.wind-gust",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "air",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "AIR-01 Wind Gust. Curved translucent, gradually tapered MeshSimple air ribbons with optional independently anchored small dust, no frozen rays or background distortion. Default 40 authored frames 60Hz: alpha0 at f0 and f39, quick ramp to concentrated gust, slow dispersion. Alternate 60f strictly periodic loop. 160px/s wind speed, width120px, 12 maximum simultaneously active ribbons, curveAmount.3, thickness3px, direction0deg. Independent 20 birth events/s and actual true arc-length gap14px along cubic airflow. 5 editable effectTime/pathPosition/particleAge curves, seed- and id-stable world/Spine anchors. Color #EAF5F8->#A8CED7 editable RGBA, Natural/Stylized/Magical styles. Actual Pixi8.22 WebGL1/WebGL2/WebGPU, straight-alpha isolated PNG and exact source offline Vite WebGL/WebGPU developer ZIPs. Budget Low/Balanced/High includes GPU geometry.",
  "phases": [
    {
      "id": "rampIn",
      "at": 0,
      "look": "A gust begins on clear frame0, f1+ shows a few faint narrow tapered curves; smooth alpha strength attack"
    },
    {
      "id": "concentrated",
      "at": 0.5,
      "look": "Several seeded curved cool-blue wind ribbons simultaneously and a few optional dust motes, with visible thickness/width bend"
    },
    {
      "id": "dispersion",
      "at": 1,
      "look": "At f39 in 40f mode fully transparent; 60f loop returns exactly to f0 with analytical pre-roll and no jump"
    }
  ],
  "layers": [
    {
      "id": "streaks",
      "kind": "geometry",
      "position": "Own world/local/Spine4.2 bone/slot/attachment or inherit emitter anchor, independent x/y/rotation/timeOffset/seed/alpha/blend",
      "purpose": "Up to 12 simultaneous separate curving, zero-tip tapered cubic MeshSimple wind ribbons. True arc-length physical spawn placement."
    },
    {
      "id": "dust",
      "kind": "particles",
      "position": "Independently anchorable/toggleable world/Spine layer; drag handle shares viewport",
      "purpose": "Optional sparse seeded soft-alpha airborne small dust motes, physically advected with wind. No hidden extra FX rays."
    }
  ],
  "emitterAnchors": [
    {
      "id": "world",
      "space": "logical 512×512 px",
      "onMissing": "n/a"
    },
    {
      "id": "skeleton",
      "space": "Spine-skeleton-local",
      "onMissing": "hide only affected layer and report diagnostic"
    },
    {
      "id": "bone",
      "space": "Spine-bone-local",
      "onMissing": "hide only affected layer and report diagnostic"
    },
    {
      "id": "slot",
      "space": "Spine-slot-local",
      "onMissing": "hide only affected layer and report diagnostic"
    },
    {
      "id": "attachment",
      "space": "Spine active attachment centroid-local",
      "onMissing": "hide only affected layer and report diagnostic"
    },
    {
      "id": "inherit",
      "space": "current emitter anchored world pose and local offsets",
      "onMissing": "hide only affected layer if inherited emitter missing"
    }
  ],
  "parameters": [
    {
      "key": "windSpeed",
      "type": "number",
      "default": 160,
      "min": 0,
      "max": 700,
      "step": 1,
      "unit": "px/s",
      "controlGroup": "Wind flow",
      "exportPath": "settings.windSpeed"
    },
    {
      "key": "gustWidth",
      "type": "number",
      "default": 120,
      "min": 10,
      "max": 320,
      "step": 1,
      "unit": "px",
      "controlGroup": "Wind flow",
      "exportPath": "settings.gustWidth"
    },
    {
      "key": "streakCount",
      "type": "integer",
      "default": 12,
      "min": 0,
      "max": 80,
      "step": 1,
      "unit": "max-visible-ribbons",
      "controlGroup": "Wind flow",
      "exportPath": "settings.streakCount"
    },
    {
      "key": "curveAmount",
      "type": "number",
      "default": 0.3,
      "min": 0,
      "max": 1,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Wind flow",
      "exportPath": "settings.curveAmount"
    },
    {
      "key": "streakThickness",
      "type": "number",
      "default": 3,
      "min": 0.5,
      "max": 18,
      "step": 0.1,
      "unit": "full px",
      "controlGroup": "Wind flow",
      "exportPath": "settings.streakThickness"
    },
    {
      "key": "windDirection",
      "type": "number",
      "default": 0,
      "min": -180,
      "max": 180,
      "step": 1,
      "unit": "degrees, 0=right",
      "controlGroup": "Wind flow",
      "exportPath": "settings.windDirection"
    },
    {
      "key": "streakLength",
      "type": "number",
      "default": 90,
      "min": 10,
      "max": 220,
      "step": 1,
      "unit": "px",
      "controlGroup": "Wind flow",
      "exportPath": "settings.streakLength"
    },
    {
      "key": "streakLifetime",
      "type": "number",
      "default": 0.6,
      "min": 0.12,
      "max": 3,
      "step": 0.02,
      "unit": "seconds",
      "controlGroup": "Wind flow",
      "exportPath": "settings.streakLifetime"
    },
    {
      "key": "birthRate",
      "type": "number",
      "default": 20,
      "min": 0,
      "max": 100,
      "step": 1,
      "unit": "events/s",
      "controlGroup": "Timing and true arc spacing",
      "exportPath": "settings.birthRate"
    },
    {
      "key": "streakGap",
      "type": "number",
      "default": 14,
      "min": 2,
      "max": 90,
      "step": 0.5,
      "unit": "true arc px",
      "controlGroup": "Timing and true arc spacing",
      "exportPath": "settings.streakGap"
    },
    {
      "key": "dustRate",
      "type": "number",
      "default": 4,
      "min": 0,
      "max": 80,
      "step": 1,
      "unit": "events/s",
      "controlGroup": "Timing and true arc spacing",
      "exportPath": "settings.dustRate"
    },
    {
      "key": "spatialJitter",
      "type": "number",
      "default": 0.12,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Timing and true arc spacing",
      "exportPath": "settings.spatialJitter"
    },
    {
      "key": "seed",
      "type": "integer",
      "default": 7321,
      "min": -2147483648,
      "max": 2147483647,
      "step": 1,
      "unit": "int32",
      "controlGroup": "Output and quality",
      "exportPath": "settings.seed"
    },
    {
      "key": "exportFrames",
      "type": "integer",
      "default": 40,
      "min": 1,
      "max": 3600,
      "step": 1,
      "unit": "frames @60Hz",
      "controlGroup": "Output and quality",
      "exportPath": "settings.exportFrames"
    },
    {
      "key": "mode",
      "type": "enum",
      "default": "burst",
      "choices": [
        "burst",
        "loop"
      ],
      "unit": "enum",
      "controlGroup": "Output and quality",
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
      "controlGroup": "Output and quality",
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
      "controlGroup": "Palette and RGBA",
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
      "controlGroup": "Timing and true arc spacing",
      "exportPath": "settings.spatialMode"
    }
  ],
  "controlGroups": [
    "Wind flow",
    "Timing and true arc spacing",
    "Output and quality",
    "Palette and RGBA",
    "Independent emitters and layer anchors"
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
      "id": "wind-gustStrengthCurve",
      "key": "gustStrengthCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "wind-streakWidthCurve",
      "key": "streakWidthCurve",
      "domain": "pathPosition",
      "contract": "curves"
    },
    {
      "id": "wind-streakAlphaCurve",
      "key": "streakAlphaCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "wind-emissionRateCurve",
      "key": "emissionRateCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "wind-spacingCurve",
      "key": "spacingCurve",
      "domain": "pathPosition",
      "contract": "curves"
    }
  ],
  "spacing": {
    "contract": "spacing",
    "temporal": "FxSpacing.createTemporalSchedule integrates emissionRateCurve effectTime to emitterTime. Default20 actual births/sec independent of speed, width and gap; burst duration40/60; loop duration1. Boundary t=1 is shifted to phase0 once and negative prior-cycle candidates reconstructed. Separate dustRate4/s.",
    "spatial": "FxSpacing.createSpatialPlacement on curved cubic airflow path, default streakGap14px, normalized spacingCurve multiplied by physical streakGap even when enabled; true arc-length error <=0.25px. Modes even/random/clustered and deterministic indexed jitter. Empty path fallback when 0 relevant candidates.",
    "capacity": "streakCount12 means max simultaneously visible ribbons, not births/sec. Expired candidates not drawn, source remains deterministic; report capacity suppressions, no silent GPU overrun. Set rate0/count0/layer off draws none.",
    "motion": "windSpeed160px/s drives position, windDirection0deg drives geometric direction (right). gustWidth120px crosswind lateral spread, curveAmount.3 controls actual cubic bend; streakThickness3px is full visible path width, taper0 at both ends.",
    "timing": "40f 60fps burst alpha0 at frame0 and39. Optional 60f periodic loop f0 equals time1; source Spine pose must repeat for world-pixel seam; nonperiodic externally animated source cannot be falsely advertised seamless.",
    "coordinates": "Default world emitter anchor at logical (256,256). Preview camera zoom must not affect baked position, width or PNG.",
    "quality": "Independent per-quality and all-emitter caps for active MeshSimple vertices, dust particles and event history; preflight rejects impossible settings."
  },
  "palettes": [
    {
      "id": "wind-rgba",
      "key": "palette",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#EAF5F8",
        "#A8CED7"
      ],
      "alpha": "Two independent editable RGBA alpha stops, Natural/Stylized/Magical palettes and normal/add/screen/multiply blend. White mask RGB at fully transparent alpha, straight RGBA8 512px PNG."
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "stable emitter and independent layer seeds and IDs survive reorder, mute, seek and export."
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
    "strategy": "Pooled typed-buffer MeshSimple per curved path; FxPath.buildRibbon exact taper/arc calculation; single effect-owned procedural alpha texture built at init; native 32px ParticleContainer for optional dust. Update geometry buffers, not texture every seek; destroy own resources only.",
    "alpha": "512x512 transparent RGBA8 straight alpha isolated FX-only output. No checkerboard, caller Spine skeleton, guides or camera.",
    "crop": "Artist-visible error for side/bottom clipping; no silent trim or extra decorative rays.",
    "spine": "Real 4.2.x two-page Doctor JSON preview and optional upload JSON/SKEL+atlas; per-layer world/skeleton/bone/slot/attachment/inherit independent missing-anchor suppression.",
    "device": "Chrome GPU WebGL1/2/WebGPU required; phone thermal and matching binary SKEL are NOT RUN."
  },
  "qualityBudgets": {
    "low": {
      "maxStreaks": 64,
      "maxDust": 100,
      "maxVertices": 6500,
      "maxEvents": 300,
      "maxEmitters": 4
    },
    "balanced": {
      "maxStreaks": 160,
      "maxDust": 320,
      "maxVertices": 16000,
      "maxEvents": 700,
      "maxEmitters": 4
    },
    "high": {
      "maxStreaks": 320,
      "maxDust": 700,
      "maxVertices": 32000,
      "maxEvents": 1200,
      "maxEmitters": 4
    }
  },
  "tests": {
    "verified": true,
    "evidence": [
      "scripts/test_wind_core.cjs",
      "scripts/test_wind_gpu.cjs",
      "scripts/test_wind_editor.cjs",
      "scripts/test_wind_export.cjs",
      "scripts/test_wind_full_bake.cjs",
      "scripts/test_wind_png_zip.cjs",
      "scripts/test_wind_packages.py",
      "scripts/test_wind_developer.cjs",
      "scripts/test_wind_layers.cjs",
      "scripts/test_wind_evidence.cjs"
    ],
    "required": [
      "Numeric RED→GREEN 20/s true timestamp and 14px measured path arc, separate curve edits",
      "Gust f0 and f39 completely alpha0, f20 visibly curved streaks, loop f0/f60 pixel identical",
      "No hidden rays, zero both layers means no pixels, 0-count no ribbons, taper both ends 0",
      "Real Pixi8.22 MeshSimple and native particle GPU layer, stable allocations, direction rotates gust",
      "World/Spine independent named anchors, missing sibling isolation, 50/100/200% zoom drag",
      "Straight-alpha PNG with actual 40f and optional 60f CRC/decode, source Spine camera invariant",
      "Two exact-source Vite7.1.12 offline developer ZIPs build and play on actual WebGL/WebGPU",
      "FX-CORE-07 independent per-parameter/per-curve and three-phase SHA256 actual pixels",
      "Burn preserved hash checks and prior FIRE/WATER/FX-CORE regressions unchanged"
    ]
  },
  "outOfScope": [
    "No fluid dynamics",
    "No volumetric GPU simulation",
    "No opacity-aware background refraction shader",
    "No mobile phone FPS certification",
    "No support for Spine runtimes outside 4.2.x",
    "No per-frame atlas upload"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "windSpeed": "settings.windSpeed",
      "gustWidth": "settings.gustWidth",
      "streakCount": "settings.streakCount",
      "curveAmount": "settings.curveAmount",
      "streakThickness": "settings.streakThickness",
      "windDirection": "settings.windDirection",
      "streakLength": "settings.streakLength",
      "streakLifetime": "settings.streakLifetime",
      "birthRate": "settings.birthRate",
      "streakGap": "settings.streakGap",
      "dustRate": "settings.dustRate",
      "spatialJitter": "settings.spatialJitter",
      "seed": "settings.seed",
      "exportFrames": "settings.exportFrames",
      "mode": "settings.mode",
      "quality": "settings.quality",
      "style": "settings.style",
      "spatialMode": "settings.spatialMode"
    },
    "preview": "assets/Wind_Gust_Lab.html standalone offline two-layer artist editor",
    "pngBake": "WindExports.bake() isolated 512x512 RGBA8 40f gust or 60f loop",
    "developerZip": "WindExports.buildPackage(webgl/webgpu), exact FX core and renderer, pinned Pixi8.22.0, Spine4.2.120 and Vite7.1.12",
    "invariant": "Same numerical and runtime module used for preview, PNG and both developer ZIPs; no fake per-export renderer."
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject"
  },
  "implementation": {
    "status": "reference-implementation",
    "sourceFiles": [
      "assets/wind-gust/src/wind-core.js",
      "assets/wind-gust/src/wind-runtime.js",
      "assets/wind-gust/src/wind-editor.js",
      "assets/wind-gust/src/wind-export.js",
      "assets/wind-gust/src/zip-core.js",
      "assets/wind-gust/src/ui.html",
      "assets/Wind_Gust_Lab.html",
      "scripts/build_wind_editor.py"
    ],
    "notes": "Real native MeshSimple and ParticleContainer confirmed in WebGL1/2/WebGPU. Actual 40/60 PNG ZIP frames and two offline Vite developer builds verified. Physical phone performance and matching binary SKEL NOT RUN."
  }
}
```

## Reviewed execution plan

See https://github.com/maximsokal/pixi-spine-fx-lab/issues/23#issuecomment-7084880492 for technical grill-with-docs, known risks, and exact RED→GREEN gates.
