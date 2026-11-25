# Hit Sparks

GAME-02 / #41 — **implementation candidate; GPU acceptance pending**. Source exists in `assets/hit-sparks/src/`; do not recreate. V1 registry status remains `specification-only` until real browser/developer acceptance.

Build outside checkout:

    python scripts/build_hit_sparks_editor.py --output ../HitSparks.html

Run local tests:

    node --test scripts/test_hit_sparks_*.cjs
    python scripts/test_hit_sparks_builder.py
    python scripts/test_hit_sparks_acceptance_checks.py
    python scripts/test_hit_sparks_browser.py ../HitSparks.html --backend webgl2 --output ../hit-sparks-evidence-webgl2

Repeat with webgl1 and webgpu and empty evidence directories. Browser runner checks actual backend, isolated layer pixels, phase and crop parity, control changes, PNG sequence and camera invariance, sample asset identity, developer archive contents and local ESM demo execution with intercepted HTTPS requests. Actual GPU execution, Vite build and screenshot visual review remain outstanding gates. Unsupported backend is NOT_RUN, not PASS. The default 40 frames end transparent; dust begins at frame four. CPU numerical, pinned Pixi/Spine, builder and export tests do not establish GPU parity. All three layers have independent offsets, anchors and palettes. The 211-primitive cap is common to all quality labels. Parameter paths refer to the nested actual preset.

