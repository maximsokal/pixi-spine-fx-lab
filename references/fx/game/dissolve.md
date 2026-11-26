# Dissolve / Disintegration

GAME-11 / #50 — **implementation candidate; actual GPU acceptance pending**. D01–D04 are implemented in `assets/dissolve/src/`. The v1 registry retains specification-only until real acceptance; do not reimplement.

Build and test outside the checkout:

    python scripts/build_dissolve_editor.py --output ../Dissolve.html
    node --test scripts/test_dissolve_*.cjs
    python scripts/test_dissolve_builder.py
    python scripts/test_blueprints.py
    python scripts/test_dissolve_browser.py ../Dissolve.html --backend webgl2 --output ../dissolve-evidence-webgl2

Repeat with webgl1/webgpu and separate empty directories. Browser runner is diagnostic, not schema-v1 proof or automatic promotion. Source: explicit demo, Spine, or none. Default 40 included frames at 60Hz (0..39); full mask removes all alpha at the last frame, grayscale preserves source alpha. Partial mask and disabled mask intentionally retain coverage. Debris begins only at valid birth-time alpha cells (threshold 16/255), no fake points across holes. Edge cannot add coverage outside the source. Mask and edge are source-bound; only debris supports behind placement. Capture rect is not export crop. 16-bit field, max 1,050,625 nodes, 32M contour cell evaluations, 64 MiB alpha cache. Discrete raster accuracy is not exact subpixel clipping. No measured GPU speed or full affine support. Actual browser/GPU, real physics/clipped source and Vite/architecture acceptance remain pending. Source and export byte tests with fixtures are not GPU tests.

