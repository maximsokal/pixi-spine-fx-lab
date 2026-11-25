# Poison Cloud

GAME-10 / #49 — **implementation candidate; GPU acceptance pending**. P01–P04 source exists in `assets/poison-cloud/src/`. The catalog retains specification-only until actual browser and package acceptance; do not reimplement.

Build and validate outside the checkout:

    python scripts/build_poison_editor.py --output ../PoisonCloud.html
    node --test scripts/test_poison_*.cjs
    python scripts/test_poison_builder.py
    python scripts/test_blueprints.py
    python scripts/test_poison_browser.py ../PoisonCloud.html --backend webgl2 --output ../poison-evidence-webgl2

Repeat for webgl1/webgpu with empty evidence directories. The dedicated runner is an acceptance diagnostic, not the v1 evidence-schema report; full evidence and visual inspection remain required. CPU numerical and real pinned Pixi/Spine objects, editor fixtures, export byte contracts and builder fixtures were tested in earlier slices. Actual GPU pixels, PMA fringe, aggregate fog opacity, real sample/physics rigs, package Vite builds and architecture gates remain unverified. Default loop 75 frames; named one-shot 40 frames has distinct lifecycle curves and transparent included endpoints. 20/s emits 25 base events per loop; default arc has 23 candidate positions; burst off by default. Fog opacity is per cell, not a total composite alpha guarantee. No full affine reflection/shear promise. Crop is signed center-relative; world tiles are 512 px. No per-seek GPU mesh/buffer allocation (temporary JS arrays remain).

