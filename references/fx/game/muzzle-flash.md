# Muzzle Flash

GAME-01 / #40 — **implementation candidate; GPU acceptance pending**. Source already exists in `assets/muzzle-flash/src/`; do not recreate it from the issue. The v1 registry retains `specification-only` until real browser and developer-package acceptance, as for Magic Shield and Healing Aura.

Build outside the checkout:

    python scripts/build_muzzle_editor.py --output ../MuzzleFlash.html

Run local tests:

    node --test scripts/test_muzzle_*.cjs
    python scripts/test_muzzle_acceptance_checks.py
    python scripts/test_muzzle_browser.py ../MuzzleFlash.html --backend webgl2 --output ../muzzle-evidence-webgl2

Repeat the browser command for webgl1 and webgpu in empty evidence directories. The runner validates actual backend, isolated layer pixels, default ignition/peak/tail, crop parity, 40-frame PNG and camera invariance, sample asset identity and both developer ZIPs. Screenshots still require visual review; actual developer examples and Vite build remain separate checks. Prior exact pinned CPU Pixi Graphics and Spine point/bone/physics regressions passed; GPU contexts were unavailable in the chat VM. Do not claim pixel parity or promotion from CPU/fixture tests.

The default flash lasts six authored frames, the 40-frame export has a transparent tail, smoke is disabled by default. Separate time and arc-distance spacing, independent anchors/offsets and editable gradients are implemented. Layer anchor names/slots are exact free-text fields; core seed is not artist-facing. No quality-tier control exists; the common hard cap is 87 primitives. Current nested settings paths below match the actual preset rather than flattening per-layer data.

