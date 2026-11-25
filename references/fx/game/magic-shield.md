# Magic Shield

GAME-08 / #47 — **implementation candidate, acceptance pending**. Candidate source is in `assets/magic-shield/src/`; do not reimplement it from the specification. The machine-readable v1 status remains `specification-only` until real browser/GPU and developer build acceptance, following the existing Snowfall convention.

Build the standalone candidate outside the checkout:

    python scripts/build_shield_editor.py --output ../MagicShield.html

Run local verification:

    node --test scripts/test_shield_*.cjs
    python scripts/test_shield_acceptance_checks.py
    python scripts/test_shield_browser.py ../MagicShield.html --backend webgl2 --output ../shield-evidence-webgl2

Repeat the browser command for `webgl1` and `webgpu` with separate empty output directories. Python Playwright and Pillow are test dependencies. A GPU or software renderer must actually initialize. The browser suite checks phases, layers, crop, offline downloads and package contents; Vite builds, real physics rigs, and manual visual inspection remain separate acceptance gates. Forward physics uses authored 60 FPS frame poses; backwards seeks replay from zero. Positive pulse rates quantize to whole cycles in loop mode. The hit clock is independent; hit lifetime must fit the authored duration. Custom spark spacing is optional. Quality limits reserve primitives, not a performance guarantee.

