# EARTH-04 — Falling Leaves

**Status:** implementation candidate; real browser/GPU acceptance pending. Issue [#32](https://github.com/maximsokal/pixi-spine-fx-lab/issues/32). The machine-readable v1 lifecycle is specification-only until the evidence gate passes; the editor source already exists.

Build from a full checkout: `python scripts/build_leaves_editor.py --output /absolute/path/outside/repo/Falling_Leaves_Lab.html`.

The fixed logical field is 512×512, 60 FPS, exactly 120 half-open samples (0–119). Earlier periodic cohorts keep individual leaf trajectories continuous. Foreground and background have independent seed, XY, rate, speed, size, alpha and parallax; gusts are optional. Layer offsets share the emitter anchor; use separate emitters for independent bone targets. Four local procedural 64×64 masks require no network assets. Low/Balanced/High cap the total allocated primitives at 256/1024/4096; up to four emitters; overflow is rejected rather than silently clipping. These are software limits, not device benchmarks.

Preview, isolated PNG and developer examples use the same core/runtime/Spine loader. The PNG archive excludes the model; the developer archives retain assets and bundled libraries, with reported WebGPU fallback. Fixed field clipping is intentional. Run `node --test scripts/test_leaves_core.cjs scripts/test_leaves_real_runtime.cjs scripts/test_leaves_editor.cjs scripts/test_leaves_export.cjs`, `python scripts/test_leaves_builder.py`, `python scripts/test_leaves_pixel_oracle.py` and the browser diagnostic for each backend before promotion. Native GPU/pixel/asset and architecture acceptance remains NOT RUN.

## Machine-readable Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.earth.falling-leaves",
  "effectVersion": "0.1.0",
  "presetSchemaVersion": 1,
  "category": "earth",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "Light autumn leaves drift and tumble with independent foreground, background and optional wind streaks in a seamless pre-rolled field.",
  "phases": [
    {
      "id": "start",
      "at": 0,
      "look": "Pre-rolled populated field, individually fading leaves"
    },
    {
      "id": "middle",
      "at": 0.5,
      "look": "Continuing fall, curved flutter and independent foreground/background drift"
    },
    {
      "id": "seam",
      "at": 1,
      "look": "Exact periodic sample matches start; no global reset"
    }
  ],
  "layers": [
    {
      "id": "foreground",
      "kind": "particles",
      "position": "front",
      "purpose": "Larger rotating leaves"
    },
    {
      "id": "background",
      "kind": "particles",
      "position": "behind",
      "purpose": "Slower smaller leaves and independent parallax"
    },
    {
      "id": "gusts",
      "kind": "particles",
      "position": "front",
      "purpose": "Optional subtle gust streaks, disabled by default"
    }
  ],
  "emitterAnchors": [
    {
      "id": "emitter",
      "space": "world/local/Spine skeleton/bone/slot/attachment",
      "onMissing": "hide-only-this-emitter"
    }
  ],
  "parameters": [
    {
      "key": "leafRate",
      "type": "number",
      "default": 10,
      "unit": "events/s",
      "controlGroup": "Leaves",
      "exportPath": "settings.leafRate",
      "min": 0,
      "max": 80,
      "step": 1
    },
    {
      "key": "leafSize",
      "type": "number",
      "default": 18,
      "unit": "px",
      "controlGroup": "Leaves",
      "exportPath": "settings.leafSize",
      "min": 6,
      "max": 40,
      "step": 0.5
    },
    {
      "key": "fallSpeed",
      "type": "number",
      "default": 55,
      "unit": "px/s",
      "controlGroup": "Motion",
      "exportPath": "settings.fallSpeed",
      "min": 5,
      "max": 230,
      "step": 1
    },
    {
      "key": "windSpeed",
      "type": "number",
      "default": 30,
      "unit": "px/s",
      "controlGroup": "Motion",
      "exportPath": "settings.windSpeed",
      "min": -140,
      "max": 140,
      "step": 1
    },
    {
      "key": "tumble",
      "type": "number",
      "default": 110,
      "unit": "deg/s",
      "controlGroup": "Motion",
      "exportPath": "settings.tumble",
      "min": 0,
      "max": 360,
      "step": 1
    },
    {
      "key": "shapeVariance",
      "type": "number",
      "default": 0.4,
      "unit": "normalized",
      "controlGroup": "Leaves",
      "exportPath": "settings.shapeVariance",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "lifetime",
      "type": "number",
      "default": 4,
      "unit": "s",
      "controlGroup": "Motion",
      "exportPath": "settings.lifetime",
      "min": 0.25,
      "max": 8,
      "step": 0.05
    },
    {
      "key": "flutterAmplitude",
      "type": "number",
      "default": 22,
      "unit": "px",
      "controlGroup": "Motion",
      "exportPath": "settings.flutterAmplitude",
      "min": 0,
      "max": 100,
      "step": 1
    },
    {
      "key": "flutterFrequency",
      "type": "number",
      "default": 1.2,
      "unit": "Hz",
      "controlGroup": "Motion",
      "exportPath": "settings.flutterFrequency",
      "min": 0,
      "max": 8,
      "step": 0.05
    },
    {
      "key": "fieldWidth",
      "type": "number",
      "default": 440,
      "unit": "px",
      "controlGroup": "Spacing",
      "exportPath": "settings.fieldWidth",
      "min": 120,
      "max": 512,
      "step": 1
    },
    {
      "key": "gustRate",
      "type": "number",
      "default": 3,
      "unit": "events/s",
      "controlGroup": "Leaves",
      "exportPath": "settings.gustRate",
      "min": 0,
      "max": 20,
      "step": 1
    },
    {
      "key": "spatialGap",
      "type": "number",
      "default": 25,
      "unit": "px",
      "controlGroup": "Spacing",
      "exportPath": "settings.spatialGap",
      "min": 5,
      "max": 120,
      "step": 1
    },
    {
      "key": "minGap",
      "type": "number",
      "default": 5,
      "unit": "px",
      "controlGroup": "Spacing",
      "exportPath": "settings.minGap",
      "min": 5,
      "max": 120,
      "step": 1
    },
    {
      "key": "spatialJitter",
      "type": "number",
      "default": 0.15,
      "unit": "normalized",
      "controlGroup": "Spacing",
      "exportPath": "settings.spatialJitter",
      "min": 0,
      "max": 0.45,
      "step": 0.01
    },
    {
      "key": "timeJitter",
      "type": "number",
      "default": 0,
      "unit": "normalized",
      "controlGroup": "Timing",
      "exportPath": "settings.timeJitter",
      "min": 0,
      "max": 0.45,
      "step": 0.01
    },
    {
      "key": "spawnDelay",
      "type": "number",
      "default": 0,
      "unit": "s",
      "controlGroup": "Timing",
      "exportPath": "settings.spawnDelay",
      "min": 0,
      "max": 2,
      "step": 0.01
    },
    {
      "key": "burstCount",
      "type": "integer",
      "default": 3,
      "unit": "events",
      "controlGroup": "Timing",
      "exportPath": "settings.burstCount",
      "min": 1,
      "max": 16,
      "step": 1
    },
    {
      "key": "burstDelay",
      "type": "number",
      "default": 0.04,
      "unit": "s",
      "controlGroup": "Timing",
      "exportPath": "settings.burstDelay",
      "min": 0,
      "max": 0.5,
      "step": 0.01
    },
    {
      "key": "seed",
      "type": "integer",
      "default": 91271,
      "unit": "int32",
      "controlGroup": "Advanced",
      "exportPath": "settings.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "spatialMode",
      "type": "enum",
      "default": "stratified",
      "unit": "mode",
      "controlGroup": "Spacing",
      "exportPath": "settings.spatialMode",
      "choices": [
        "even",
        "stratified",
        "random",
        "clustered"
      ]
    },
    {
      "key": "timingMode",
      "type": "enum",
      "default": "custom",
      "unit": "mode",
      "controlGroup": "Timing",
      "exportPath": "settings.timingMode",
      "choices": [
        "uniform",
        "custom",
        "clustered",
        "burst"
      ]
    },
    {
      "key": "quality",
      "type": "enum",
      "default": "balanced",
      "unit": "mode",
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
      "unit": "mode",
      "controlGroup": "Color",
      "exportPath": "settings.style",
      "choices": [
        "natural",
        "stylized",
        "magical"
      ]
    },
    {
      "key": "spacingCurveEnabled",
      "type": "boolean",
      "default": false,
      "unit": "boolean",
      "controlGroup": "Spacing",
      "exportPath": "settings.spacingCurveEnabled"
    }
  ],
  "controlGroups": [
    "Leaves",
    "Motion",
    "Spacing",
    "Timing",
    "Color",
    "Advanced"
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
      "id": "rateCurve",
      "key": "rateCurve",
      "domain": "emitterTime",
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
      "id": "spacingCurve",
      "key": "spacingCurve",
      "domain": "pathPosition",
      "contract": "curves",
      "keys": [
        [
          0,
          25
        ],
        [
          1,
          25
        ]
      ]
    },
    {
      "id": "driftCurve",
      "key": "driftCurve",
      "domain": "particleAge",
      "contract": "curves",
      "keys": [
        [
          0,
          0.2
        ],
        [
          0.4,
          1
        ],
        [
          1,
          0.3
        ]
      ]
    },
    {
      "id": "spinCurve",
      "key": "spinCurve",
      "domain": "particleAge",
      "contract": "curves",
      "keys": [
        [
          0,
          0.7
        ],
        [
          0.5,
          1
        ],
        [
          1,
          0.5
        ]
      ]
    },
    {
      "id": "alphaCurve",
      "key": "alphaCurve",
      "domain": "particleAge",
      "contract": "curves",
      "keys": [
        [
          0,
          0
        ],
        [
          0.1,
          1
        ],
        [
          0.9,
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
    "contract": "spacing",
    "temporal": "Independent event rate, periodic delay, jitter, custom rate curve and bursts.",
    "spatial": "Seeded horizontal cubic arc-length lanes, editable gap/minGap/jitter and spacing curve; independent of event count."
  },
  "palettes": [
    {
      "id": "leaf-rgba",
      "key": "palette",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#E8B252",
        "#9E6F32",
        "#8F9A55"
      ]
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "Document, emitter and layer seed plus stable event index; no global RNG."
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
    "strategy": "Native pooled sprites, four local procedural masks, isolated frame sampling; WebGPU developer fallback to WebGL is reported. Actual raster acceptance pending."
  },
  "qualityBudgets": {
    "low": {
      "primitives": 256,
      "maxEmitters": 4
    },
    "balanced": {
      "primitives": 1024,
      "maxEmitters": 4
    },
    "high": {
      "primitives": 4096,
      "maxEmitters": 4
    }
  },
  "tests": {
    "verified": false,
    "evidence": [],
    "required": [
      "Actual WebGL1/2 and WebGPU visual phases, loop seam and all-off transparent PNG",
      "Every artist control and curve, layer movement/spacing, real Spine JSON/SKEL and missing anchors",
      "120-frame PNG independent decode/CRC, repeat/camera invariance, both offline developer examples and architecture gates"
    ]
  },
  "outOfScope": [
    "Fixed 512x512 crop, fixed 120-frame loop; no arbitrary crop or one-shot claim",
    "Layer offsets share emitter anchor; use distinct emitters for independent anchor targets",
    "No measured physical GPU performance; actual browser/asset/ZIP acceptance pending"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "leafRate": "settings.leafRate",
      "leafSize": "settings.leafSize",
      "fallSpeed": "settings.fallSpeed",
      "windSpeed": "settings.windSpeed",
      "tumble": "settings.tumble",
      "shapeVariance": "settings.shapeVariance",
      "lifetime": "settings.lifetime",
      "flutterAmplitude": "settings.flutterAmplitude",
      "flutterFrequency": "settings.flutterFrequency",
      "fieldWidth": "settings.fieldWidth",
      "gustRate": "settings.gustRate",
      "spatialGap": "settings.spatialGap",
      "minGap": "settings.minGap",
      "spatialJitter": "settings.spatialJitter",
      "timeJitter": "settings.timeJitter",
      "spawnDelay": "settings.spawnDelay",
      "burstCount": "settings.burstCount",
      "burstDelay": "settings.burstDelay",
      "seed": "settings.seed",
      "spatialMode": "settings.spatialMode",
      "timingMode": "settings.timingMode",
      "quality": "settings.quality",
      "style": "settings.style",
      "spacingCurveEnabled": "settings.spacingCurveEnabled"
    },
    "preview": "not-implemented",
    "pngBake": "not-implemented",
    "developerZip": "not-implemented",
    "invariant": "Candidate source exists; schema v1 reserves export claims for verified reference implementations."
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject"
  },
  "implementation": {
    "status": "specification-only",
    "sourceFiles": [],
    "notes": "L01–L04 implementation candidate in assets/falling-leaves/src; use scripts/build_leaves_editor.py. Do not reimplement. L05 acceptance pending."
  }
}
```
