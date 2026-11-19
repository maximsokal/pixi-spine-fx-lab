# Damage hit flash concept

**Status:** specification-only. **Blueprint schema v1 is a draft, not a shipped universal API.**

## Intent and adaptation

This is a game-hit visual feedback brief, not a general game category router. No shader or standalone editor has been created; implement a minimal independent short-duration tint and avoid importing burn or grayscale controls.

## Machine-checkable Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.game.hit-flash",
  "effectVersion": "0.1.0",
  "presetSchemaVersion": 1,
  "category": "game",
  "styles": [
    "arcade",
    "combat-feedback",
    "fast"
  ],
  "visualGoal": "Flash the affected Spine character for a very short damage reaction without altering skeleton coordinates, texture ownership or transparency.",
  "phases": [
    {
      "id": "idle",
      "at": 0,
      "look": "unchanged original sprite"
    },
    {
      "id": "impact",
      "at": 0.2,
      "look": "brief bright hit tint"
    },
    {
      "id": "recovery",
      "at": 1,
      "look": "exact original sprite and alpha restored"
    }
  ],
  "layers": [
    {
      "id": "hit-overlay",
      "kind": "filter",
      "position": "Spine-host",
      "purpose": "short tint flash"
    }
  ],
  "emitterAnchors": [
    {
      "id": "target-skeleton",
      "space": "skeleton",
      "onMissing": "hide-and-diagnose"
    }
  ],
  "parameters": [
    {
      "key": "flashColor",
      "type": "color",
      "default": "#fff6df",
      "unit": "rgb-hex",
      "controlGroup": "Color",
      "exportPath": "settings.flashColor"
    },
    {
      "key": "flashIntensity",
      "type": "number",
      "default": 1,
      "unit": "normalized-0-1",
      "controlGroup": "Color",
      "exportPath": "settings.flashIntensity",
      "min": 0,
      "max": 1,
      "step": 0.02
    },
    {
      "key": "flashDuration",
      "type": "number",
      "default": 0.16,
      "unit": "seconds",
      "controlGroup": "Timing",
      "exportPath": "settings.flashDuration",
      "min": 0.03,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "pulseCount",
      "type": "integer",
      "default": 1,
      "unit": "count",
      "controlGroup": "Timing",
      "exportPath": "settings.pulseCount",
      "min": 1,
      "max": 6,
      "step": 1
    },
    {
      "key": "flashBlend",
      "type": "enum",
      "default": "normal",
      "unit": "blend-mode",
      "controlGroup": "Color",
      "exportPath": "settings.flashBlend",
      "choices": [
        "normal",
        "add"
      ]
    }
  ],
  "controlGroups": [
    "Color",
    "Timing"
  ],
  "requiredContracts": [
    "parameters",
    "curves",
    "timeline"
  ],
  "curves": [
    {
      "id": "hit-intensity",
      "key": "intensityCurve",
      "domain": "effectTime",
      "contract": "curves"
    }
  ],
  "spacing": {
    "enabledByDefault": false,
    "contract": null,
    "modes": [],
    "note": "one static flash layer; temporal or spatial particle spacing not needed"
  },
  "palettes": [],
  "rng": {
    "policy": "none",
    "seedParameter": null,
    "streamPolicy": "deterministic intensity curve, no stochastic particle work"
  },
  "rendering": {
    "approach": "filter",
    "strategy": "Proposed bounded Pixi tint/color matrix or pinned GLSL+WGSL branch, choose only after backend review",
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
    "shaderStatus": "design proposal; not tested"
  },
  "qualityBudgets": {
    "low": {
      "shaderSteps": 1,
      "particles": 0
    },
    "balanced": {
      "shaderSteps": 1,
      "particles": 0
    },
    "high": {
      "shaderSteps": 1,
      "particles": 0
    }
  },
  "tests": {
    "verified": false,
    "evidence": [],
    "required": [
      "Verify source alpha unchanged",
      "preview=bake=developer effects",
      "reverse/seek 30/60/120 FPS",
      "WebGL1/2/WebGPU",
      "no accidental grayscale"
    ]
  },
  "outOfScope": [
    "Borrow burn sparks by default",
    "burn/grayscale parameters",
    "pretend filter API compatibility is established"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "flashColor": "settings.flashColor",
      "flashIntensity": "settings.flashIntensity",
      "flashDuration": "settings.flashDuration",
      "pulseCount": "settings.pulseCount",
      "flashBlend": "settings.flashBlend"
    },
    "preview": "not-implemented",
    "pngBake": "not-implemented",
    "developerZip": "not-implemented",
    "invariant": "same effect implementation for preview, offscreen PNG and both developer ZIPs"
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject",
    "policy": "No implicit migration; future schemas require separately tested explicit from/to transforms"
  },
  "implementation": {
    "status": "specification-only",
    "sourceFiles": [],
    "notes": "Spec brief only. No renderer, preview, PNG or developer ZIP for this effect exists yet."
  }
}
```

## Scope gate

Review the visual endpoint, source pins and GPU support against actual source and docs before implementation. Changes require a separately approved plan and RED->GREEN tests. No new renderer is delivered by this Blueprint alone.