## Machine-checkable Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.game.dissolve",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "game",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "Alpha-aware directional disintegration of a selected source, a source-bound colored edge and independently emitted debris from the actual clipped frontier.",
  "phases": [
    {
      "id": "source",
      "at": 0,
      "look": "Unmodified source with its original alpha and no extra FX."
    },
    {
      "id": "frontier",
      "at": 0.5,
      "look": "Directional partial dissolve with source-bound edge and alpha-clipped debris origins."
    },
    {
      "id": "endpoint",
      "at": 1,
      "look": "Default fully transparent; explicit grayscale alternative preserves original source alpha; partial mask intentionally retains coverage."
    }
  ],
  "layers": [
    {
      "id": "mask",
      "kind": "filter",
      "position": "Source-bound",
      "purpose": "Quantized directional coverage removal or grayscale"
    },
    {
      "id": "edge",
      "kind": "shader",
      "position": "Source-bound",
      "purpose": "Palette edge on source coverage only"
    },
    {
      "id": "debris",
      "kind": "particles",
      "position": "Front or behind",
      "purpose": "Independent frontier-born particles"
    }
  ],
  "emitterAnchors": [
    {
      "id": "world",
      "space": "world",
      "onMissing": "Hide dependent layer and diagnose"
    },
    {
      "id": "local",
      "space": "local",
      "onMissing": "Hide dependent layer and diagnose"
    },
    {
      "id": "bone",
      "space": "bone",
      "onMissing": "Hide dependent layer and diagnose"
    },
    {
      "id": "inherit",
      "space": "inherit",
      "onMissing": "Hide dependent layer and diagnose"
    }
  ],
  "parameters": [
    {
      "key": "mode",
      "type": "enum",
      "default": "oneShot",
      "unit": "mode",
      "controlGroup": "Effect",
      "exportPath": "settings.mode",
      "choices": [
        "oneShot"
      ]
    },
    {
      "key": "durationFrames",
      "type": "integer",
      "default": 40,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.durationFrames",
      "min": 2,
      "max": 3600,
      "step": 1
    },
    {
      "key": "endpoint",
      "type": "enum",
      "default": "disappear",
      "unit": "mode",
      "controlGroup": "Effect",
      "exportPath": "settings.endpoint",
      "choices": [
        "disappear",
        "grayscale"
      ]
    },
    {
      "key": "noiseScale",
      "type": "number",
      "default": 0.035,
      "unit": "1/px",
      "controlGroup": "Effect",
      "exportPath": "settings.noiseScale",
      "min": 0.002,
      "max": 0.25,
      "step": 0.001
    },
    {
      "key": "edgeWidth",
      "type": "number",
      "default": 8,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.edgeWidth",
      "min": 0,
      "max": 65,
      "step": 0.1
    },
    {
      "key": "edgeGlow",
      "type": "number",
      "default": 0.7,
      "unit": "multiplier",
      "controlGroup": "Effect",
      "exportPath": "settings.edgeGlow",
      "min": 0,
      "max": 2,
      "step": 0.01
    },
    {
      "key": "direction",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Effect",
      "exportPath": "settings.direction",
      "min": -180,
      "max": 180,
      "step": 1
    },
    {
      "key": "particleRate",
      "type": "number",
      "default": 30,
      "unit": "1/s",
      "controlGroup": "Effect",
      "exportPath": "settings.particleRate",
      "min": 0,
      "max": 300,
      "step": 0.1
    },
    {
      "key": "roughness",
      "type": "number",
      "default": 0.5,
      "unit": "fraction",
      "controlGroup": "Effect",
      "exportPath": "settings.roughness",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "lifetimeFrames",
      "type": "integer",
      "default": 18,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.lifetimeFrames",
      "min": 1,
      "max": 3600,
      "step": 1
    },
    {
      "key": "particleSize",
      "type": "number",
      "default": 3,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.particleSize",
      "min": 0.5,
      "max": 20,
      "step": 0.1
    },
    {
      "key": "driftSpeed",
      "type": "number",
      "default": 50,
      "unit": "px/s",
      "controlGroup": "Effect",
      "exportPath": "settings.driftSpeed",
      "min": 0,
      "max": 250,
      "step": 1
    },
    {
      "key": "intervalFrames",
      "type": "number",
      "default": 2,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.intervalFrames",
      "min": 0.25,
      "max": 3600,
      "step": 0.01
    },
    {
      "key": "minIntervalFrames",
      "type": "number",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.minIntervalFrames",
      "min": 0,
      "max": 3600,
      "step": 0.01
    },
    {
      "key": "timeJitter",
      "type": "number",
      "default": 0,
      "unit": "fraction",
      "controlGroup": "Effect",
      "exportPath": "settings.timeJitter",
      "min": 0,
      "max": 0.45,
      "step": 0.01
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
      "unit": "count",
      "controlGroup": "Effect",
      "exportPath": "settings.burstCount",
      "min": 1,
      "max": 64,
      "step": 1
    },
    {
      "key": "burstStartFrame",
      "type": "number",
      "default": 1,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.burstStartFrame",
      "min": 0.0001,
      "max": 3600,
      "step": 0.0001
    },
    {
      "key": "burstDelayFrames",
      "type": "number",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.burstDelayFrames",
      "min": 0,
      "max": 3600,
      "step": 0.01
    },
    {
      "key": "spacingPx",
      "type": "number",
      "default": 8,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.spacingPx",
      "min": 2,
      "max": 95,
      "step": 0.25
    },
    {
      "key": "minGapPx",
      "type": "number",
      "default": 2,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.minGapPx",
      "min": 2,
      "max": 95,
      "step": 0.25
    },
    {
      "key": "maxGapPx",
      "type": "number",
      "default": 95,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.maxGapPx",
      "min": 2,
      "max": 95,
      "step": 0.25
    },
    {
      "key": "spatialJitter",
      "type": "number",
      "default": 0,
      "unit": "fraction",
      "controlGroup": "Effect",
      "exportPath": "settings.spatialJitter",
      "min": 0,
      "max": 0.45,
      "step": 0.01
    },
    {
      "key": "distribution",
      "type": "enum",
      "default": "even",
      "unit": "mode",
      "controlGroup": "Effect",
      "exportPath": "settings.distribution",
      "choices": [
        "even",
        "random",
        "stratified",
        "clustered"
      ]
    },
    {
      "key": "seed",
      "type": "integer",
      "default": 4111,
      "unit": "int32",
      "controlGroup": "Effect",
      "exportPath": "settings.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "quality",
      "type": "enum",
      "default": "balanced",
      "unit": "mode",
      "controlGroup": "Effect",
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
      "controlGroup": "Effect",
      "exportPath": "settings.style",
      "choices": [
        "natural",
        "stylized",
        "magical"
      ]
    },
    {
      "key": "frequencySource",
      "type": "enum",
      "default": "rate",
      "unit": "mode",
      "controlGroup": "Effect",
      "exportPath": "settings.frequencySource",
      "choices": [
        "rate",
        "interval"
      ]
    },
    {
      "key": "rect.x",
      "type": "integer",
      "default": 0,
      "unit": "px",
      "controlGroup": "Capture",
      "exportPath": "settings.rect.x",
      "min": -16384,
      "max": 16384,
      "step": 1
    },
    {
      "key": "rect.y",
      "type": "integer",
      "default": 0,
      "unit": "px",
      "controlGroup": "Capture",
      "exportPath": "settings.rect.y",
      "min": -16384,
      "max": 16384,
      "step": 1
    },
    {
      "key": "rect.width",
      "type": "integer",
      "default": 512,
      "unit": "px",
      "controlGroup": "Capture",
      "exportPath": "settings.rect.width",
      "min": 1,
      "max": 1024,
      "step": 1
    },
    {
      "key": "rect.height",
      "type": "integer",
      "default": 512,
      "unit": "px",
      "controlGroup": "Capture",
      "exportPath": "settings.rect.height",
      "min": 1,
      "max": 1024,
      "step": 1
    }
  ],
  "controlGroups": [
    "Effect",
    "Capture"
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
      "id": "progressCurve",
      "key": "progressCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "edgeCurve",
      "key": "edgeCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "sizeCurve",
      "key": "sizeCurve",
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
    "temporal": "Rate or interval, independent burst, delay, min interval and seeded jitter; global endpoint births excluded.",
    "spatial": "Quantized marching triangles split at alpha cells; shared arc tables carry distance across 256-segment chunks; no connection across holes, explicit shortage."
  },
  "palettes": [
    {
      "id": "dissolve-rgba",
      "key": "palette",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#FFFFFF",
        "#FFCC72",
        "#FF632D"
      ]
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "Independent emitter and layer seeds, base and burst event IDs, field and debris drift."
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
    "strategy": "Shared uint16 scalar atlas, GLSL/WGSL fixed triangular interpolation, isolated source capture, pooled debris; actual GPU pending."
  },
  "qualityBudgets": {
    "low": {
      "primitives": 256,
      "maxEmitters": 4,
      "maxSegments": 32768,
      "maxEvents": 4096,
      "maxCandidates": 8192
    },
    "balanced": {
      "primitives": 1024,
      "maxEmitters": 4,
      "maxSegments": 32768,
      "maxEvents": 4096,
      "maxCandidates": 8192
    },
    "high": {
      "primitives": 2048,
      "maxEmitters": 4,
      "maxSegments": 32768,
      "maxEvents": 4096,
      "maxCandidates": 8192
    }
  },
  "tests": {
    "verified": false,
    "evidence": [],
    "required": [
      "Actual WebGL1/2 and WebGPU shader compilation, alpha and pixel parity, source preservation and visual phases",
      "All artist parameter witnesses and real Spine weighted mesh/clipping/physics, canonical frame replay",
      "40-frame PNG decode and CRC, independent crop and camera, both developer Vite builds and architecture gates"
    ]
  },
  "outOfScope": [
    "Actual GPU and package acceptance pending; no reference promotion",
    "No seamless loop; global one-shot endpoints",
    "No full affine shear/reflection, slot interleaving, or subpixel mesh clipping claim",
    "Capture rectangle capped at 1024px per dimension, temporary alpha cache 64 MiB; no measured real-time performance guarantee"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "mode": "settings.mode",
      "durationFrames": "settings.durationFrames",
      "endpoint": "settings.endpoint",
      "noiseScale": "settings.noiseScale",
      "edgeWidth": "settings.edgeWidth",
      "edgeGlow": "settings.edgeGlow",
      "direction": "settings.direction",
      "particleRate": "settings.particleRate",
      "roughness": "settings.roughness",
      "lifetimeFrames": "settings.lifetimeFrames",
      "particleSize": "settings.particleSize",
      "driftSpeed": "settings.driftSpeed",
      "intervalFrames": "settings.intervalFrames",
      "minIntervalFrames": "settings.minIntervalFrames",
      "timeJitter": "settings.timeJitter",
      "burstEnabled": "settings.burstEnabled",
      "burstCount": "settings.burstCount",
      "burstStartFrame": "settings.burstStartFrame",
      "burstDelayFrames": "settings.burstDelayFrames",
      "spacingPx": "settings.spacingPx",
      "minGapPx": "settings.minGapPx",
      "maxGapPx": "settings.maxGapPx",
      "spatialJitter": "settings.spatialJitter",
      "distribution": "settings.distribution",
      "seed": "settings.seed",
      "quality": "settings.quality",
      "style": "settings.style",
      "frequencySource": "settings.frequencySource",
      "rect.x": "settings.rect.x",
      "rect.y": "settings.rect.y",
      "rect.width": "settings.rect.width",
      "rect.height": "settings.rect.height"
    },
    "preview": "not-implemented",
    "pngBake": "not-implemented",
    "developerZip": "not-implemented",
    "invariant": "Candidate implementation exists but v1 registry cannot claim verified exports until actual acceptance."
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject"
  },
  "implementation": {
    "status": "specification-only",
    "sourceFiles": [],
    "notes": "D01–D04 candidate implemented in assets/dissolve/src. Do not reimplement; actual acceptance pending."
  }
}
```
