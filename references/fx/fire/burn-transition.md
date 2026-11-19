# Burn transition reference

**Status:** reference-implementation. **Blueprint schema v1 is a draft, not a shipped universal API.**

## Intent and adaptation

This describes the actual offline Burn Lab. The phase endpoint is grayscale rather than transparent erasure. Existing SVG handles, Spine attachment sampling, PNG alpha and two backend ZIPs are verified by listed tests. Do not treat its features as defaults for other categories.

## Machine-checkable Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.fire.burn-transition",
  "effectVersion": "0.1.0",
  "presetSchemaVersion": 1,
  "category": "fire",
  "styles": [
    "organic",
    "embers",
    "grayscale-dissolve"
  ],
  "visualGoal": "Animate an alpha-aware Spine burn transition with ember edge, optional procedural flame, glow and independent sparks; retain grayscale endpoint as authored.",
  "phases": [
    {
      "id": "original",
      "at": 0,
      "look": "unchanged source Spine imagery"
    },
    {
      "id": "active",
      "at": 0.5,
      "look": "burn boundary with flame and sparks and partial grayscale"
    },
    {
      "id": "burned",
      "at": 1,
      "look": "source converted to grayscale; no edge sparks"
    }
  ],
  "layers": [
    {
      "id": "burn-mask",
      "kind": "filter",
      "position": "Spine-host",
      "purpose": "burn and grayscale mask"
    },
    {
      "id": "flame-edge",
      "kind": "shader",
      "position": "Spine-host",
      "purpose": "emissive edge flame"
    },
    {
      "id": "spark-emitter",
      "kind": "particles",
      "position": "world-stage",
      "purpose": "alpha-aware sparks"
    },
    {
      "id": "optional-extra-emitters",
      "kind": "particles",
      "position": "behind-front-or-Spine-slot",
      "purpose": "independent additional layers"
    }
  ],
  "emitterAnchors": [
    {
      "id": "skeleton-surface",
      "space": "skeleton",
      "onMissing": "hide-and-diagnose"
    },
    {
      "id": "spark-birth",
      "space": "model-surface",
      "onMissing": "hide-and-diagnose"
    }
  ],
  "parameters": [
    {
      "key": "duration",
      "type": "number",
      "default": 3,
      "unit": "seconds",
      "controlGroup": "Timing",
      "exportPath": "settings.duration",
      "min": 0.016666666666666666,
      "max": 60,
      "step": 0.016666666666666666
    },
    {
      "key": "flameHeight",
      "type": "number",
      "default": 38,
      "unit": "logical-pixels",
      "controlGroup": "Flame & glow",
      "exportPath": "settings.flameHeight",
      "min": 0,
      "max": 100,
      "step": 1
    },
    {
      "key": "glow",
      "type": "number",
      "default": 0.8,
      "unit": "strength-multiplier",
      "controlGroup": "Flame & glow",
      "exportPath": "settings.glow",
      "min": 0,
      "max": 2,
      "step": 0.05
    },
    {
      "key": "fireColor",
      "type": "color",
      "default": "#ff6b19",
      "unit": "rgb-hex",
      "controlGroup": "Flame & glow",
      "exportPath": "settings.fireColor"
    },
    {
      "key": "hotColor",
      "type": "color",
      "default": "#ffe7a0",
      "unit": "rgb-hex",
      "controlGroup": "Flame & glow",
      "exportPath": "settings.hotColor"
    },
    {
      "key": "sparks",
      "type": "integer",
      "default": 65,
      "unit": "particles-per-second",
      "controlGroup": "Sparks",
      "exportPath": "settings.sparks",
      "min": 0,
      "max": 400,
      "step": 1
    },
    {
      "key": "sparkSize",
      "type": "number",
      "default": 1.8,
      "unit": "logical-pixels",
      "controlGroup": "Sparks",
      "exportPath": "settings.sparkSize",
      "min": 0.5,
      "max": 6,
      "step": 0.1
    },
    {
      "key": "sparkLife",
      "type": "number",
      "default": 1.1,
      "unit": "seconds",
      "controlGroup": "Sparks",
      "exportPath": "settings.sparkLife",
      "min": 0.1,
      "max": 4,
      "step": 0.1
    },
    {
      "key": "seed",
      "type": "integer",
      "default": 8,
      "unit": "int32",
      "controlGroup": "Advanced",
      "exportPath": "settings.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    }
  ],
  "controlGroups": [
    "Timing",
    "Flame & glow",
    "Sparks",
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
      "id": "transition-progress",
      "key": "timeCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "spark-lifetime",
      "key": "sparkLifetime",
      "domain": "particleAge",
      "contract": "colors"
    }
  ],
  "spacing": {
    "enabledByDefault": false,
    "contract": "spacing",
    "modes": [
      "time-interval",
      "time-rate",
      "distance-arc-length"
    ],
    "note": "disabled by default; physical spacing independent from spark speed"
  },
  "palettes": [
    {
      "id": "flame-gradient",
      "key": "fireGradient",
      "domain": "flameIntensity",
      "contract": "colors"
    },
    {
      "id": "spark-gradient",
      "key": "sparkLifetime.colorOverLife",
      "domain": "particleAge",
      "contract": "colors"
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "separate per emitter and fixed-step replay"
  },
  "rendering": {
    "approach": "composition",
    "strategy": "Spine-bound alpha mask + GLSL/WGSL flame filter + Pixi Graphics sparks",
    "backends": [
      "webgl1",
      "webgl2",
      "webgpu"
    ],
    "runtimePins": {
      "pixi": "8.22.0",
      "spine": "4.2.120"
    },
    "fallback": "WebGL1 Low with reviewed effect-specific degradation; never silent no-op",
    "shaderStatus": "tested in reference"
  },
  "qualityBudgets": {
    "low": {
      "maxSparks": 96,
      "shaderSteps": 3,
      "haloTaps": 0
    },
    "balanced": {
      "maxSparks": 300,
      "shaderSteps": 6,
      "haloTaps": 4
    },
    "high": {
      "maxSparks": 700,
      "shaderSteps": 9,
      "haloTaps": 8
    }
  },
  "tests": {
    "verified": true,
    "evidence": [
      "scripts/test_timeline_editor.cjs",
      "scripts/test_color_editor.cjs",
      "scripts/test_emitter_editor.cjs"
    ],
    "required": [
      "WebGL1/2/WebGPU real image and alpha",
      "40-frame PNG parity",
      "6/3600-frame boundary validation",
      "independent camera/guide",
      "both developer Vite builds"
    ]
  },
  "outOfScope": [
    "MP4 export",
    "Spine 4.3 runtime adoption",
    "universal graph editor"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "duration": "settings.duration",
      "flameHeight": "settings.flameHeight",
      "glow": "settings.glow",
      "fireColor": "settings.fireColor",
      "hotColor": "settings.hotColor",
      "sparks": "settings.sparks",
      "sparkSize": "settings.sparkSize",
      "sparkLife": "settings.sparkLife",
      "seed": "settings.seed"
    },
    "preview": "SpineBurnFx.createBurnTransition",
    "pngBake": "bakeFx.seek() with isolated Spine",
    "developerZip": "BurnTransition.mjs / FxTimeline.mjs / FxEmitters.mjs",
    "invariant": "same effect implementation for preview, offscreen PNG and both developer ZIPs"
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject",
    "policy": "No implicit migration; future schemas require separately tested explicit from/to transforms"
  },
  "implementation": {
    "status": "reference-implementation",
    "sourceFiles": [
      "assets/template/src/effect-core.js",
      "assets/template/src/ui.html",
      "assets/template/src/emitter-runtime.js",
      "assets/template/src/export-ui.js"
    ],
    "notes": "Verified Burn Lab reference, NOT a generic FX graph"
  }
}
```

## Scope gate

Review the visual endpoint, source pins and GPU support against actual source and docs before implementation. Changes require a separately approved plan and RED->GREEN tests. No new renderer is delivered by this Blueprint alone.