## Machine-checkable Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.game.magic-shield",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "game",
  "styles": [
    "magical",
    "stylized"
  ],
  "visualGoal": "Translucent protective shell and halo around a Spine character, with independently anchored impact ripple and sparks. Default 60-frame loop; optional one-shot, 60 FPS, 512 logical px.",
  "phases": [
    {
      "id": "appear",
      "at": 0,
      "look": "One-shot blank; loop begins at its periodic low pulse."
    },
    {
      "id": "stable",
      "at": 0.5,
      "look": "Visible translucent shell, halo and optional independent impact accents."
    },
    {
      "id": "fade",
      "at": 1,
      "look": "One-shot blank; loop matches its first phase."
    }
  ],
  "layers": [
    {
      "id": "shell",
      "kind": "geometry",
      "position": "Independent world/local/bone or inherited emitter anchor",
      "purpose": "Translucent radial shell with alpha-safe center"
    },
    {
      "id": "halo",
      "kind": "geometry",
      "position": "Independent anchor, behind by default",
      "purpose": "Soft radial halo"
    },
    {
      "id": "impact",
      "kind": "geometry",
      "position": "Independent anchor, front by default",
      "purpose": "Manual or scheduled ripple and optional ring sparks"
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
      "key": "durationFrames",
      "type": "integer",
      "default": 60,
      "min": 2,
      "max": 3600,
      "step": 1,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.durationFrames"
    },
    {
      "key": "pulseRate",
      "type": "number",
      "default": 1.5,
      "min": 0,
      "max": 10,
      "step": 0.1,
      "unit": "Hz",
      "controlGroup": "Effect",
      "exportPath": "settings.pulseRate"
    },
    {
      "key": "radius",
      "type": "number",
      "default": 110,
      "min": 12,
      "max": 350,
      "step": 0.5,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.radius"
    },
    {
      "key": "rimThickness",
      "type": "number",
      "default": 5,
      "min": 0.5,
      "max": 35,
      "step": 0.5,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.rimThickness"
    },
    {
      "key": "baseAlpha",
      "type": "number",
      "default": 0.28,
      "min": 0,
      "max": 0.85,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Effect",
      "exportPath": "settings.baseAlpha"
    },
    {
      "key": "glow",
      "type": "number",
      "default": 0.55,
      "min": 0,
      "max": 2,
      "step": 0.01,
      "unit": "multiplier",
      "controlGroup": "Effect",
      "exportPath": "settings.glow"
    },
    {
      "key": "hitRadius",
      "type": "number",
      "default": 90,
      "min": 0,
      "max": 250,
      "step": 0.5,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.hitRadius"
    },
    {
      "key": "hitLifeFrames",
      "type": "integer",
      "default": 24,
      "min": 1,
      "max": 3600,
      "step": 1,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.hitLifeFrames"
    },
    {
      "key": "sparkTravel",
      "type": "number",
      "default": 18,
      "min": 0,
      "max": 250,
      "step": 0.5,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.sparkTravel"
    },
    {
      "key": "seed",
      "type": "integer",
      "default": 4108,
      "min": -2147483648,
      "max": 2147483647,
      "step": 1,
      "unit": "int32",
      "controlGroup": "Effect",
      "exportPath": "settings.seed"
    },
    {
      "key": "hitRate",
      "type": "number",
      "default": 2,
      "min": 0,
      "max": 60,
      "step": 0.1,
      "unit": "1/s",
      "controlGroup": "Effect",
      "exportPath": "settings.hitRate"
    },
    {
      "key": "hitIntervalFrames",
      "type": "number",
      "default": 30,
      "min": 0.25,
      "max": 3600,
      "step": 0.25,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.hitIntervalFrames"
    },
    {
      "key": "minHitGapFrames",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 3600,
      "step": 0.25,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.minHitGapFrames"
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
      "key": "spacingPx",
      "type": "number",
      "default": 14,
      "min": 0.25,
      "max": 140,
      "step": 0.25,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.spacingPx"
    },
    {
      "key": "minGapPx",
      "type": "number",
      "default": 2,
      "min": 0.25,
      "max": 140,
      "step": 0.25,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.minGapPx"
    },
    {
      "key": "maxGapPx",
      "type": "number",
      "default": 140,
      "min": 0.25,
      "max": 140,
      "step": 0.25,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.maxGapPx"
    },
    {
      "key": "spatialJitter",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Effect",
      "exportPath": "settings.spatialJitter"
    },
    {
      "key": "mode",
      "type": "enum",
      "default": "loop",
      "choices": [
        "loop",
        "oneShot"
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
      "key": "frequencySource",
      "type": "enum",
      "default": "rate",
      "choices": [
        "rate",
        "interval"
      ],
      "unit": "mode",
      "controlGroup": "Effect",
      "exportPath": "settings.frequencySource"
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
      "id": "glowCurve",
      "key": "glowCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "hitRadiusCurve",
      "key": "hitRadiusCurve",
      "domain": "emitterTime",
      "contract": "curves"
    },
    {
      "id": "hitAlphaCurve",
      "key": "hitAlphaCurve",
      "domain": "emitterTime",
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
    "temporal": "Independent manual or rate/interval hit events, seeded jitter and minimum trigger gap. Pulse frequency is independent.",
    "spatial": "Closed cubic circular approximation with seeded arc-length placement, minimum and maximum gaps, optional custom curve."
  },
  "palettes": [
    {
      "id": "shield-rgba",
      "key": "palette",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#DAF7FF",
        "#4C9FE1"
      ]
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "Independent emitter/layer seeds and event-specific streams; absolute time."
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
    "strategy": "Candidate native Pixi radial meshes; isolated tiled export and shared authoring/core. Real browser and fallback acceptance pending."
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
      "primitives": 2048,
      "maxEmitters": 4
    }
  },
  "tests": {
    "verified": false,
    "evidence": [],
    "required": [
      "Actual WebGL1/2/WebGPU transparent PNG and crop parity",
      "One-shot phases, exact loop seam, independent layers and numerical parameter/curve witnesses",
      "Spine anchors and actual physics replay, editor placement, developer builds and fallback"
    ]
  },
  "outOfScope": [
    "Exact affine shear and reflection of local offsets",
    "Other Spine versions",
    "Physical-device performance certification"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "durationFrames": "settings.durationFrames",
      "pulseRate": "settings.pulseRate",
      "radius": "settings.radius",
      "rimThickness": "settings.rimThickness",
      "baseAlpha": "settings.baseAlpha",
      "glow": "settings.glow",
      "hitRadius": "settings.hitRadius",
      "hitLifeFrames": "settings.hitLifeFrames",
      "sparkTravel": "settings.sparkTravel",
      "seed": "settings.seed",
      "hitRate": "settings.hitRate",
      "hitIntervalFrames": "settings.hitIntervalFrames",
      "minHitGapFrames": "settings.minHitGapFrames",
      "timeJitter": "settings.timeJitter",
      "spacingPx": "settings.spacingPx",
      "minGapPx": "settings.minGapPx",
      "maxGapPx": "settings.maxGapPx",
      "spatialJitter": "settings.spatialJitter",
      "mode": "settings.mode",
      "quality": "settings.quality",
      "frequencySource": "settings.frequencySource",
      "distribution": "settings.distribution"
    },
    "preview": "not-implemented",
    "pngBake": "not-implemented",
    "developerZip": "not-implemented",
    "invariant": "Catalog reference status withheld until actual acceptance; candidate source is documented above."
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject"
  },
  "implementation": {
    "status": "specification-only",
    "sourceFiles": [],
    "notes": "Candidate code exists; the v1 catalog has no partial implementation state. Do not treat it as a verified reference until browser, GPU and developer build acceptance passes."
  }
}
```