## Machine-checkable Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.game.muzzle-flash",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "game",
  "styles": [
    "directional"
  ],
  "visualGoal": "Short directional white-hot flash, tapered tongues, radial sparks and optional expanding smoke. Default 512 logical px, 60 FPS, 40-frame one-shot.",
  "phases": [
    {
      "id": "ignition",
      "at": 0,
      "look": "Bright directional core and tongues immediately visible."
    },
    {
      "id": "peak",
      "at": 0.05128205128205128,
      "look": "Tapered tongues and sparks; flash fades over six authored frames."
    },
    {
      "id": "tail",
      "at": 1,
      "look": "Default one-shot is transparent; longer authored lifetimes may require more export frames."
    }
  ],
  "layers": [
    {
      "id": "smoke",
      "kind": "particles",
      "position": "Behind all FX",
      "purpose": "Optional delayed expanding smoke"
    },
    {
      "id": "tongues",
      "kind": "geometry",
      "position": "Behind core",
      "purpose": "Independent directional tapered tongues"
    },
    {
      "id": "core",
      "kind": "geometry",
      "position": "In front of tongues",
      "purpose": "Bright tapered flash ribbon"
    },
    {
      "id": "sparks",
      "kind": "particles",
      "position": "Front",
      "purpose": "Short-lived seeded spark dots"
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
      "key": "effect.flashLength",
      "type": "number",
      "default": 65,
      "unit": "px",
      "controlGroup": "Flash and spacing",
      "exportPath": "settings.effect.flashLength",
      "min": 8,
      "max": 260,
      "step": 1
    },
    {
      "key": "effect.coneAngle",
      "type": "number",
      "default": 35,
      "unit": "degrees",
      "controlGroup": "Flash and spacing",
      "exportPath": "settings.effect.coneAngle",
      "min": 5,
      "max": 150,
      "step": 1
    },
    {
      "key": "effect.flashWidth",
      "type": "number",
      "default": 20,
      "unit": "px",
      "controlGroup": "Flash and spacing",
      "exportPath": "settings.effect.flashWidth",
      "min": 2,
      "max": 100,
      "step": 1
    },
    {
      "key": "effect.flashDuration",
      "type": "integer",
      "default": 6,
      "unit": "frames",
      "controlGroup": "Flash and spacing",
      "exportPath": "settings.effect.flashDuration",
      "min": 1,
      "max": 24,
      "step": 1
    },
    {
      "key": "effect.tongueCount",
      "type": "integer",
      "default": 5,
      "unit": "count",
      "controlGroup": "Flash and spacing",
      "exportPath": "settings.effect.tongueCount",
      "min": 1,
      "max": 20,
      "step": 1
    },
    {
      "key": "effect.sparkCount",
      "type": "integer",
      "default": 8,
      "unit": "count",
      "controlGroup": "Flash and spacing",
      "exportPath": "settings.effect.sparkCount",
      "min": 0,
      "max": 50,
      "step": 1
    },
    {
      "key": "effect.sparkLifeFrames",
      "type": "integer",
      "default": 6,
      "unit": "frames",
      "controlGroup": "Flash and spacing",
      "exportPath": "settings.effect.sparkLifeFrames",
      "min": 1,
      "max": 60,
      "step": 1
    },
    {
      "key": "effect.sparkSpeed",
      "type": "number",
      "default": 180,
      "unit": "px/s",
      "controlGroup": "Flash and spacing",
      "exportPath": "settings.effect.sparkSpeed",
      "min": 0,
      "max": 10000,
      "step": 1
    },
    {
      "key": "effect.burstFrames",
      "type": "integer",
      "default": 2,
      "unit": "frames",
      "controlGroup": "Flash and spacing",
      "exportPath": "settings.effect.burstFrames",
      "min": 1,
      "max": 24,
      "step": 1
    },
    {
      "key": "effect.minInterval",
      "type": "number",
      "default": 0,
      "unit": "seconds",
      "controlGroup": "Flash and spacing",
      "exportPath": "settings.effect.minInterval",
      "min": 0,
      "max": 1,
      "step": 0.001
    },
    {
      "key": "effect.timeJitter",
      "type": "number",
      "default": 0,
      "unit": "fraction",
      "controlGroup": "Flash and spacing",
      "exportPath": "settings.effect.timeJitter",
      "min": 0,
      "max": 0.45,
      "step": 0.01
    },
    {
      "key": "effect.tongueGap",
      "type": "number",
      "default": 7,
      "unit": "px",
      "controlGroup": "Flash and spacing",
      "exportPath": "settings.effect.tongueGap",
      "min": 1,
      "max": 30,
      "step": 0.1
    },
    {
      "key": "effect.minGap",
      "type": "number",
      "default": 1,
      "unit": "px",
      "controlGroup": "Flash and spacing",
      "exportPath": "settings.effect.minGap",
      "min": 1,
      "max": 30,
      "step": 0.1
    },
    {
      "key": "effect.maxGap",
      "type": "number",
      "default": 30,
      "unit": "px",
      "controlGroup": "Flash and spacing",
      "exportPath": "settings.effect.maxGap",
      "min": 1,
      "max": 30,
      "step": 0.1
    },
    {
      "key": "effect.spatialJitter",
      "type": "number",
      "default": 0,
      "unit": "fraction",
      "controlGroup": "Flash and spacing",
      "exportPath": "settings.effect.spatialJitter",
      "min": 0,
      "max": 0.45,
      "step": 0.01
    },
    {
      "key": "effect.exportFrames",
      "type": "integer",
      "default": 40,
      "unit": "frames",
      "controlGroup": "Flash and spacing",
      "exportPath": "settings.effect.exportFrames",
      "min": 1,
      "max": 3600,
      "step": 1
    },
    {
      "key": "effect.rateCurveEnabled",
      "type": "boolean",
      "default": false,
      "unit": "toggle",
      "controlGroup": "Flash and spacing",
      "exportPath": "settings.effect.rateCurveEnabled"
    },
    {
      "key": "effect.spacingCurveEnabled",
      "type": "boolean",
      "default": false,
      "unit": "toggle",
      "controlGroup": "Flash and spacing",
      "exportPath": "settings.effect.spacingCurveEnabled"
    },
    {
      "key": "effect.spatialMode",
      "type": "enum",
      "default": "even",
      "unit": "mode",
      "controlGroup": "Flash and spacing",
      "exportPath": "settings.effect.spatialMode",
      "choices": [
        "even",
        "random",
        "stratified",
        "clustered"
      ]
    },
    {
      "key": "effect.layers.core.enabled",
      "type": "boolean",
      "default": true,
      "unit": "toggle",
      "controlGroup": "Core",
      "exportPath": "settings.effect.layers.core.enabled"
    },
    {
      "key": "effect.layers.core.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Core",
      "exportPath": "settings.effect.layers.core.x",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "effect.layers.core.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Core",
      "exportPath": "settings.effect.layers.core.y",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "effect.layers.core.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Core",
      "exportPath": "settings.effect.layers.core.rotation",
      "min": -360,
      "max": 360,
      "step": 0.1
    },
    {
      "key": "effect.layers.core.delayFrames",
      "type": "integer",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Core",
      "exportPath": "settings.effect.layers.core.delayFrames",
      "min": 0,
      "max": 60,
      "step": 1
    },
    {
      "key": "effect.layers.core.opacity",
      "type": "number",
      "default": 1,
      "unit": "fraction",
      "controlGroup": "Core",
      "exportPath": "settings.effect.layers.core.opacity",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "blends.core",
      "type": "enum",
      "default": "normal",
      "unit": "mode",
      "controlGroup": "Core",
      "exportPath": "settings.blends.core",
      "choices": [
        "normal",
        "add"
      ]
    },
    {
      "key": "anchors.core.type",
      "type": "enum",
      "default": "world",
      "unit": "mode",
      "controlGroup": "Core",
      "exportPath": "settings.anchors.core.type",
      "choices": [
        "world",
        "skeleton",
        "bone",
        "slot",
        "attachment"
      ]
    },
    {
      "key": "anchors.core.space",
      "type": "enum",
      "default": "world",
      "unit": "mode",
      "controlGroup": "Core",
      "exportPath": "settings.anchors.core.space",
      "choices": [
        "world",
        "local"
      ]
    },
    {
      "key": "anchors.core.x",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Core",
      "exportPath": "settings.anchors.core.x",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "anchors.core.y",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Core",
      "exportPath": "settings.anchors.core.y",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "anchors.core.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Core",
      "exportPath": "settings.anchors.core.rotation",
      "min": -360,
      "max": 360,
      "step": 0.1
    },
    {
      "key": "effect.layers.tongues.enabled",
      "type": "boolean",
      "default": true,
      "unit": "toggle",
      "controlGroup": "Tongues",
      "exportPath": "settings.effect.layers.tongues.enabled"
    },
    {
      "key": "effect.layers.tongues.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Tongues",
      "exportPath": "settings.effect.layers.tongues.x",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "effect.layers.tongues.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Tongues",
      "exportPath": "settings.effect.layers.tongues.y",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "effect.layers.tongues.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Tongues",
      "exportPath": "settings.effect.layers.tongues.rotation",
      "min": -360,
      "max": 360,
      "step": 0.1
    },
    {
      "key": "effect.layers.tongues.delayFrames",
      "type": "integer",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Tongues",
      "exportPath": "settings.effect.layers.tongues.delayFrames",
      "min": 0,
      "max": 60,
      "step": 1
    },
    {
      "key": "effect.layers.tongues.opacity",
      "type": "number",
      "default": 1,
      "unit": "fraction",
      "controlGroup": "Tongues",
      "exportPath": "settings.effect.layers.tongues.opacity",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "effect.layers.tongues.seed",
      "type": "integer",
      "default": 31416,
      "unit": "int32",
      "controlGroup": "Tongues",
      "exportPath": "settings.effect.layers.tongues.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "blends.tongues",
      "type": "enum",
      "default": "normal",
      "unit": "mode",
      "controlGroup": "Tongues",
      "exportPath": "settings.blends.tongues",
      "choices": [
        "normal",
        "add"
      ]
    },
    {
      "key": "anchors.tongues.type",
      "type": "enum",
      "default": "world",
      "unit": "mode",
      "controlGroup": "Tongues",
      "exportPath": "settings.anchors.tongues.type",
      "choices": [
        "world",
        "skeleton",
        "bone",
        "slot",
        "attachment"
      ]
    },
    {
      "key": "anchors.tongues.space",
      "type": "enum",
      "default": "world",
      "unit": "mode",
      "controlGroup": "Tongues",
      "exportPath": "settings.anchors.tongues.space",
      "choices": [
        "world",
        "local"
      ]
    },
    {
      "key": "anchors.tongues.x",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Tongues",
      "exportPath": "settings.anchors.tongues.x",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "anchors.tongues.y",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Tongues",
      "exportPath": "settings.anchors.tongues.y",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "anchors.tongues.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Tongues",
      "exportPath": "settings.anchors.tongues.rotation",
      "min": -360,
      "max": 360,
      "step": 0.1
    },
    {
      "key": "effect.layers.sparks.enabled",
      "type": "boolean",
      "default": true,
      "unit": "toggle",
      "controlGroup": "Sparks",
      "exportPath": "settings.effect.layers.sparks.enabled"
    },
    {
      "key": "effect.layers.sparks.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Sparks",
      "exportPath": "settings.effect.layers.sparks.x",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "effect.layers.sparks.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Sparks",
      "exportPath": "settings.effect.layers.sparks.y",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "effect.layers.sparks.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Sparks",
      "exportPath": "settings.effect.layers.sparks.rotation",
      "min": -360,
      "max": 360,
      "step": 0.1
    },
    {
      "key": "effect.layers.sparks.delayFrames",
      "type": "integer",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Sparks",
      "exportPath": "settings.effect.layers.sparks.delayFrames",
      "min": 0,
      "max": 60,
      "step": 1
    },
    {
      "key": "effect.layers.sparks.opacity",
      "type": "number",
      "default": 1,
      "unit": "fraction",
      "controlGroup": "Sparks",
      "exportPath": "settings.effect.layers.sparks.opacity",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "effect.layers.sparks.seed",
      "type": "integer",
      "default": 31417,
      "unit": "int32",
      "controlGroup": "Sparks",
      "exportPath": "settings.effect.layers.sparks.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "blends.sparks",
      "type": "enum",
      "default": "normal",
      "unit": "mode",
      "controlGroup": "Sparks",
      "exportPath": "settings.blends.sparks",
      "choices": [
        "normal",
        "add"
      ]
    },
    {
      "key": "anchors.sparks.type",
      "type": "enum",
      "default": "world",
      "unit": "mode",
      "controlGroup": "Sparks",
      "exportPath": "settings.anchors.sparks.type",
      "choices": [
        "world",
        "skeleton",
        "bone",
        "slot",
        "attachment"
      ]
    },
    {
      "key": "anchors.sparks.space",
      "type": "enum",
      "default": "world",
      "unit": "mode",
      "controlGroup": "Sparks",
      "exportPath": "settings.anchors.sparks.space",
      "choices": [
        "world",
        "local"
      ]
    },
    {
      "key": "anchors.sparks.x",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Sparks",
      "exportPath": "settings.anchors.sparks.x",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "anchors.sparks.y",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Sparks",
      "exportPath": "settings.anchors.sparks.y",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "anchors.sparks.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Sparks",
      "exportPath": "settings.anchors.sparks.rotation",
      "min": -360,
      "max": 360,
      "step": 0.1
    },
    {
      "key": "smoke.enabled",
      "type": "boolean",
      "default": false,
      "unit": "toggle",
      "controlGroup": "Smoke",
      "exportPath": "settings.smoke.enabled"
    },
    {
      "key": "smoke.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Smoke",
      "exportPath": "settings.smoke.x",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "smoke.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Smoke",
      "exportPath": "settings.smoke.y",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "smoke.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Smoke",
      "exportPath": "settings.smoke.rotation",
      "min": -360,
      "max": 360,
      "step": 0.1
    },
    {
      "key": "smoke.delayFrames",
      "type": "integer",
      "default": 2,
      "unit": "frames",
      "controlGroup": "Smoke",
      "exportPath": "settings.smoke.delayFrames",
      "min": 0,
      "max": 60,
      "step": 1
    },
    {
      "key": "smoke.opacity",
      "type": "number",
      "default": 0.35,
      "unit": "fraction",
      "controlGroup": "Smoke",
      "exportPath": "settings.smoke.opacity",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "smoke.seed",
      "type": "integer",
      "default": 31418,
      "unit": "int32",
      "controlGroup": "Smoke",
      "exportPath": "settings.smoke.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "blends.smoke",
      "type": "enum",
      "default": "normal",
      "unit": "mode",
      "controlGroup": "Smoke",
      "exportPath": "settings.blends.smoke",
      "choices": [
        "normal",
        "add"
      ]
    },
    {
      "key": "smokeAnchor.type",
      "type": "enum",
      "default": "world",
      "unit": "mode",
      "controlGroup": "Smoke",
      "exportPath": "settings.smokeAnchor.type",
      "choices": [
        "world",
        "skeleton",
        "bone",
        "slot",
        "attachment"
      ]
    },
    {
      "key": "smokeAnchor.space",
      "type": "enum",
      "default": "world",
      "unit": "mode",
      "controlGroup": "Smoke",
      "exportPath": "settings.smokeAnchor.space",
      "choices": [
        "world",
        "local"
      ]
    },
    {
      "key": "smokeAnchor.x",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Smoke",
      "exportPath": "settings.smokeAnchor.x",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "smokeAnchor.y",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Smoke",
      "exportPath": "settings.smokeAnchor.y",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "smokeAnchor.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Smoke",
      "exportPath": "settings.smokeAnchor.rotation",
      "min": -360,
      "max": 360,
      "step": 0.1
    },
    {
      "key": "smoke.count",
      "type": "integer",
      "default": 4,
      "unit": "count",
      "controlGroup": "Smoke",
      "exportPath": "settings.smoke.count",
      "min": 0,
      "max": 16,
      "step": 1
    },
    {
      "key": "smoke.spreadFrames",
      "type": "integer",
      "default": 4,
      "unit": "frames",
      "controlGroup": "Smoke",
      "exportPath": "settings.smoke.spreadFrames",
      "min": 0,
      "max": 24,
      "step": 1
    },
    {
      "key": "smoke.lifeFrames",
      "type": "integer",
      "default": 18,
      "unit": "frames",
      "controlGroup": "Smoke",
      "exportPath": "settings.smoke.lifeFrames",
      "min": 1,
      "max": 120,
      "step": 1
    },
    {
      "key": "smoke.speed",
      "type": "number",
      "default": 65,
      "unit": "px/s",
      "controlGroup": "Smoke",
      "exportPath": "settings.smoke.speed",
      "min": 0,
      "max": 1000,
      "step": 1
    },
    {
      "key": "smoke.radius",
      "type": "number",
      "default": 7,
      "unit": "px",
      "controlGroup": "Smoke",
      "exportPath": "settings.smoke.radius",
      "min": 1,
      "max": 100,
      "step": 0.1
    },
    {
      "key": "smoke.growth",
      "type": "number",
      "default": 2,
      "unit": "multiplier",
      "controlGroup": "Smoke",
      "exportPath": "settings.smoke.growth",
      "min": 1,
      "max": 4,
      "step": 0.1
    }
  ],
  "controlGroups": [
    "Flash and spacing",
    "Core",
    "Tongues",
    "Sparks",
    "Smoke"
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
      "id": "flashAlpha",
      "key": "effect.curves.flashAlpha",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "flashWidth",
      "key": "effect.curves.flashWidth",
      "domain": "pathPosition",
      "contract": "curves"
    },
    {
      "id": "sparkSpeed",
      "key": "effect.curves.sparkSpeed",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "emissionRate",
      "key": "effect.curves.emissionRate",
      "domain": "emitterTime",
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
    "temporal": "Independent seeded burst schedule, min interval and rate curve; seconds, not playback speed.",
    "spatial": "Independent tongue arc distance gap, jitter and gap curve; even/random/stratified/clustered."
  },
  "palettes": [
    {
      "id": "flash-rgba",
      "key": "effect.palette",
      "contract": "colors",
      "domain": "effectTime",
      "defaultStops": [
        "#FFF9D8",
        "#FFBB59"
      ]
    },
    {
      "id": "spark-rgba",
      "key": "effect.sparkPalette",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#FFF9D8",
        "#FFBB59"
      ]
    },
    {
      "id": "smoke-rgba",
      "key": "smoke.palette",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#A59687",
        "#918880",
        "#646469"
      ]
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "effect.layers.sparks.seed",
    "streamPolicy": "Independent tongue, spark and smoke seeds. Core geometry has no effective seed control."
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
    "strategy": "Candidate pooled native Pixi Graphics; actual CPU objects tested. Actual GPU and browser acceptance pending."
  },
  "qualityBudgets": {
    "low": {
      "primitives": 87,
      "maxEmitters": 4
    },
    "balanced": {
      "primitives": 87,
      "maxEmitters": 4
    },
    "high": {
      "primitives": 87,
      "maxEmitters": 4
    }
  },
  "tests": {
    "verified": false,
    "evidence": [],
    "required": [
      "Actual WebGL1, WebGL2 and WebGPU visual output, phase and layer checks on dark/light/checker, transparent PNG sequence and crop parity",
      "Actual editor interaction, Spine sample and physics/anchor fixtures, same-backend camera invariance",
      "Both developer examples execute locally with original asset bytes and pinned runtimes; Vite build and architecture suite"
    ]
  },
  "outOfScope": [
    "Continuous weapon firing loop; default is a one-shot",
    "Physical-device performance certification and other runtime versions",
    "Quality presets are not exposed: all three budget labels describe the same hard 87-primitive cap",
    "Anchor name and slot are free text, not represented by v1 scalar parameter types; nested settings and per-layer seeds require a future verified evidence-report adapter before promotion"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "effect.flashLength": "settings.effect.flashLength",
      "effect.coneAngle": "settings.effect.coneAngle",
      "effect.flashWidth": "settings.effect.flashWidth",
      "effect.flashDuration": "settings.effect.flashDuration",
      "effect.tongueCount": "settings.effect.tongueCount",
      "effect.sparkCount": "settings.effect.sparkCount",
      "effect.sparkLifeFrames": "settings.effect.sparkLifeFrames",
      "effect.sparkSpeed": "settings.effect.sparkSpeed",
      "effect.burstFrames": "settings.effect.burstFrames",
      "effect.minInterval": "settings.effect.minInterval",
      "effect.timeJitter": "settings.effect.timeJitter",
      "effect.tongueGap": "settings.effect.tongueGap",
      "effect.minGap": "settings.effect.minGap",
      "effect.maxGap": "settings.effect.maxGap",
      "effect.spatialJitter": "settings.effect.spatialJitter",
      "effect.exportFrames": "settings.effect.exportFrames",
      "effect.rateCurveEnabled": "settings.effect.rateCurveEnabled",
      "effect.spacingCurveEnabled": "settings.effect.spacingCurveEnabled",
      "effect.spatialMode": "settings.effect.spatialMode",
      "effect.layers.core.enabled": "settings.effect.layers.core.enabled",
      "effect.layers.core.x": "settings.effect.layers.core.x",
      "effect.layers.core.y": "settings.effect.layers.core.y",
      "effect.layers.core.rotation": "settings.effect.layers.core.rotation",
      "effect.layers.core.delayFrames": "settings.effect.layers.core.delayFrames",
      "effect.layers.core.opacity": "settings.effect.layers.core.opacity",
      "blends.core": "settings.blends.core",
      "anchors.core.type": "settings.anchors.core.type",
      "anchors.core.space": "settings.anchors.core.space",
      "anchors.core.x": "settings.anchors.core.x",
      "anchors.core.y": "settings.anchors.core.y",
      "anchors.core.rotation": "settings.anchors.core.rotation",
      "effect.layers.tongues.enabled": "settings.effect.layers.tongues.enabled",
      "effect.layers.tongues.x": "settings.effect.layers.tongues.x",
      "effect.layers.tongues.y": "settings.effect.layers.tongues.y",
      "effect.layers.tongues.rotation": "settings.effect.layers.tongues.rotation",
      "effect.layers.tongues.delayFrames": "settings.effect.layers.tongues.delayFrames",
      "effect.layers.tongues.opacity": "settings.effect.layers.tongues.opacity",
      "effect.layers.tongues.seed": "settings.effect.layers.tongues.seed",
      "blends.tongues": "settings.blends.tongues",
      "anchors.tongues.type": "settings.anchors.tongues.type",
      "anchors.tongues.space": "settings.anchors.tongues.space",
      "anchors.tongues.x": "settings.anchors.tongues.x",
      "anchors.tongues.y": "settings.anchors.tongues.y",
      "anchors.tongues.rotation": "settings.anchors.tongues.rotation",
      "effect.layers.sparks.enabled": "settings.effect.layers.sparks.enabled",
      "effect.layers.sparks.x": "settings.effect.layers.sparks.x",
      "effect.layers.sparks.y": "settings.effect.layers.sparks.y",
      "effect.layers.sparks.rotation": "settings.effect.layers.sparks.rotation",
      "effect.layers.sparks.delayFrames": "settings.effect.layers.sparks.delayFrames",
      "effect.layers.sparks.opacity": "settings.effect.layers.sparks.opacity",
      "effect.layers.sparks.seed": "settings.effect.layers.sparks.seed",
      "blends.sparks": "settings.blends.sparks",
      "anchors.sparks.type": "settings.anchors.sparks.type",
      "anchors.sparks.space": "settings.anchors.sparks.space",
      "anchors.sparks.x": "settings.anchors.sparks.x",
      "anchors.sparks.y": "settings.anchors.sparks.y",
      "anchors.sparks.rotation": "settings.anchors.sparks.rotation",
      "smoke.enabled": "settings.smoke.enabled",
      "smoke.x": "settings.smoke.x",
      "smoke.y": "settings.smoke.y",
      "smoke.rotation": "settings.smoke.rotation",
      "smoke.delayFrames": "settings.smoke.delayFrames",
      "smoke.opacity": "settings.smoke.opacity",
      "smoke.seed": "settings.smoke.seed",
      "blends.smoke": "settings.blends.smoke",
      "smokeAnchor.type": "settings.smokeAnchor.type",
      "smokeAnchor.space": "settings.smokeAnchor.space",
      "smokeAnchor.x": "settings.smokeAnchor.x",
      "smokeAnchor.y": "settings.smokeAnchor.y",
      "smokeAnchor.rotation": "settings.smokeAnchor.rotation",
      "smoke.count": "settings.smoke.count",
      "smoke.spreadFrames": "settings.smoke.spreadFrames",
      "smoke.lifeFrames": "settings.smoke.lifeFrames",
      "smoke.speed": "settings.smoke.speed",
      "smoke.radius": "settings.smoke.radius",
      "smoke.growth": "settings.smoke.growth"
    },
    "preview": "not-implemented",
    "pngBake": "not-implemented",
    "developerZip": "not-implemented",
    "invariant": "Candidate source is documented above. v1 registry status is deliberately not promoted; actual browser and developer-build evidence remains required."
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject"
  },
  "implementation": {
    "status": "specification-only",
    "sourceFiles": [],
    "notes": "Candidate exists; do not recreate. v1 registry has no intermediate lifecycle. Source and runner paths are documented above, but no full acceptance claim."
  }
}
```