## Machine-checkable Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.game.hit-sparks",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "game",
  "styles": [
    "directional",
    "radial"
  ],
  "visualGoal": "Short radial or directional impact flash with tapered metal spark ribbons, delayed dust and friction slowdown. 512 logical px, 60 FPS, 40-frame one-shot.",
  "phases": [
    {
      "id": "impact",
      "at": 0,
      "look": "Flash and 20 primary ribbons appear simultaneously."
    },
    {
      "id": "dust",
      "at": 0.10256410256410256,
      "look": "Secondary small sparks begin; primary streaks decelerate and fade."
    },
    {
      "id": "tail",
      "at": 1,
      "look": "Default one-shot is transparent. Longer authored delays/lifetimes may require more frames."
    }
  ],
  "layers": [
    {
      "id": "dust",
      "kind": "particles",
      "position": "Behind primary and flash",
      "purpose": "Delayed independently seeded dust"
    },
    {
      "id": "primary",
      "kind": "geometry",
      "position": "Above dust",
      "purpose": "Nine-section tapered spark ribbons"
    },
    {
      "id": "flash",
      "kind": "geometry",
      "position": "Front",
      "purpose": "Short radial polygon flash"
    }
  ],
  "emitterAnchors": [
    {
      "id": "world",
      "space": "world",
      "onMissing": "hide dependent layer; no fallback to origin"
    },
    {
      "id": "skeleton",
      "space": "local or world",
      "onMissing": "hide dependent layer; no fallback to origin"
    },
    {
      "id": "bone",
      "space": "local or world",
      "onMissing": "hide dependent layer; no fallback to origin"
    },
    {
      "id": "slot",
      "space": "local or world",
      "onMissing": "hide dependent layer; no fallback to origin"
    },
    {
      "id": "attachment",
      "space": "local or world",
      "onMissing": "hide dependent layer; no fallback to origin"
    }
  ],
  "parameters": [
    {
      "key": "effect.burstCount",
      "type": "integer",
      "default": 20,
      "unit": "count",
      "controlGroup": "Impact",
      "exportPath": "settings.effect.burstCount",
      "min": 0,
      "max": 140,
      "step": 1
    },
    {
      "key": "effect.spread",
      "type": "number",
      "default": 170,
      "unit": "degrees",
      "controlGroup": "Impact",
      "exportPath": "settings.effect.spread",
      "min": 0,
      "max": 360,
      "step": 1
    },
    {
      "key": "effect.initialSpeed",
      "type": "number",
      "default": 250,
      "unit": "px/s",
      "controlGroup": "Impact",
      "exportPath": "settings.effect.initialSpeed",
      "min": 0,
      "max": 900,
      "step": 1
    },
    {
      "key": "effect.sparkLength",
      "type": "number",
      "default": 18,
      "unit": "px",
      "controlGroup": "Impact",
      "exportPath": "settings.effect.sparkLength",
      "min": 2,
      "max": 80,
      "step": 0.1
    },
    {
      "key": "effect.width",
      "type": "number",
      "default": 2,
      "unit": "px",
      "controlGroup": "Impact",
      "exportPath": "settings.effect.width",
      "min": 0.5,
      "max": 12,
      "step": 0.1
    },
    {
      "key": "effect.durationFrames",
      "type": "integer",
      "default": 16,
      "unit": "frames",
      "controlGroup": "Impact",
      "exportPath": "settings.effect.durationFrames",
      "min": 1,
      "max": 120,
      "step": 1
    },
    {
      "key": "effect.dustCount",
      "type": "integer",
      "default": 10,
      "unit": "count",
      "controlGroup": "Impact",
      "exportPath": "settings.effect.dustCount",
      "min": 0,
      "max": 70,
      "step": 1
    },
    {
      "key": "effect.dustDelayFrames",
      "type": "integer",
      "default": 4,
      "unit": "frames",
      "controlGroup": "Impact",
      "exportPath": "settings.effect.dustDelayFrames",
      "min": 2,
      "max": 6,
      "step": 1
    },
    {
      "key": "effect.flashFrames",
      "type": "integer",
      "default": 4,
      "unit": "frames",
      "controlGroup": "Impact",
      "exportPath": "settings.effect.flashFrames",
      "min": 1,
      "max": 120,
      "step": 1
    },
    {
      "key": "effect.flashRadius",
      "type": "number",
      "default": 10,
      "unit": "px",
      "controlGroup": "Impact",
      "exportPath": "settings.effect.flashRadius",
      "min": 1,
      "max": 80,
      "step": 0.1
    },
    {
      "key": "effect.collisionNormal",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Impact",
      "exportPath": "settings.effect.collisionNormal",
      "min": -360,
      "max": 360,
      "step": 1
    },
    {
      "key": "effect.exportFrames",
      "type": "integer",
      "default": 40,
      "unit": "frames",
      "controlGroup": "Impact",
      "exportPath": "settings.effect.exportFrames",
      "min": 1,
      "max": 3600,
      "step": 1
    },
    {
      "key": "effect.staggerFrames",
      "type": "integer",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.effect.staggerFrames",
      "min": 0,
      "max": 120,
      "step": 1
    },
    {
      "key": "effect.minInterval",
      "type": "number",
      "default": 0,
      "unit": "seconds",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.effect.minInterval",
      "min": 0,
      "max": 2,
      "step": 0.001
    },
    {
      "key": "effect.timeJitter",
      "type": "number",
      "default": 0,
      "unit": "fraction",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.effect.timeJitter",
      "min": 0,
      "max": 0.45,
      "step": 0.01
    },
    {
      "key": "effect.frequencySource",
      "type": "enum",
      "default": "rate",
      "unit": "mode",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.effect.frequencySource",
      "choices": [
        "rate",
        "interval"
      ]
    },
    {
      "key": "effect.gap",
      "type": "number",
      "default": 7,
      "unit": "px",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.effect.gap",
      "min": 1,
      "max": 35,
      "step": 0.1
    },
    {
      "key": "effect.minGap",
      "type": "number",
      "default": 1,
      "unit": "px",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.effect.minGap",
      "min": 1,
      "max": 35,
      "step": 0.1
    },
    {
      "key": "effect.maxGap",
      "type": "number",
      "default": 35,
      "unit": "px",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.effect.maxGap",
      "min": 1,
      "max": 35,
      "step": 0.1
    },
    {
      "key": "effect.spatialJitter",
      "type": "number",
      "default": 0,
      "unit": "fraction",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.effect.spatialJitter",
      "min": 0,
      "max": 0.45,
      "step": 0.01
    },
    {
      "key": "effect.spatialMode",
      "type": "enum",
      "default": "even",
      "unit": "mode",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.effect.spatialMode",
      "choices": [
        "even",
        "random",
        "stratified",
        "clustered"
      ]
    },
    {
      "key": "effect.spacingCurveEnabled",
      "type": "boolean",
      "default": false,
      "unit": "toggle",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.effect.spacingCurveEnabled"
    },
    {
      "key": "effect.layers.flash.enabled",
      "type": "boolean",
      "default": true,
      "unit": "toggle",
      "controlGroup": "Flash",
      "exportPath": "settings.effect.layers.flash.enabled"
    },
    {
      "key": "effect.layers.flash.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Flash",
      "exportPath": "settings.effect.layers.flash.x",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "effect.layers.flash.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Flash",
      "exportPath": "settings.effect.layers.flash.y",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "effect.layers.flash.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Flash",
      "exportPath": "settings.effect.layers.flash.rotation",
      "min": -360,
      "max": 360,
      "step": 0.1
    },
    {
      "key": "effect.layers.flash.delayFrames",
      "type": "integer",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Flash",
      "exportPath": "settings.effect.layers.flash.delayFrames",
      "min": 0,
      "max": 120,
      "step": 1
    },
    {
      "key": "effect.layers.flash.seed",
      "type": "integer",
      "default": 31415,
      "unit": "int32",
      "controlGroup": "Flash",
      "exportPath": "settings.effect.layers.flash.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "effect.layers.flash.opacity",
      "type": "number",
      "default": 1,
      "unit": "fraction",
      "controlGroup": "Flash",
      "exportPath": "settings.effect.layers.flash.opacity",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "effect.layers.flash.blend",
      "type": "enum",
      "default": "normal",
      "unit": "mode",
      "controlGroup": "Flash",
      "exportPath": "settings.effect.layers.flash.blend",
      "choices": [
        "normal",
        "add"
      ]
    },
    {
      "key": "anchors.flash.type",
      "type": "enum",
      "default": "world",
      "unit": "mode",
      "controlGroup": "Flash",
      "exportPath": "settings.anchors.flash.type",
      "choices": [
        "world",
        "skeleton",
        "bone",
        "slot",
        "attachment"
      ]
    },
    {
      "key": "anchors.flash.space",
      "type": "enum",
      "default": "world",
      "unit": "mode",
      "controlGroup": "Flash",
      "exportPath": "settings.anchors.flash.space",
      "choices": [
        "world",
        "local"
      ]
    },
    {
      "key": "anchors.flash.x",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Flash",
      "exportPath": "settings.anchors.flash.x",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "anchors.flash.y",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Flash",
      "exportPath": "settings.anchors.flash.y",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "anchors.flash.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Flash",
      "exportPath": "settings.anchors.flash.rotation",
      "min": -360,
      "max": 360,
      "step": 0.1
    },
    {
      "key": "effect.layers.primary.enabled",
      "type": "boolean",
      "default": true,
      "unit": "toggle",
      "controlGroup": "Primary",
      "exportPath": "settings.effect.layers.primary.enabled"
    },
    {
      "key": "effect.layers.primary.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Primary",
      "exportPath": "settings.effect.layers.primary.x",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "effect.layers.primary.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Primary",
      "exportPath": "settings.effect.layers.primary.y",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "effect.layers.primary.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Primary",
      "exportPath": "settings.effect.layers.primary.rotation",
      "min": -360,
      "max": 360,
      "step": 0.1
    },
    {
      "key": "effect.layers.primary.delayFrames",
      "type": "integer",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Primary",
      "exportPath": "settings.effect.layers.primary.delayFrames",
      "min": 0,
      "max": 120,
      "step": 1
    },
    {
      "key": "effect.layers.primary.seed",
      "type": "integer",
      "default": 31416,
      "unit": "int32",
      "controlGroup": "Primary",
      "exportPath": "settings.effect.layers.primary.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "effect.layers.primary.opacity",
      "type": "number",
      "default": 1,
      "unit": "fraction",
      "controlGroup": "Primary",
      "exportPath": "settings.effect.layers.primary.opacity",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "effect.layers.primary.blend",
      "type": "enum",
      "default": "normal",
      "unit": "mode",
      "controlGroup": "Primary",
      "exportPath": "settings.effect.layers.primary.blend",
      "choices": [
        "normal",
        "add"
      ]
    },
    {
      "key": "anchors.primary.type",
      "type": "enum",
      "default": "world",
      "unit": "mode",
      "controlGroup": "Primary",
      "exportPath": "settings.anchors.primary.type",
      "choices": [
        "world",
        "skeleton",
        "bone",
        "slot",
        "attachment"
      ]
    },
    {
      "key": "anchors.primary.space",
      "type": "enum",
      "default": "world",
      "unit": "mode",
      "controlGroup": "Primary",
      "exportPath": "settings.anchors.primary.space",
      "choices": [
        "world",
        "local"
      ]
    },
    {
      "key": "anchors.primary.x",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Primary",
      "exportPath": "settings.anchors.primary.x",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "anchors.primary.y",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Primary",
      "exportPath": "settings.anchors.primary.y",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "anchors.primary.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Primary",
      "exportPath": "settings.anchors.primary.rotation",
      "min": -360,
      "max": 360,
      "step": 0.1
    },
    {
      "key": "effect.layers.dust.enabled",
      "type": "boolean",
      "default": true,
      "unit": "toggle",
      "controlGroup": "Dust",
      "exportPath": "settings.effect.layers.dust.enabled"
    },
    {
      "key": "effect.layers.dust.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Dust",
      "exportPath": "settings.effect.layers.dust.x",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "effect.layers.dust.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Dust",
      "exportPath": "settings.effect.layers.dust.y",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "effect.layers.dust.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Dust",
      "exportPath": "settings.effect.layers.dust.rotation",
      "min": -360,
      "max": 360,
      "step": 0.1
    },
    {
      "key": "effect.layers.dust.delayFrames",
      "type": "integer",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Dust",
      "exportPath": "settings.effect.layers.dust.delayFrames",
      "min": 0,
      "max": 120,
      "step": 1
    },
    {
      "key": "effect.layers.dust.seed",
      "type": "integer",
      "default": 31417,
      "unit": "int32",
      "controlGroup": "Dust",
      "exportPath": "settings.effect.layers.dust.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "effect.layers.dust.opacity",
      "type": "number",
      "default": 1,
      "unit": "fraction",
      "controlGroup": "Dust",
      "exportPath": "settings.effect.layers.dust.opacity",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "effect.layers.dust.blend",
      "type": "enum",
      "default": "normal",
      "unit": "mode",
      "controlGroup": "Dust",
      "exportPath": "settings.effect.layers.dust.blend",
      "choices": [
        "normal",
        "add"
      ]
    },
    {
      "key": "anchors.dust.type",
      "type": "enum",
      "default": "world",
      "unit": "mode",
      "controlGroup": "Dust",
      "exportPath": "settings.anchors.dust.type",
      "choices": [
        "world",
        "skeleton",
        "bone",
        "slot",
        "attachment"
      ]
    },
    {
      "key": "anchors.dust.space",
      "type": "enum",
      "default": "world",
      "unit": "mode",
      "controlGroup": "Dust",
      "exportPath": "settings.anchors.dust.space",
      "choices": [
        "world",
        "local"
      ]
    },
    {
      "key": "anchors.dust.x",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Dust",
      "exportPath": "settings.anchors.dust.x",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "anchors.dust.y",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Dust",
      "exportPath": "settings.anchors.dust.y",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "anchors.dust.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Dust",
      "exportPath": "settings.anchors.dust.rotation",
      "min": -360,
      "max": 360,
      "step": 0.1
    }
  ],
  "controlGroups": [
    "Impact",
    "Temporal spacing",
    "Spatial spacing",
    "Flash",
    "Primary",
    "Dust"
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
      "id": "burstRate",
      "key": "effect.curves.burstRate",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "burstInterval",
      "key": "effect.curves.burstInterval",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "sparkSpeed",
      "key": "effect.curves.sparkSpeed",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "widthTaper",
      "key": "effect.curves.widthTaper",
      "domain": "pathPosition",
      "contract": "curves"
    },
    {
      "id": "alpha",
      "key": "effect.curves.alpha",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "spacingPx",
      "key": "effect.curves.spacingPx",
      "domain": "pathPosition",
      "contract": "curves"
    }
  ],
  "spacing": {
    "contract": "spacing",
    "temporal": "Simultaneous groups or stagger using integrated rate or interval curve, min interval between groups and seeded jitter. Dust delay independent.",
    "spatial": "Transverse logical line sampled by shared arc-distance placement, bounded 512px span, seeded distribution, min/max gap and spacing curve; cyclic reuse if capacity lower than burst count."
  },
  "palettes": [
    {
      "id": "flash-rgba",
      "key": "effect.palettes.flash",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#FFFFFF",
        "#FFC86B"
      ]
    },
    {
      "id": "primary-rgba",
      "key": "effect.palettes.primary",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#FFFFFF",
        "#FFC86B"
      ]
    },
    {
      "id": "dust-rgba",
      "key": "effect.palettes.dust",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#FFFFFF",
        "#FFC86B"
      ]
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "effect.layers.primary.seed",
    "streamPolicy": "Independent flash, primary and dust seeds; separate time/space salts."
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
    "strategy": "Pooled native Pixi Graphics, CPU tests on pinned objects; actual browser GPU acceptance pending."
  },
  "qualityBudgets": {
    "low": {
      "primitives": 211,
      "maxEmitters": 3,
      "maxRibbonVertices": 18
    },
    "balanced": {
      "primitives": 211,
      "maxEmitters": 3,
      "maxRibbonVertices": 18
    },
    "high": {
      "primitives": 211,
      "maxEmitters": 3,
      "maxRibbonVertices": 18
    }
  },
  "tests": {
    "verified": false,
    "evidence": [],
    "required": [
      "Actual WebGL1, WebGL2 and WebGPU phase/layer pixels on dark/light/checker, 40-frame PNG and crop parity",
      "Actual editor controls, drag and Spine animation/skin/attachment fixtures",
      "Both developer examples execute locally with original asset bytes and pinned runtimes; Vite build and architecture suite"
    ]
  },
  "outOfScope": [
    "Actual GPU verification and promotion pending; no runtime pin changes",
    "Quality tier controls not exposed: same hard cap in all tiers",
    "Free-text anchor names/slots not represented by scalar v1 parameter types",
    "Ribbons are authored geometric streaks, not historical motion blur"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "effect.burstCount": "settings.effect.burstCount",
      "effect.spread": "settings.effect.spread",
      "effect.initialSpeed": "settings.effect.initialSpeed",
      "effect.sparkLength": "settings.effect.sparkLength",
      "effect.width": "settings.effect.width",
      "effect.durationFrames": "settings.effect.durationFrames",
      "effect.dustCount": "settings.effect.dustCount",
      "effect.dustDelayFrames": "settings.effect.dustDelayFrames",
      "effect.flashFrames": "settings.effect.flashFrames",
      "effect.flashRadius": "settings.effect.flashRadius",
      "effect.collisionNormal": "settings.effect.collisionNormal",
      "effect.exportFrames": "settings.effect.exportFrames",
      "effect.staggerFrames": "settings.effect.staggerFrames",
      "effect.minInterval": "settings.effect.minInterval",
      "effect.timeJitter": "settings.effect.timeJitter",
      "effect.frequencySource": "settings.effect.frequencySource",
      "effect.gap": "settings.effect.gap",
      "effect.minGap": "settings.effect.minGap",
      "effect.maxGap": "settings.effect.maxGap",
      "effect.spatialJitter": "settings.effect.spatialJitter",
      "effect.spatialMode": "settings.effect.spatialMode",
      "effect.spacingCurveEnabled": "settings.effect.spacingCurveEnabled",
      "effect.layers.flash.enabled": "settings.effect.layers.flash.enabled",
      "effect.layers.flash.x": "settings.effect.layers.flash.x",
      "effect.layers.flash.y": "settings.effect.layers.flash.y",
      "effect.layers.flash.rotation": "settings.effect.layers.flash.rotation",
      "effect.layers.flash.delayFrames": "settings.effect.layers.flash.delayFrames",
      "effect.layers.flash.seed": "settings.effect.layers.flash.seed",
      "effect.layers.flash.opacity": "settings.effect.layers.flash.opacity",
      "effect.layers.flash.blend": "settings.effect.layers.flash.blend",
      "anchors.flash.type": "settings.anchors.flash.type",
      "anchors.flash.space": "settings.anchors.flash.space",
      "anchors.flash.x": "settings.anchors.flash.x",
      "anchors.flash.y": "settings.anchors.flash.y",
      "anchors.flash.rotation": "settings.anchors.flash.rotation",
      "effect.layers.primary.enabled": "settings.effect.layers.primary.enabled",
      "effect.layers.primary.x": "settings.effect.layers.primary.x",
      "effect.layers.primary.y": "settings.effect.layers.primary.y",
      "effect.layers.primary.rotation": "settings.effect.layers.primary.rotation",
      "effect.layers.primary.delayFrames": "settings.effect.layers.primary.delayFrames",
      "effect.layers.primary.seed": "settings.effect.layers.primary.seed",
      "effect.layers.primary.opacity": "settings.effect.layers.primary.opacity",
      "effect.layers.primary.blend": "settings.effect.layers.primary.blend",
      "anchors.primary.type": "settings.anchors.primary.type",
      "anchors.primary.space": "settings.anchors.primary.space",
      "anchors.primary.x": "settings.anchors.primary.x",
      "anchors.primary.y": "settings.anchors.primary.y",
      "anchors.primary.rotation": "settings.anchors.primary.rotation",
      "effect.layers.dust.enabled": "settings.effect.layers.dust.enabled",
      "effect.layers.dust.x": "settings.effect.layers.dust.x",
      "effect.layers.dust.y": "settings.effect.layers.dust.y",
      "effect.layers.dust.rotation": "settings.effect.layers.dust.rotation",
      "effect.layers.dust.delayFrames": "settings.effect.layers.dust.delayFrames",
      "effect.layers.dust.seed": "settings.effect.layers.dust.seed",
      "effect.layers.dust.opacity": "settings.effect.layers.dust.opacity",
      "effect.layers.dust.blend": "settings.effect.layers.dust.blend",
      "anchors.dust.type": "settings.anchors.dust.type",
      "anchors.dust.space": "settings.anchors.dust.space",
      "anchors.dust.x": "settings.anchors.dust.x",
      "anchors.dust.y": "settings.anchors.dust.y",
      "anchors.dust.rotation": "settings.anchors.dust.rotation"
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
    "notes": "H01–H04 candidate exists. Do not recreate. See source/build/test paths above. No full acceptance claim."
  }
}
```
