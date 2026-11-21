# FIRE-01 — Torch Flame

**Status:** reference-implementation (FIRE-01). **Scope:** a separate editable effect, not Burn transition. Core contract modules and pinned PixiJS/Spine share the same versions as the original Lab.

## Machine-checkable Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.fire.torch-flame",
  "effectVersion": "0.1.0",
  "presetSchemaVersion": 1,
  "category": "fire",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "Continuous wick/nozzle-anchored animated flame with a bright core, independently moving tongues, optional warm glow and rising embers; seeded reproducible looping flames, not a burn/grayscale mask.",
  "phases": [
    {
      "id": "loop-start",
      "at": 0,
      "look": "full stable anchored flame at loop phase 0, optional ignition as a separate transient"
    },
    {
      "id": "active",
      "at": 0.5,
      "look": "bright core, visibly changing tongues, optional detached embers and warm halo"
    },
    {
      "id": "loop-seam",
      "at": 1,
      "look": "same procedural flame geometry and color as phase 0 (exclusive 60 frame endpoint); optional extinguish is an authored non-loop transient"
    }
  ],
  "layers": [
    {
      "id": "core",
      "kind": "geometry",
      "position": "torch-wick",
      "purpose": "central high-intensity flame silhouette, independently toggled/XY"
    },
    {
      "id": "tongues",
      "kind": "geometry",
      "position": "torch-wick",
      "purpose": "animated outer tongue silhouettes, turbulence and count"
    },
    {
      "id": "glow",
      "kind": "geometry",
      "position": "torch-wick",
      "purpose": "transparent additive bounded warm glow, zero radius removes it"
    },
    {
      "id": "embers",
      "kind": "particles",
      "position": "torch-wick",
      "purpose": "time/space independently scheduled, seeded rising embers"
    }
  ],
  "emitterAnchors": [
    {
      "id": "wick",
      "space": "world-or-local-Spine",
      "onMissing": "hide-and-diagnose"
    },
    {
      "id": "bone",
      "space": "Spine-bone-local",
      "onMissing": "hide-and-diagnose"
    },
    {
      "id": "slot",
      "space": "Spine-slot-local",
      "onMissing": "hide-and-diagnose"
    },
    {
      "id": "attachment",
      "space": "Spine-attachment-local",
      "onMissing": "hide-and-diagnose"
    }
  ],
  "parameters": [
    {
      "key": "flameHeight",
      "type": "number",
      "default": 110,
      "min": 16,
      "max": 320,
      "step": 1,
      "unit": "logical-pixels",
      "controlGroup": "Flame geometry",
      "exportPath": "settings.flameHeight"
    },
    {
      "key": "baseWidth",
      "type": "number",
      "default": 36,
      "min": 4,
      "max": 160,
      "step": 1,
      "unit": "logical-pixels",
      "controlGroup": "Flame geometry",
      "exportPath": "settings.baseWidth"
    },
    {
      "key": "turbulence",
      "type": "number",
      "default": 0.4,
      "min": 0,
      "max": 1,
      "step": 0.01,
      "unit": "normalized-0-1",
      "controlGroup": "Flame geometry",
      "exportPath": "settings.turbulence"
    },
    {
      "key": "tongueCount",
      "type": "integer",
      "default": 5,
      "min": 1,
      "max": 16,
      "step": 1,
      "unit": "count",
      "controlGroup": "Flame geometry",
      "exportPath": "settings.tongueCount"
    },
    {
      "key": "tongueGap",
      "type": "number",
      "default": 8,
      "min": 4,
      "max": 24,
      "step": 0.5,
      "unit": "logical-pixels",
      "controlGroup": "Flame geometry",
      "exportPath": "settings.tongueGap"
    },
    {
      "key": "flickerFrequency",
      "type": "number",
      "default": 7,
      "min": 0,
      "max": 20,
      "step": 0.1,
      "unit": "hertz",
      "controlGroup": "Flame geometry",
      "exportPath": "settings.flickerFrequency"
    },
    {
      "key": "cycleFrames",
      "type": "integer",
      "default": 60,
      "min": 6,
      "max": 3600,
      "step": 1,
      "unit": "frames",
      "controlGroup": "Timing",
      "exportPath": "settings.cycleFrames"
    },
    {
      "key": "ignitionFrames",
      "type": "integer",
      "default": 0,
      "min": 0,
      "max": 600,
      "step": 1,
      "unit": "frames",
      "controlGroup": "Timing",
      "exportPath": "settings.ignitionFrames"
    },
    {
      "key": "extinguishFrames",
      "type": "integer",
      "default": 0,
      "min": 0,
      "max": 600,
      "step": 1,
      "unit": "frames",
      "controlGroup": "Timing",
      "exportPath": "settings.extinguishFrames"
    },
    {
      "key": "seed",
      "type": "integer",
      "default": 8,
      "min": -2147483648,
      "max": 2147483647,
      "step": 1,
      "unit": "int32",
      "controlGroup": "Advanced",
      "exportPath": "settings.seed"
    },
    {
      "key": "emberRate",
      "type": "number",
      "default": 20,
      "min": 0,
      "max": 240,
      "step": 1,
      "unit": "particles-per-second",
      "controlGroup": "Embers and glow",
      "exportPath": "settings.emberRate"
    },
    {
      "key": "emberOriginGap",
      "type": "number",
      "default": 8,
      "min": 0.25,
      "max": 100,
      "step": 0.25,
      "unit": "logical-pixels",
      "controlGroup": "Embers and glow",
      "exportPath": "settings.emberOriginGap"
    },
    {
      "key": "emberSize",
      "type": "number",
      "default": 3,
      "min": 1,
      "max": 12,
      "step": 0.25,
      "unit": "logical-pixels",
      "controlGroup": "Embers and glow",
      "exportPath": "settings.emberSize"
    },
    {
      "key": "emberLife",
      "type": "number",
      "default": 0.85,
      "min": 0.1,
      "max": 4,
      "step": 0.05,
      "unit": "seconds",
      "controlGroup": "Embers and glow",
      "exportPath": "settings.emberLife"
    },
    {
      "key": "glowRadius",
      "type": "number",
      "default": 24,
      "min": 0,
      "max": 90,
      "step": 1,
      "unit": "logical-pixels",
      "controlGroup": "Embers and glow",
      "exportPath": "settings.glowRadius"
    },
    {
      "key": "quality",
      "type": "enum",
      "default": "balanced",
      "unit": "quality-preset",
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
      "unit": "appearance-style",
      "controlGroup": "Palette",
      "exportPath": "settings.style",
      "choices": [
        "natural",
        "stylized",
        "magical"
      ]
    }
  ],
  "controlGroups": [
    "Flame geometry",
    "Timing",
    "Embers and glow",
    "Palette",
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
      "id": "flame-width",
      "key": "widthCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "flicker-strength",
      "key": "flickerCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "ember-alpha",
      "key": "emberAlphaCurve",
      "domain": "particleAge",
      "contract": "curves"
    }
  ],
  "spacing": {
    "enabledByDefault": true,
    "contract": "spacing",
    "modes": [
      "time-rate",
      "time-interval",
      "distance-arc-length"
    ],
    "note": "FxSpacing uniform/jittered temporal ember schedule in seconds and independent real arc-length placement along base width; tongueGap is independent geometry offset."
  },
  "palettes": [
    {
      "id": "torch-gradient",
      "key": "flameGradient",
      "domain": "flameIntensity",
      "contract": "colors"
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "periodic time-sampled tongue geometry and isolated ember event ID/seed; no frame-rate RNG, no global Math.random"
  },
  "rendering": {
    "approach": "composition",
    "strategy": "Renderer-neutral procedural polygons, Pixi Graphics circles/ellipses. No custom shader; same module drives WebGL 1/2 and WebGPU.",
    "backends": [
      "webgl1",
      "webgl2",
      "webgpu"
    ],
    "runtimePins": {
      "pixi": "8.22.0",
      "spine": "4.2.120"
    },
    "fallback": "Requested renderer/actual renderer exposed and tested separately; never claim WebGPU when fallback is WebGL",
    "shaderStatus": "No standalone GLSL/WGSL required; uses pinned native Pixi Graphics"
  },
  "qualityBudgets": {
    "low": {
      "maxTongues": 6,
      "maxEmbers": 32,
      "maxPrimitives": 50,
      "glowPasses": 2
    },
    "balanced": {
      "maxTongues": 12,
      "maxEmbers": 96,
      "maxPrimitives": 125,
      "glowPasses": 4
    },
    "high": {
      "maxTongues": 16,
      "maxEmbers": 160,
      "maxPrimitives": 210,
      "glowPasses": 6
    }
  },
  "tests": {
    "verified": true,
    "evidence": [
      "scripts/test_torch_core.cjs",
      "scripts/test_torch_editor.cjs"
    ],
    "required": [
      "Actual WebGL1/WebGL2/WebGPU, 512x512 transparent RGBA",
      "60-frame seeded-loop PNG ZIP with timeline at exactly frameIndex/60",
      "Separate WebGL/WebGPU Vite developer packages with pinned runtimes and local sample assets",
      "Turbulence changes geometry independent of opacity; zero glow keeps crisp flame",
      "All independent layers toggle and can move XY; all off produces transparent PNG",
      "Bone anchor follows real animated Spine pose, with missing name hidden and diagnosed",
      "Temporal ember event rate and spatial ember origin gap both numerically change actual events/positions",
      "FxCurveEditor width/flicker/alpha edits, FxColorUi gradient stops and preset JSON round-trip",
      "Camera 50/100/200% does not change same-backend PNG bytes; offline",
      "Source Burn Lab hashes and existing developer ZIP preserved unchanged"
    ]
  },
  "outOfScope": [
    "Do not reuse Burn transition mask or legacy grayscale/desaturation settings",
    "No physically calibrated fluid combustion simulation or volumetric lighting",
    "No universal editable FX graph; Torch is a standalone editor",
    "No extra standalone GLSL/WGSL unless a separately approved visual style requires a shader"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "flameHeight": "settings.flameHeight",
      "baseWidth": "settings.baseWidth",
      "turbulence": "settings.turbulence",
      "tongueCount": "settings.tongueCount",
      "tongueGap": "settings.tongueGap",
      "flickerFrequency": "settings.flickerFrequency",
      "cycleFrames": "settings.cycleFrames",
      "ignitionFrames": "settings.ignitionFrames",
      "extinguishFrames": "settings.extinguishFrames",
      "seed": "settings.seed",
      "emberRate": "settings.emberRate",
      "emberOriginGap": "settings.emberOriginGap",
      "emberSize": "settings.emberSize",
      "emberLife": "settings.emberLife",
      "glowRadius": "settings.glowRadius",
      "quality": "settings.quality",
      "style": "settings.style"
    },
    "preview": "assets/Torch_Flame_Lab.html",
    "pngBake": "TorchExports.bake (60 FPS isolated full 512x512 stage PNG ZIP)",
    "developerZip": "TorchExports.buildPackage ('webgl' or 'webgpu')",
    "invariant": "Exact FxTorch core/runtime for preview, PNG and developer Vite modules; no copied burn shader"
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject",
    "policy": "Reject unknown effect/preset/schema; future version requires explicit tested migration"
  },
  "implementation": {
    "status": "reference-implementation",
    "sourceFiles": [
      "assets/torch-flame/src/torch-core.js",
      "assets/torch-flame/src/torch-runtime.js",
      "assets/torch-flame/src/torch-editor.js",
      "assets/torch-flame/src/torch-export.js",
      "assets/torch-flame/src/zip-core.js",
      "assets/torch-flame/src/ui.html",
      "scripts/build_torch_editor.py",
      "assets/Torch_Flame_Lab.html"
    ],
    "notes": "Independent offline editor, source-backed numeric/browser QA and samples; does not replace existing Burn transition."
  }
}
```

## Usage and caveats

Open [the standalone offline Torch editor](../../../assets/Torch_Flame_Lab.html). For editable sources use `assets/torch-flame/src/` and build with `python scripts/build_torch_editor.py --output assets/Torch_Flame_Lab.html`.

Use `scripts/test_torch_core.cjs` for independent numerical reproduction, then `scripts/test_torch_editor.cjs` for browser backend proof. Export failures, unsupported hardware, unrun physical phone/device tests and unverified controls must be reported distinctly from successful browser checks. The GPU tests are Chromium and do not certify all devices. To run the WebGPU browser QA on a headless Chrome build that requires explicit opt-in, set `FX_ENABLE_UNSAFE_WEBGPU=1` and run `node scripts/test_torch_editor.cjs --backend webgpu --output <evidence-dir>`. This passes Chrome's `--enable-unsafe-webgpu` flag **only for a trusted local test browser**. Do not confuse this with `FX_SOFTWARE_GPU=1`: forcing SwiftShader may cause a WebGL2 fallback even when WebGPU was requested. A backend counts as verified only when `getActualBackend().actual` matches the requested backend; unsupported configurations must remain **NOT RUN**, never silent PASS.
