# FIRE-02 — Fire Explosion: independent editable FX Lab

Standalone procedural one-shot explosion with **six independently switchable layers**. Initial 40-frame authoring sequence at 60 FPS; preview supports explicit loop; smoke extends beyond the default sequence when extra frames are exported. Coordinates are 512×512 logical pixels; large values are detected and must be explicitly fitted or reduced before baking.

## Versioned FX Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.fire.fire-explosion",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "fire",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "Radial or directional one-shot explosion: instant flash, rapid irregular orange fire expansion, separate shockwave, sparks, debris and residual smoke. No static blurred sprite.",
  "phases": [
    {
      "id": "flash",
      "at": 0,
      "look": "Bright white-yellow flash at the blast origin (frame 0), no fire radius yet"
    },
    {
      "id": "expansion",
      "at": 0.3,
      "look": "Fast fireball growth with moving tongues, shockwave, sparks and debris (near frame 12)"
    },
    {
      "id": "breakup",
      "at": 0.55,
      "look": "Bright core fading, separate radiating particles and independent new smoke"
    },
    {
      "id": "smoke",
      "at": 1,
      "look": "At the exclusive 40/60-second one-shot endpoint, fire/ring have ended and residual smoke persists; export frame 39 remains the last included sample"
    }
  ],
  "layers": [
    {
      "id": "flash",
      "kind": "geometry",
      "position": "explosion-origin+independent-layer-XY",
      "purpose": "Short intense flash, separately toggled/moved"
    },
    {
      "id": "fire",
      "kind": "geometry",
      "position": "explosion-origin+independent-layer-XY",
      "purpose": "Rapid non-linear expanding fire polygons and curved alpha"
    },
    {
      "id": "shockwave",
      "kind": "geometry",
      "position": "explosion-origin+independent-layer-XY",
      "purpose": "Independent spreading stroke ring, disappears after flash/expansion"
    },
    {
      "id": "sparks",
      "kind": "particles",
      "position": "explosion-origin+independent-layer-XY",
      "purpose": "Seeded radial/directional launch with true speed and adjustable birth jitter"
    },
    {
      "id": "debris",
      "kind": "particles",
      "position": "explosion-origin+independent-layer-XY",
      "purpose": "Seeded spark-independent arc-length-distributed perimeter fragments"
    },
    {
      "id": "smoke",
      "kind": "particles",
      "position": "explosion-origin+independent-layer-XY",
      "purpose": "Independent persistent grey volume after the 40-frame source duration"
    }
  ],
  "emitterAnchors": [
    {
      "id": "origin",
      "space": "world/local",
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
      "key": "blastRadius",
      "type": "number",
      "default": 100,
      "min": 10,
      "max": 350,
      "step": 1,
      "unit": "logical-pixels",
      "controlGroup": "Blast geometry and motion",
      "exportPath": "settings.blastRadius"
    },
    {
      "key": "burstSparks",
      "type": "integer",
      "default": 80,
      "min": 0,
      "max": 500,
      "step": 1,
      "unit": "count",
      "controlGroup": "Sparks, debris and smoke",
      "exportPath": "settings.burstSparks"
    },
    {
      "key": "initialSpeed",
      "type": "number",
      "default": 240,
      "min": 0,
      "max": 800,
      "step": 1,
      "unit": "logical-pixels-per-second",
      "controlGroup": "Blast geometry and motion",
      "exportPath": "settings.initialSpeed"
    },
    {
      "key": "expansion",
      "type": "number",
      "default": 2,
      "min": 0.2,
      "max": 6,
      "step": 0.1,
      "unit": "multiplier",
      "controlGroup": "Blast geometry and motion",
      "exportPath": "settings.expansion"
    },
    {
      "key": "shockwaveWidth",
      "type": "number",
      "default": 12,
      "min": 0,
      "max": 60,
      "step": 1,
      "unit": "logical-pixels",
      "controlGroup": "Blast geometry and motion",
      "exportPath": "settings.shockwaveWidth"
    },
    {
      "key": "smokePersistence",
      "type": "integer",
      "default": 24,
      "min": 0,
      "max": 180,
      "step": 1,
      "unit": "frames-at-60fps",
      "controlGroup": "Sparks, debris and smoke",
      "exportPath": "settings.smokePersistence"
    },
    {
      "key": "turbulence",
      "type": "number",
      "default": 0.5,
      "min": 0,
      "max": 1,
      "step": 0.01,
      "unit": "normalized-0-1",
      "controlGroup": "Blast geometry and motion",
      "exportPath": "settings.turbulence"
    },
    {
      "key": "sparkOriginGap",
      "type": "number",
      "default": 8,
      "min": 0.25,
      "max": 100,
      "step": 0.25,
      "unit": "logical-pixels",
      "controlGroup": "Sparks, debris and smoke",
      "exportPath": "settings.sparkOriginGap"
    },
    {
      "key": "debrisSpacing",
      "type": "number",
      "default": 16,
      "min": 8,
      "max": 32,
      "step": 0.5,
      "unit": "logical-pixels-along-arc",
      "controlGroup": "Sparks, debris and smoke",
      "exportPath": "settings.debrisSpacing"
    },
    {
      "key": "burstJitter",
      "type": "number",
      "default": 0.15,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "frames-at-60fps",
      "controlGroup": "Sparks, debris and smoke",
      "exportPath": "settings.burstJitter"
    },
    {
      "key": "secondaryCount",
      "type": "integer",
      "default": 16,
      "min": 0,
      "max": 500,
      "step": 1,
      "unit": "count-per-secondary-burst",
      "controlGroup": "Sparks, debris and smoke",
      "exportPath": "settings.secondaryCount"
    },
    {
      "key": "smokeCount",
      "type": "integer",
      "default": 12,
      "min": 0,
      "max": 64,
      "step": 1,
      "unit": "count",
      "controlGroup": "Sparks, debris and smoke",
      "exportPath": "settings.smokeCount"
    },
    {
      "key": "durationFrames",
      "type": "integer",
      "default": 40,
      "min": 6,
      "max": 600,
      "step": 1,
      "unit": "frames-at-60fps",
      "controlGroup": "Blast geometry and motion",
      "exportPath": "settings.durationFrames"
    },
    {
      "key": "exportFrames",
      "type": "integer",
      "default": 40,
      "min": 1,
      "max": 3600,
      "step": 1,
      "unit": "frames-at-60fps",
      "controlGroup": "Blast geometry and motion",
      "exportPath": "settings.exportFrames"
    },
    {
      "key": "heading",
      "type": "number",
      "default": 0,
      "min": -360,
      "max": 360,
      "step": 1,
      "unit": "degrees-directional-only",
      "controlGroup": "Blast geometry and motion",
      "exportPath": "settings.heading"
    },
    {
      "key": "spread",
      "type": "number",
      "default": 90,
      "min": 1,
      "max": 360,
      "step": 1,
      "unit": "degrees-directional-only",
      "controlGroup": "Blast geometry and motion",
      "exportPath": "settings.spread"
    },
    {
      "key": "seed",
      "type": "integer",
      "default": 419,
      "min": -2147483648,
      "max": 2147483647,
      "step": 1,
      "unit": "int32",
      "controlGroup": "Blast geometry and motion",
      "exportPath": "settings.seed"
    },
    {
      "key": "secondaryBursts",
      "type": "boolean",
      "default": false,
      "unit": "enabled",
      "controlGroup": "Burst scheduling and direction",
      "exportPath": "settings.secondaryBursts"
    },
    {
      "key": "debrisSpacingCurveEnabled",
      "type": "boolean",
      "default": false,
      "unit": "enabled",
      "controlGroup": "Burst scheduling and direction",
      "exportPath": "settings.debrisSpacingCurveEnabled"
    },
    {
      "key": "loop",
      "type": "boolean",
      "default": false,
      "unit": "enabled",
      "controlGroup": "Burst scheduling and direction",
      "exportPath": "settings.loop"
    },
    {
      "key": "directionMode",
      "type": "enum",
      "default": "radial",
      "choices": [
        "radial",
        "directional"
      ],
      "unit": "enum",
      "controlGroup": "Burst scheduling and direction",
      "exportPath": "settings.directionMode"
    },
    {
      "key": "spatialMode",
      "type": "enum",
      "default": "even",
      "choices": [
        "even",
        "random",
        "stratified",
        "clustered"
      ],
      "unit": "enum",
      "controlGroup": "Burst scheduling and direction",
      "exportPath": "settings.spatialMode"
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
      "controlGroup": "Preset and export",
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
      "controlGroup": "Color gradient and style",
      "exportPath": "settings.style"
    }
  ],
  "controlGroups": [
    "Blast geometry and motion",
    "Sparks, debris and smoke",
    "Burst scheduling and direction",
    "Color gradient and style",
    "Preset and export"
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
      "id": "explosion-radius",
      "key": "radiusCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "fire-alpha",
      "key": "fireAlphaCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "spark-speed",
      "key": "sparkSpeedCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "smoke-size",
      "key": "smokeSizeCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "emission-gap",
      "key": "emissionGapCurve",
      "domain": "emitterTime",
      "contract": "curves"
    },
    {
      "id": "debris-spacing",
      "key": "debrisSpacingCurve",
      "domain": "pathPosition",
      "contract": "curves"
    }
  ],
  "spacing": {
    "enabledByDefault": true,
    "contract": "spacing",
    "modes": [
      "burst-birth-timestamps",
      "seeded-jitter",
      "distance-arc-length"
    ],
    "note": "Initial burst is one-shot; optional secondary bursts at frames 5 and 9. burstJitter plus emitterTime emissionGapCurve change real birth times. Arc-length spacing is calculated on a closed cubic perimeter, independent of spark launch speed, with 8-32px debrisSpacing and optional pathPosition curve."
  },
  "palettes": [
    {
      "id": "explosion-gradient",
      "key": "explosionGradient",
      "domain": "flameIntensity",
      "contract": "colors"
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "Independent indexed hash streams for fire, sparks, smoke and debris; no frame-tick PRNG. Absolute time produces reproducible output even after reverse seek."
  },
  "rendering": {
    "approach": "composition",
    "strategy": "Renderer-neutral bounded Pixi Graphics polygons/circles/rings/rectangles, no standalone custom shader; same FxExplosion pure core drives real WebGL1/2/WebGPU.",
    "backends": [
      "webgl1",
      "webgl2",
      "webgpu"
    ],
    "runtimePins": {
      "pixi": "8.22.0",
      "spine": "4.2.120"
    },
    "fallback": "Expose real renderer, reject silent renderer mismatch and out-of-bounds 512x512 bake; explicit Fit to canvas scales settings, not PNG crop.",
    "shaderStatus": "No GLSL/WGSL required for the baseline Pixi Graphics composition."
  },
  "qualityBudgets": {
    "low": {
      "maxSparks": 48,
      "maxDebris": 30,
      "maxSmoke": 8,
      "maxTongues": 8,
      "maxPrimitives": 112
    },
    "balanced": {
      "maxSparks": 120,
      "maxDebris": 64,
      "maxSmoke": 16,
      "maxTongues": 14,
      "maxPrimitives": 235
    },
    "high": {
      "maxSparks": 320,
      "maxDebris": 108,
      "maxSmoke": 28,
      "maxTongues": 24,
      "maxPrimitives": 505
    }
  },
  "tests": {
    "verified": true,
    "evidence": [
      "scripts/test_explosion_core.cjs",
      "scripts/test_explosion_editor.cjs"
    ],
    "required": [
      "Radial and directional 40-frame one-shot phases, visible flash, fire, shockwave, sparks, debris and persistent smoke",
      "Six independent toggles and XY/rotation/time offset; all disabled leaves transparent RGBA PNG",
      "Real temporal event jitter and radial arc-length distance oracles; opt-in secondary bursts",
      "Editable six curves, strict schema, seeded deterministic arbitrary seek and JSON preset roundtrip",
      "Bounds-safe 512x512 bake, explicit Fit action, reject oversized effects without exporting cropped frames",
      "Actual WebGL1, WebGL2 and WebGPU, 50/100/200% CSS zoom invariance, light/dark/checker backgrounds",
      "Spine 4.2 multipage atlas, animated bone anchor follow, missing bone diagnostic",
      "PNG ZIP CRC/PMA/straight-alpha, one-shot frameIndex/60, 1-3600 export frames and cancellation restore",
      "ESM parity, Vite build and live Chromium smoke for separate WebGL/WebGPU developer ZIPs",
      "Preserve original Burn Lab and separate Torch Flame and pinned vendor hashes"
    ]
  },
  "outOfScope": [
    "No physically accurate combustion/pressure CFD simulation",
    "No generic editable effect graph, replacement Burn editor or Torch Flame redefinition",
    "No dependency or runtime major upgrade and no mobile GPU performance certification",
    "No silent automatic scale-down or implicit looping; any fit action is explicit and updates parameters"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "blastRadius": "settings.blastRadius",
      "burstSparks": "settings.burstSparks",
      "initialSpeed": "settings.initialSpeed",
      "expansion": "settings.expansion",
      "shockwaveWidth": "settings.shockwaveWidth",
      "smokePersistence": "settings.smokePersistence",
      "turbulence": "settings.turbulence",
      "sparkOriginGap": "settings.sparkOriginGap",
      "debrisSpacing": "settings.debrisSpacing",
      "burstJitter": "settings.burstJitter",
      "secondaryCount": "settings.secondaryCount",
      "smokeCount": "settings.smokeCount",
      "durationFrames": "settings.durationFrames",
      "exportFrames": "settings.exportFrames",
      "heading": "settings.heading",
      "spread": "settings.spread",
      "seed": "settings.seed",
      "secondaryBursts": "settings.secondaryBursts",
      "debrisSpacingCurveEnabled": "settings.debrisSpacingCurveEnabled",
      "loop": "settings.loop",
      "directionMode": "settings.directionMode",
      "spatialMode": "settings.spatialMode",
      "quality": "settings.quality",
      "style": "settings.style"
    },
    "preview": "assets/Fire_Explosion_Lab.html",
    "pngBake": "ExplosionExports.bake; one-shot 40 default, 1-3600 frames, 512x512 transparent straight-alpha PNG ZIP at i/60; error on clipped effect",
    "developerZip": "ExplosionExports.buildPackage('webgl'|'webgpu') with FxExplosion shared ESM core",
    "invariant": "Same FxExplosion sampled geometry for preview, PNG and both developer packages"
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject",
    "policy": "Reject unknown effect/preset/schema versions until independently tested migrations."
  },
  "implementation": {
    "status": "reference-implementation",
    "sourceFiles": [
      "assets/fire-explosion/src/explosion-core.js",
      "assets/fire-explosion/src/explosion-runtime.js",
      "assets/fire-explosion/src/explosion-editor.js",
      "assets/fire-explosion/src/explosion-export.js",
      "assets/fire-explosion/src/zip-core.js",
      "assets/fire-explosion/src/ui.html",
      "scripts/build_explosion_editor.py",
      "assets/Fire_Explosion_Lab.html"
    ],
    "notes": "Dedicated offline FIRE-02 editor independent from Burn and Torch. Source backed browser/PNG tests required for release."
  }
}
```

## Run and verify

Open `assets/Fire_Explosion_Lab.html` offline or rebuild it with `python scripts/build_explosion_editor.py --output assets/Fire_Explosion_Lab.html`. Use `node scripts/test_explosion_core.cjs` and the backend-selectable `scripts/test_explosion_editor.cjs`. Browser proof is only valid for the **actual** detected backend. Developer ZIPs use pinned PixiJS 8.22.0 and Spine 4.2.120. Physical mobile GPU tests and performance are not certified.
