# Frost dissolve concept

**Status:** specification-only. **Blueprint schema v1 is a draft, not a shipped universal API.**

## Intent and adaptation

The endpoint (frost overlay versus RGBA dissolve) is deliberately unresolved; grill-me before coding. This is only an adaptation brief and does not ship an ice filter, shader or exported ZIP. No existing Burn UI parameter may be inherited without evidence.

## Machine-checkable Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.ice.frost-dissolve",
  "effectVersion": "0.1.0",
  "presetSchemaVersion": 1,
  "category": "ice",
  "styles": [
    "icy",
    "crystalline",
    "frost"
  ],
  "visualGoal": "Gradually cover then dissolve a Spine asset with editable radial frost growth; preserve transparent pixels and avoid grayscale-burning defaults.",
  "phases": [
    {
      "id": "unfrozen",
      "at": 0,
      "look": "unaltered Spine RGBA"
    },
    {
      "id": "frost-growth",
      "at": 0.5,
      "look": "radial frost coverage with soft crystal edges"
    },
    {
      "id": "frozen",
      "at": 1,
      "look": "crystal-frost endpoint specified before implementation: overlay or alpha removal must be approved"
    }
  ],
  "layers": [
    {
      "id": "frost-field",
      "kind": "filter",
      "position": "Spine-host",
      "purpose": "radial frost field"
    },
    {
      "id": "crystal-edge",
      "kind": "shader",
      "position": "Spine-host",
      "purpose": "frost faceting"
    },
    {
      "id": "soft-ice-halo",
      "kind": "filter",
      "position": "behind",
      "purpose": "cool scattering; optional"
    }
  ],
  "emitterAnchors": [
    {
      "id": "frost-center",
      "space": "model-local",
      "onMissing": "fallback-to-authored-local-coordinate"
    }
  ],
  "parameters": [
    {
      "key": "frostRadius",
      "type": "number",
      "default": 80,
      "unit": "logical-pixels",
      "controlGroup": "Geometry",
      "exportPath": "settings.frostRadius",
      "min": 0,
      "max": 500,
      "step": 1
    },
    {
      "key": "crystalScale",
      "type": "number",
      "default": 12,
      "unit": "logical-pixels",
      "controlGroup": "Crystal",
      "exportPath": "settings.crystalScale",
      "min": 1,
      "max": 100,
      "step": 0.5
    },
    {
      "key": "edgeSoftness",
      "type": "number",
      "default": 0.18,
      "unit": "normalized-0-1",
      "controlGroup": "Crystal",
      "exportPath": "settings.edgeSoftness",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "frostTint",
      "type": "color",
      "default": "#85d8ff",
      "unit": "rgb-hex",
      "controlGroup": "Color",
      "exportPath": "settings.frostTint"
    },
    {
      "key": "duration",
      "type": "number",
      "default": 1.5,
      "unit": "seconds",
      "controlGroup": "Timing",
      "exportPath": "settings.duration",
      "min": 0.1,
      "max": 60,
      "step": 0.05
    },
    {
      "key": "seed",
      "type": "integer",
      "default": 11,
      "unit": "int32",
      "controlGroup": "Advanced",
      "exportPath": "settings.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    }
  ],
  "controlGroups": [
    "Geometry",
    "Crystal",
    "Color",
    "Timing",
    "Advanced"
  ],
  "requiredContracts": [
    "parameters",
    "curves",
    "colors",
    "timeline"
  ],
  "curves": [
    {
      "id": "frost-progress",
      "key": "frostCurve",
      "domain": "effectTime",
      "contract": "curves"
    }
  ],
  "spacing": {
    "enabledByDefault": false,
    "contract": null,
    "modes": [],
    "note": "no particle emission is implied; add spacing only if a future design introduces particles"
  },
  "palettes": [
    {
      "id": "cool-frost",
      "key": "frostTint",
      "domain": "effectTime",
      "contract": "colors"
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "seeded crystal positions; no global Math.random"
  },
  "rendering": {
    "approach": "composition",
    "strategy": "Proposed GLSL/WGSL frost displacement + optional translucent halo; no tested implementation",
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
      "shaderSteps": 2,
      "particles": 0
    },
    "balanced": {
      "shaderSteps": 4,
      "particles": 0
    },
    "high": {
      "shaderSteps": 8,
      "particles": 0
    }
  },
  "tests": {
    "verified": false,
    "evidence": [],
    "required": [
      "Resolve final alpha/overlay endpoint before code",
      "WebGL1/2/WebGPU parity",
      "RGB/alpha overlays",
      "true RGBA PNG and exports",
      "camera/anchor 50/100/200%"
    ]
  },
  "outOfScope": [
    "Carry over burn/grayscale controls",
    "pretend the shader is implemented",
    "MP4 export"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "frostRadius": "settings.frostRadius",
      "crystalScale": "settings.crystalScale",
      "edgeSoftness": "settings.edgeSoftness",
      "frostTint": "settings.frostTint",
      "duration": "settings.duration",
      "seed": "settings.seed"
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