## Machine-checkable Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.game.poison-cloud",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "game",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "Low-lying green-violet irregular fog, independent spores or bubbles, optional violet edge glow, 512 logical px at 60 FPS.",
  "phases": [
    {
      "id": "concentrate",
      "at": 0,
      "look": "One-shot transparent; loop pre-rolled."
    },
    {
      "id": "diffuse",
      "at": 0.5,
      "look": "Expanding low cloud, drifting spores or bubbles."
    },
    {
      "id": "thin",
      "at": 1,
      "look": "One-shot transparent; exact loop seam."
    }
  ],
  "layers": [
    {
      "id": "fog",
      "kind": "geometry",
      "position": "Behind by default",
      "purpose": "Seeded irregular translucent fog cells"
    },
    {
      "id": "spores",
      "kind": "particles",
      "position": "Front by default",
      "purpose": "Independent spores or hollow bubbles"
    },
    {
      "id": "edge",
      "kind": "geometry",
      "position": "Front by default",
      "purpose": "Optional violet annular edge"
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
      "key": "durationFrames",
      "type": "integer",
      "default": 75,
      "min": 2,
      "max": 3600,
      "step": 1,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.durationFrames"
    },
    {
      "key": "cloudRadius",
      "type": "number",
      "default": 80,
      "min": 10,
      "max": 300,
      "step": 0.5,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.cloudRadius"
    },
    {
      "key": "particleRate",
      "type": "number",
      "default": 20,
      "min": 0,
      "max": 120,
      "step": 0.1,
      "unit": "1/s",
      "controlGroup": "Effect",
      "exportPath": "settings.particleRate"
    },
    {
      "key": "roughness",
      "type": "number",
      "default": 0.5,
      "min": 0,
      "max": 1,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Effect",
      "exportPath": "settings.roughness"
    },
    {
      "key": "diffusionSpeed",
      "type": "number",
      "default": 40,
      "min": 0,
      "max": 250,
      "step": 1,
      "unit": "px/s",
      "controlGroup": "Effect",
      "exportPath": "settings.diffusionSpeed"
    },
    {
      "key": "sporeSize",
      "type": "number",
      "default": 5,
      "min": 1,
      "max": 20,
      "step": 0.1,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.sporeSize"
    },
    {
      "key": "fogOpacity",
      "type": "number",
      "default": 0.5,
      "min": 0,
      "max": 0.9,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Effect",
      "exportPath": "settings.fogOpacity"
    },
    {
      "key": "noiseCellPx",
      "type": "number",
      "default": 50,
      "min": 25,
      "max": 110,
      "step": 0.5,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.noiseCellPx"
    },
    {
      "key": "lifetimeFrames",
      "type": "integer",
      "default": 36,
      "min": 1,
      "max": 3600,
      "step": 1,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.lifetimeFrames"
    },
    {
      "key": "intervalFrames",
      "type": "number",
      "default": 3,
      "min": 0.25,
      "max": 3600,
      "step": 0.01,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.intervalFrames"
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
      "key": "minIntervalFrames",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 3600,
      "step": 0.01,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.minIntervalFrames"
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
      "key": "burstEnabled",
      "type": "boolean",
      "default": false,
      "unit": "toggle",
      "controlGroup": "Effect",
      "exportPath": "settings.burstEnabled"
    },
    {
      "key": "burstCount",
      "type": "integer",
      "default": 12,
      "min": 1,
      "max": 64,
      "step": 1,
      "unit": "count",
      "controlGroup": "Effect",
      "exportPath": "settings.burstCount"
    },
    {
      "key": "burstDelayFrames",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 3600,
      "step": 0.01,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.burstDelayFrames"
    },
    {
      "key": "spacingPx",
      "type": "number",
      "default": 18,
      "min": 2,
      "max": 95,
      "step": 0.25,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.spacingPx"
    },
    {
      "key": "minGapPx",
      "type": "number",
      "default": 2,
      "min": 2,
      "max": 95,
      "step": 0.25,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.minGapPx"
    },
    {
      "key": "maxGapPx",
      "type": "number",
      "default": 95,
      "min": 2,
      "max": 95,
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
      "key": "seed",
      "type": "integer",
      "default": 4110,
      "min": -2147483648,
      "max": 2147483647,
      "step": 1,
      "unit": "int32",
      "controlGroup": "Effect",
      "exportPath": "settings.seed"
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
      "key": "style",
      "type": "enum",
      "default": "natural",
      "choices": [
        "natural",
        "stylized",
        "magical"
      ],
      "unit": "mode",
      "controlGroup": "Effect",
      "exportPath": "settings.style"
    },
    {
      "key": "particleMode",
      "type": "enum",
      "default": "spore",
      "choices": [
        "spore",
        "bubble"
      ],
      "unit": "mode",
      "controlGroup": "Effect",
      "exportPath": "settings.particleMode"
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
      "id": "cloudSizeCurve",
      "key": "cloudSizeCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "fogOpacityCurve",
      "key": "fogOpacityCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "sporeSizeCurve",
      "key": "sporeSizeCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "sporeAlphaCurve",
      "key": "sporeAlphaCurve",
      "domain": "particleAge",
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
    "temporal": "Independent rate/interval curves; optional 12-particle initial burst, delay, seeded jitter and minimum base-event gap.",
    "spatial": "Closed cubic ellipse, 18px reference spacing curve with independent baseline and seeded jitter; true arc-length candidates, independent fog cell size. Gap applies to candidates, not moving particles."
  },
  "palettes": [
    {
      "id": "poison-rgba",
      "key": "palette",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#C7ED83",
        "#7AB54D",
        "#65508A"
      ]
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "Independent emitter/layer seeds, base and burst anchor permutations, fog shape and spore drift."
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
    "strategy": "Candidate pooled native Pixi MeshSimple with shared PMA ramp, seeded contours and annuli; CPU objects tested, GPU pending."
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
      "Actual WebGL1/2/WebGPU visual and transparent PNG/crop parity on light/dark/checker",
      "Actual Spine asset/physics and editor interaction",
      "Standalone vendor build and Vite package build, offline network assertion"
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
      "mode": "settings.mode",
      "durationFrames": "settings.durationFrames",
      "cloudRadius": "settings.cloudRadius",
      "particleRate": "settings.particleRate",
      "roughness": "settings.roughness",
      "diffusionSpeed": "settings.diffusionSpeed",
      "sporeSize": "settings.sporeSize",
      "fogOpacity": "settings.fogOpacity",
      "noiseCellPx": "settings.noiseCellPx",
      "lifetimeFrames": "settings.lifetimeFrames",
      "intervalFrames": "settings.intervalFrames",
      "frequencySource": "settings.frequencySource",
      "minIntervalFrames": "settings.minIntervalFrames",
      "timeJitter": "settings.timeJitter",
      "burstEnabled": "settings.burstEnabled",
      "burstCount": "settings.burstCount",
      "burstDelayFrames": "settings.burstDelayFrames",
      "spacingPx": "settings.spacingPx",
      "minGapPx": "settings.minGapPx",
      "maxGapPx": "settings.maxGapPx",
      "spatialJitter": "settings.spatialJitter",
      "distribution": "settings.distribution",
      "seed": "settings.seed",
      "quality": "settings.quality",
      "style": "settings.style",
      "particleMode": "settings.particleMode"
    },
    "preview": "not-implemented",
    "pngBake": "not-implemented",
    "developerZip": "not-implemented",
    "invariant": "Catalog reference status withheld until real browser and developer build acceptance. Candidate source documented above."
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject"
  },
  "implementation": {
    "status": "specification-only",
    "sourceFiles": [],
    "notes": "Candidate implemented in assets/poison-cloud/src; v1 registry lacks intermediate lifecycle. Do not reimplement. Promote only after browser and package acceptance."
  }
}
```
