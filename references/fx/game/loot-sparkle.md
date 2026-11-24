# Loot Sparkle / Pickup Highlight

GAME-12 / #51. Independent offline editor. Build with the command below; no generated HTML committed. Lifetime and group spacing have cross-field constraints. Halo and sweep are off by default.

    python scripts/build_loot_editor.py --output ../Loot_Sparkle_Lab.html

## Machine-checkable Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.game.loot-sparkle",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "game",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "Seeded four-point gold and white stars around pickup, independent soft halo and finite shine sweep. Pickup 40 frames, idle 60 frames, logical 512x512 at 60 FPS.",
  "phases": [
    {
      "id": "appear",
      "at": 0,
      "look": "Transparent start before first birth"
    },
    {
      "id": "glint",
      "at": 0.5,
      "look": "Independent star glints at different ages"
    },
    {
      "id": "fade",
      "at": 1,
      "look": "Fully transparent pickup terminal frame"
    }
  ],
  "layers": [
    {
      "id": "stars",
      "kind": "geometry",
      "position": "Independent world/local/bone or inherited emitter anchor",
      "purpose": "Concave four-point stars"
    },
    {
      "id": "halo",
      "kind": "geometry",
      "position": "Independent world/local/bone or inherited emitter anchor",
      "purpose": "Bounded soft radial halo, optional"
    },
    {
      "id": "sweep",
      "kind": "geometry",
      "position": "Independent world/local/bone or inherited emitter anchor",
      "purpose": "Finite clipped shine band, optional"
    }
  ],
  "emitterAnchors": [
    {
      "id": "world",
      "space": "world",
      "onMissing": "hide dependent layer and diagnose"
    },
    {
      "id": "local",
      "space": "local",
      "onMissing": "hide dependent layer and diagnose"
    },
    {
      "id": "bone",
      "space": "bone",
      "onMissing": "hide dependent layer and diagnose"
    },
    {
      "id": "inherit",
      "space": "inherit",
      "onMissing": "hide dependent layer and diagnose"
    }
  ],
  "parameters": [
    {
      "key": "mode",
      "type": "enum",
      "default": "pickup",
      "choices": [
        "pickup",
        "idle"
      ],
      "unit": "mode",
      "controlGroup": "Effect",
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
      "unit": "mode",
      "controlGroup": "Effect",
      "exportPath": "settings.quality"
    },
    {
      "key": "distribution",
      "type": "enum",
      "default": "even",
      "choices": [
        "even",
        "random",
        "stratified",
        "clustered"
      ],
      "unit": "mode",
      "controlGroup": "Effect",
      "exportPath": "settings.distribution"
    },
    {
      "key": "frequencySource",
      "type": "enum",
      "default": "interval",
      "choices": [
        "interval",
        "rate"
      ],
      "unit": "mode",
      "controlGroup": "Effect",
      "exportPath": "settings.frequencySource"
    },
    {
      "key": "durationFrames",
      "type": "integer",
      "default": 40,
      "min": 2,
      "max": 3600,
      "step": 1,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.durationFrames"
    },
    {
      "key": "sparkleCount",
      "type": "integer",
      "default": 12,
      "min": 1,
      "max": 80,
      "step": 1,
      "unit": "count",
      "controlGroup": "Effect",
      "exportPath": "settings.sparkleCount"
    },
    {
      "key": "sparkleSize",
      "type": "number",
      "default": 8,
      "min": 1,
      "max": 30,
      "step": 0.1,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.sparkleSize"
    },
    {
      "key": "spawnIntervalFrames",
      "type": "number",
      "default": 6,
      "min": 1,
      "max": 40,
      "step": 0.1,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.spawnIntervalFrames"
    },
    {
      "key": "lifetimeFrames",
      "type": "number",
      "default": 18,
      "min": 1,
      "max": 3600,
      "step": 0.1,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.lifetimeFrames"
    },
    {
      "key": "haloRadius",
      "type": "number",
      "default": 40,
      "min": 0,
      "max": 160,
      "step": 0.1,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.haloRadius"
    },
    {
      "key": "twinkleHz",
      "type": "number",
      "default": 2,
      "min": 0,
      "max": 15,
      "step": 0.1,
      "unit": "Hz",
      "controlGroup": "Effect",
      "exportPath": "settings.twinkleHz"
    },
    {
      "key": "spreadRadius",
      "type": "number",
      "default": 55,
      "min": 5,
      "max": 230,
      "step": 0.1,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.spreadRadius"
    },
    {
      "key": "baseGapPx",
      "type": "number",
      "default": 18,
      "min": 3,
      "max": 90,
      "step": 0.1,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.baseGapPx"
    },
    {
      "key": "minGapPx",
      "type": "number",
      "default": 3,
      "min": 3,
      "max": 90,
      "step": 0.1,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.minGapPx"
    },
    {
      "key": "maxGapPx",
      "type": "number",
      "default": 90,
      "min": 3,
      "max": 90,
      "step": 0.1,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.maxGapPx"
    },
    {
      "key": "spatialJitter",
      "type": "number",
      "default": 0.2,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Effect",
      "exportPath": "settings.spatialJitter"
    },
    {
      "key": "timeJitter",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Effect",
      "exportPath": "settings.timeJitter"
    },
    {
      "key": "minIntervalFrames",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 40,
      "step": 0.1,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.minIntervalFrames"
    },
    {
      "key": "groupCount",
      "type": "integer",
      "default": 1,
      "min": 1,
      "max": 8,
      "step": 1,
      "unit": "count",
      "controlGroup": "Effect",
      "exportPath": "settings.groupCount"
    },
    {
      "key": "groupDelayFrames",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 40,
      "step": 0.1,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.groupDelayFrames"
    },
    {
      "key": "shineDelayFrames",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 40,
      "step": 0.1,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.shineDelayFrames"
    },
    {
      "key": "seed",
      "type": "integer",
      "default": 7321,
      "min": -2147483648,
      "max": 2147483647,
      "step": 1,
      "unit": "int32",
      "controlGroup": "Effect",
      "exportPath": "settings.seed"
    }
  ],
  "controlGroups": [
    "Effect"
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
      "id": "sizeCurve",
      "key": "sizeCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "alphaCurve",
      "key": "alphaCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "haloCurve",
      "key": "haloCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "rateCurve",
      "key": "rateCurve",
      "domain": "emitterTime",
      "contract": "curves"
    },
    {
      "id": "intervalCurve",
      "key": "intervalCurve",
      "domain": "emitterTime",
      "contract": "curves"
    },
    {
      "id": "spacingCurve",
      "key": "spacingCurve",
      "domain": "pathPosition",
      "contract": "curves"
    }
  ],
  "spacing": {
    "contract": "spacing",
    "temporal": "Real frame event schedule, independent rate/interval curve, grouped events and jitter. Sparkle count is active cap, not emission rate.",
    "spatial": "Closed cubic ring arc distance; base gap 18px, cyclic min gap and seeded jitter. Min gap <= max gap. Lifetime <= duration. Group overlap rejected."
  },
  "palettes": [
    {
      "id": "loot-rgba",
      "key": "palette",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#FFFFFF",
        "#FFE5A2",
        "#FFC94D"
      ]
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "Independent emitter and layer seeds; absolute-time seek"
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
    "strategy": "Bounded owned Pixi graphics; optional halo; isolated render target PNG; no unrelated runtime import."
  },
  "qualityBudgets": {
    "low": {
      "stars": 40,
      "primitives": 128,
      "maxEvents": 4096,
      "maxEmitters": 4
    },
    "balanced": {
      "stars": 160,
      "primitives": 512,
      "maxEvents": 4096,
      "maxEmitters": 4
    },
    "high": {
      "stars": 320,
      "primitives": 1024,
      "maxEvents": 4096,
      "maxEmitters": 4
    }
  },
  "tests": {
    "verified": true,
    "evidence": [
      "scripts/test_loot_core.cjs",
      "scripts/test_loot_runtime.cjs",
      "scripts/test_loot_editor.cjs",
      "scripts/test_loot_spine.cjs",
      "scripts/test_loot_export_ui.cjs",
      "scripts/test_loot_developer.cjs",
      "scripts/test_loot_evidence.cjs",
      "scripts/test_loot_catalog_evidence.cjs",
      "scripts/test_loot_parameter_matrix.cjs",
      "scripts/test_loot_developer_contract.cjs"
    ],
    "required": [
      "Actual 40/60-frame timing and independent seeded geometry",
      "All declared controls and curves change numerical state or pixels",
      "Real WebGL1/2/WebGPU and phase PNG evidence",
      "Matching JSON/SKEL and multi-page atlas, rollback",
      "Isolated PNG sequence, crop and alpha, cancel/retry, both built developer ZIPs"
    ]
  },
  "outOfScope": [
    "Spine versions outside 4.2",
    "Full affine bone shear/reflection",
    "Physical mobile performance certification",
    "Source sprite masked shine sweep"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "mode": "settings.mode",
      "quality": "settings.quality",
      "distribution": "settings.distribution",
      "frequencySource": "settings.frequencySource",
      "durationFrames": "settings.durationFrames",
      "sparkleCount": "settings.sparkleCount",
      "sparkleSize": "settings.sparkleSize",
      "spawnIntervalFrames": "settings.spawnIntervalFrames",
      "lifetimeFrames": "settings.lifetimeFrames",
      "haloRadius": "settings.haloRadius",
      "twinkleHz": "settings.twinkleHz",
      "spreadRadius": "settings.spreadRadius",
      "baseGapPx": "settings.baseGapPx",
      "minGapPx": "settings.minGapPx",
      "maxGapPx": "settings.maxGapPx",
      "spatialJitter": "settings.spatialJitter",
      "timeJitter": "settings.timeJitter",
      "minIntervalFrames": "settings.minIntervalFrames",
      "groupCount": "settings.groupCount",
      "groupDelayFrames": "settings.groupDelayFrames",
      "shineDelayFrames": "settings.shineDelayFrames",
      "seed": "settings.seed"
    },
    "preview": "python scripts/build_loot_editor.py --output <outside-repository>/Loot_Sparkle_Lab.html",
    "pngBake": "FxLootExport.bakeSequence; isolated FxLootBake scene; straight RGBA8 60Hz",
    "developerZip": "FxLootExportBrowser.developer; pinned Vite packages",
    "invariant": "Same core/runtime in preview, bake and developer example"
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject"
  },
  "implementation": {
    "status": "reference-implementation",
    "sourceFiles": [
      "assets/loot-sparkle/src/loot-core.js",
      "assets/loot-sparkle/src/loot-runtime.js",
      "assets/loot-sparkle/src/loot-editor.js",
      "assets/loot-sparkle/src/loot-spine.js",
      "assets/loot-sparkle/src/loot-export.js",
      "assets/loot-sparkle/src/loot-bake.js",
      "assets/loot-sparkle/src/loot-export-browser.js",
      "assets/loot-sparkle/src/ui.html",
      "scripts/build_loot_editor.py"
    ],
    "notes": "Build standalone HTML outside source tree. Independent reference, no baseline asset edits."
  }
}
```
