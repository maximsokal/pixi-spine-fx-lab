# GAME-04 — Energy Projectile

**Status:** implementation candidate; v1 machine-readable status `specification-only` until actual acceptance. Issue #43.

Build `python scripts/build_energy_editor.py --output /tmp/EnergyProjectile_Lab.html` outside the repo. Source: `assets/energy-projectile/src/`. Default one-shot: 40 frames at 60 FPS; flightLoop closes the cubic path and derives actual speed/duration from integer frame count. The current Spine pose transforms the authored trajectory; no historical bone trail. Independent origin/head markers and 1–4 emitter rows. All controls, cubic points, curves, palettes and anchor identity persist in JSON; scalar metadata below describes the default emitter row. The preview camera is independent of signed PNG crop. Both developer archives include local pinned libraries, original assets and the same session; preview can report fallback, PNG must use the exact actual backend.

Run `node --test scripts/test_energy_*.cjs`, `python scripts/test_energy_builder.py`, `python scripts/test_energy_acceptance_checks.py`. Real acceptance: `python scripts/test_energy_browser.py /tmp/EnergyProjectile_Lab.html --backend webgl2 --output /tmp/energy-gl2` (repeat webgl1/webgpu with separate empty directories). GPU, Vite builds and architecture require separate evidence; do not mark verified on CPU-only tests.

## Machine-checkable Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.game.energy-projectile",
  "effectVersion": "0.1.0",
  "presetSchemaVersion": 1,
  "category": "game",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "Pulsing cyan-white energy projectile with tapered arc-length ribbon and orbit particles, 512 logical px at 60 FPS.",
  "phases": [
    {
      "id": "charge",
      "at": 0,
      "look": "Default first frame transparent."
    },
    {
      "id": "flight",
      "at": 0.5,
      "look": "Bright moving core, tapered trail and orbit particles."
    },
    {
      "id": "fade",
      "at": 1,
      "look": "Default last frame transparent; flightLoop repeats canonical cycle."
    }
  ],
  "layers": [
    {
      "id": "ribbon",
      "kind": "geometry",
      "position": "behind",
      "purpose": "Arc-length tapered mesh and trail particles"
    },
    {
      "id": "orbit",
      "kind": "particles",
      "position": "front",
      "purpose": "Independent orbit pulses"
    },
    {
      "id": "core",
      "kind": "geometry",
      "position": "front",
      "purpose": "Bright core and radial glow"
    }
  ],
  "emitterAnchors": [
    {
      "id": "world",
      "space": "world",
      "onMissing": "Hide dependent layer only; no stale position."
    },
    {
      "id": "skeleton",
      "space": "local or world",
      "onMissing": "Hide dependent layer only; no stale position."
    },
    {
      "id": "bone",
      "space": "local or world",
      "onMissing": "Hide dependent layer only; no stale position."
    },
    {
      "id": "slot",
      "space": "local or world",
      "onMissing": "Hide dependent layer only; no stale position."
    },
    {
      "id": "attachment",
      "space": "local or world",
      "onMissing": "Hide dependent layer only; no stale position."
    },
    {
      "id": "inherit",
      "space": "emitter-relative",
      "onMissing": "Hide dependent layer if emitter anchor missing."
    }
  ],
  "parameters": [
    {
      "key": "smoothing",
      "type": "number",
      "default": 1,
      "unit": "ratio",
      "controlGroup": "Motion",
      "exportPath": "settings.smoothing",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "durationFrames",
      "type": "integer",
      "default": 40,
      "unit": "frames",
      "controlGroup": "Timeline",
      "exportPath": "settings.durationFrames",
      "min": 6,
      "max": 3600,
      "step": 1
    },
    {
      "key": "chargeFrames",
      "type": "integer",
      "default": 4,
      "unit": "frames",
      "controlGroup": "Timeline",
      "exportPath": "settings.chargeFrames",
      "min": 0,
      "max": 120,
      "step": 1
    },
    {
      "key": "fadeFrames",
      "type": "integer",
      "default": 6,
      "unit": "frames",
      "controlGroup": "Timeline",
      "exportPath": "settings.fadeFrames",
      "min": 1,
      "max": 120,
      "step": 1
    },
    {
      "key": "coreRadius",
      "type": "number",
      "default": 20,
      "unit": "px",
      "controlGroup": "Motion",
      "exportPath": "settings.coreRadius",
      "min": 3,
      "max": 100,
      "step": 0.01
    },
    {
      "key": "travelSpeed",
      "type": "number",
      "default": 260,
      "unit": "px/s",
      "controlGroup": "Motion",
      "exportPath": "settings.travelSpeed",
      "min": 0,
      "max": 1200,
      "step": 0.01
    },
    {
      "key": "tailLength",
      "type": "number",
      "default": 95,
      "unit": "px",
      "controlGroup": "Motion",
      "exportPath": "settings.tailLength",
      "min": 0,
      "max": 320,
      "step": 0.01
    },
    {
      "key": "trailGap",
      "type": "number",
      "default": 7,
      "unit": "px",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.trailGap",
      "min": 1,
      "max": 80,
      "step": 0.01
    },
    {
      "key": "glow",
      "type": "number",
      "default": 0.7,
      "unit": "ratio",
      "controlGroup": "Motion",
      "exportPath": "settings.glow",
      "min": 0,
      "max": 2,
      "step": 0.01
    },
    {
      "key": "particleRate",
      "type": "number",
      "default": 18,
      "unit": "events/s",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.particleRate",
      "min": 0,
      "max": 160,
      "step": 0.01
    },
    {
      "key": "trailRate",
      "type": "number",
      "default": 18,
      "unit": "events/s",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.trailRate",
      "min": 0,
      "max": 160,
      "step": 0.01
    },
    {
      "key": "orbitGap",
      "type": "number",
      "default": 14,
      "unit": "px",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.orbitGap",
      "min": 1,
      "max": 80,
      "step": 0.01
    },
    {
      "key": "orbitPulseHz",
      "type": "number",
      "default": 2,
      "unit": "Hz",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.orbitPulseHz",
      "min": 0,
      "max": 20,
      "step": 0.01
    },
    {
      "key": "orbitLifeFrames",
      "type": "integer",
      "default": 24,
      "unit": "frames",
      "controlGroup": "Motion",
      "exportPath": "settings.orbitLifeFrames",
      "min": 1,
      "max": 120,
      "step": 1
    },
    {
      "key": "trailLifeFrames",
      "type": "integer",
      "default": 18,
      "unit": "frames",
      "controlGroup": "Motion",
      "exportPath": "settings.trailLifeFrames",
      "min": 1,
      "max": 120,
      "step": 1
    },
    {
      "key": "particleSize",
      "type": "number",
      "default": 2,
      "unit": "px",
      "controlGroup": "Motion",
      "exportPath": "settings.particleSize",
      "min": 0.25,
      "max": 20,
      "step": 0.01
    },
    {
      "key": "trailWidth",
      "type": "number",
      "default": 24,
      "unit": "px",
      "controlGroup": "Motion",
      "exportPath": "settings.trailWidth",
      "min": 0,
      "max": 200,
      "step": 0.01
    },
    {
      "key": "intervalFrames",
      "type": "number",
      "default": 3.3333333333333335,
      "unit": "frames",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.intervalFrames",
      "min": 0.25,
      "max": 600,
      "step": 0.01
    },
    {
      "key": "minIntervalFrames",
      "type": "number",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.minIntervalFrames",
      "min": 0,
      "max": 120,
      "step": 0.01
    },
    {
      "key": "timeJitter",
      "type": "number",
      "default": 0,
      "unit": "ratio",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.timeJitter",
      "min": 0,
      "max": 0.45,
      "step": 0.01
    },
    {
      "key": "burstCount",
      "type": "integer",
      "default": 1,
      "unit": "count",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.burstCount",
      "min": 1,
      "max": 16,
      "step": 1
    },
    {
      "key": "burstDelayFrames",
      "type": "number",
      "default": 1,
      "unit": "frames",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.burstDelayFrames",
      "min": 0.25,
      "max": 60,
      "step": 0.01
    },
    {
      "key": "minGap",
      "type": "number",
      "default": 1,
      "unit": "px",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.minGap",
      "min": 1,
      "max": 80,
      "step": 0.01
    },
    {
      "key": "maxGap",
      "type": "number",
      "default": 80,
      "unit": "px",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.maxGap",
      "min": 1,
      "max": 80,
      "step": 0.01
    },
    {
      "key": "spatialJitter",
      "type": "number",
      "default": 0,
      "unit": "ratio",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.spatialJitter",
      "min": 0,
      "max": 0.45,
      "step": 0.01
    },
    {
      "key": "mode",
      "type": "enum",
      "default": "oneShot",
      "unit": "choice",
      "controlGroup": "Timeline",
      "exportPath": "settings.mode",
      "choices": [
        "oneShot",
        "flightLoop"
      ]
    },
    {
      "key": "quality",
      "type": "enum",
      "default": "balanced",
      "unit": "choice",
      "controlGroup": "Motion",
      "exportPath": "settings.quality",
      "choices": [
        "low",
        "balanced",
        "high"
      ]
    },
    {
      "key": "frequencySource",
      "type": "enum",
      "default": "rate",
      "unit": "choice",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.frequencySource",
      "choices": [
        "rate",
        "interval"
      ]
    },
    {
      "key": "emissionMode",
      "type": "enum",
      "default": "time",
      "unit": "choice",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.emissionMode",
      "choices": [
        "time",
        "distance",
        "both"
      ]
    },
    {
      "key": "distribution",
      "type": "enum",
      "default": "even",
      "unit": "choice",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.distribution",
      "choices": [
        "even",
        "random",
        "stratified",
        "clustered"
      ]
    },
    {
      "key": "spacingCurveEnabled",
      "type": "boolean",
      "default": false,
      "unit": "boolean",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.spacingCurveEnabled"
    },
    {
      "key": "trajectory.closed",
      "type": "boolean",
      "default": false,
      "unit": "boolean",
      "controlGroup": "Trajectory",
      "exportPath": "settings.trajectory.closed"
    },
    {
      "key": "emitters.0.enabled",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.enabled"
    },
    {
      "key": "emitters.0.anchor.type",
      "type": "enum",
      "default": "world",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.anchor.type",
      "choices": [
        "world",
        "skeleton",
        "bone",
        "slot",
        "attachment"
      ]
    },
    {
      "key": "emitters.0.anchor.space",
      "type": "enum",
      "default": "world",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.anchor.space",
      "choices": [
        "world",
        "local"
      ]
    },
    {
      "key": "emitters.0.anchor.x",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.anchor.x",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.anchor.y",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.anchor.y",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.anchor.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.anchor.rotation",
      "min": -360,
      "max": 360,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.core.enabled",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.core.enabled"
    },
    {
      "key": "emitters.0.layers.core.visible",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.core.visible"
    },
    {
      "key": "emitters.0.layers.core.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.core.x",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.core.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.core.y",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.core.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.core.rotation",
      "min": -360,
      "max": 360,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.core.delayFrames",
      "type": "integer",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.core.delayFrames",
      "min": 0,
      "max": 120,
      "step": 1
    },
    {
      "key": "emitters.0.layers.core.seed",
      "type": "integer",
      "default": 4109,
      "unit": "seed",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.core.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "emitters.0.layers.core.opacity",
      "type": "number",
      "default": 1,
      "unit": "ratio",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.core.opacity",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.core.blend",
      "type": "enum",
      "default": "add",
      "unit": "choice",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.core.blend",
      "choices": [
        "normal",
        "add"
      ]
    },
    {
      "key": "emitters.0.layers.core.order",
      "type": "enum",
      "default": "front",
      "unit": "choice",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.core.order",
      "choices": [
        "behind",
        "front"
      ]
    },
    {
      "key": "emitters.0.layers.core.anchor.type",
      "type": "enum",
      "default": "inherit",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.core.anchor.type",
      "choices": [
        "inherit",
        "world",
        "skeleton",
        "bone",
        "slot",
        "attachment"
      ]
    },
    {
      "key": "emitters.0.layers.core.anchor.space",
      "type": "enum",
      "default": "world",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.core.anchor.space",
      "choices": [
        "world",
        "local"
      ]
    },
    {
      "key": "emitters.0.layers.core.anchor.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.core.anchor.x",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.core.anchor.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.core.anchor.y",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.core.anchor.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.core.anchor.rotation",
      "min": -360,
      "max": 360,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.ribbon.enabled",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.ribbon.enabled"
    },
    {
      "key": "emitters.0.layers.ribbon.visible",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.ribbon.visible"
    },
    {
      "key": "emitters.0.layers.ribbon.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.ribbon.x",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.ribbon.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.ribbon.y",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.ribbon.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.ribbon.rotation",
      "min": -360,
      "max": 360,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.ribbon.delayFrames",
      "type": "integer",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.ribbon.delayFrames",
      "min": 0,
      "max": 120,
      "step": 1
    },
    {
      "key": "emitters.0.layers.ribbon.seed",
      "type": "integer",
      "default": 4110,
      "unit": "seed",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.ribbon.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "emitters.0.layers.ribbon.opacity",
      "type": "number",
      "default": 1,
      "unit": "ratio",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.ribbon.opacity",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.ribbon.blend",
      "type": "enum",
      "default": "normal",
      "unit": "choice",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.ribbon.blend",
      "choices": [
        "normal",
        "add"
      ]
    },
    {
      "key": "emitters.0.layers.ribbon.order",
      "type": "enum",
      "default": "behind",
      "unit": "choice",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.ribbon.order",
      "choices": [
        "behind",
        "front"
      ]
    },
    {
      "key": "emitters.0.layers.ribbon.anchor.type",
      "type": "enum",
      "default": "inherit",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.ribbon.anchor.type",
      "choices": [
        "inherit",
        "world",
        "skeleton",
        "bone",
        "slot",
        "attachment"
      ]
    },
    {
      "key": "emitters.0.layers.ribbon.anchor.space",
      "type": "enum",
      "default": "world",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.ribbon.anchor.space",
      "choices": [
        "world",
        "local"
      ]
    },
    {
      "key": "emitters.0.layers.ribbon.anchor.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.ribbon.anchor.x",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.ribbon.anchor.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.ribbon.anchor.y",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.ribbon.anchor.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.ribbon.anchor.rotation",
      "min": -360,
      "max": 360,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.orbit.enabled",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.orbit.enabled"
    },
    {
      "key": "emitters.0.layers.orbit.visible",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.orbit.visible"
    },
    {
      "key": "emitters.0.layers.orbit.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.orbit.x",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.orbit.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.orbit.y",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.orbit.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.orbit.rotation",
      "min": -360,
      "max": 360,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.orbit.delayFrames",
      "type": "integer",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.orbit.delayFrames",
      "min": 0,
      "max": 120,
      "step": 1
    },
    {
      "key": "emitters.0.layers.orbit.seed",
      "type": "integer",
      "default": 4111,
      "unit": "seed",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.orbit.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "emitters.0.layers.orbit.opacity",
      "type": "number",
      "default": 1,
      "unit": "ratio",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.orbit.opacity",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.orbit.blend",
      "type": "enum",
      "default": "add",
      "unit": "choice",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.orbit.blend",
      "choices": [
        "normal",
        "add"
      ]
    },
    {
      "key": "emitters.0.layers.orbit.order",
      "type": "enum",
      "default": "front",
      "unit": "choice",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.orbit.order",
      "choices": [
        "behind",
        "front"
      ]
    },
    {
      "key": "emitters.0.layers.orbit.anchor.type",
      "type": "enum",
      "default": "inherit",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.orbit.anchor.type",
      "choices": [
        "inherit",
        "world",
        "skeleton",
        "bone",
        "slot",
        "attachment"
      ]
    },
    {
      "key": "emitters.0.layers.orbit.anchor.space",
      "type": "enum",
      "default": "world",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.orbit.anchor.space",
      "choices": [
        "world",
        "local"
      ]
    },
    {
      "key": "emitters.0.layers.orbit.anchor.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.orbit.anchor.x",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.orbit.anchor.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.orbit.anchor.y",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.orbit.anchor.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.orbit.anchor.rotation",
      "min": -360,
      "max": 360,
      "step": 0.01
    }
  ],
  "controlGroups": [
    "Motion",
    "Timeline",
    "Temporal spacing",
    "Spatial spacing",
    "Layer",
    "Anchor",
    "Trajectory"
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
      "id": "pulse",
      "key": "curves.pulse",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "width",
      "key": "curves.width",
      "domain": "pathPosition",
      "contract": "curves"
    },
    {
      "id": "alpha",
      "key": "curves.alpha",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "rate",
      "key": "curves.rate",
      "domain": "emitterTime",
      "contract": "curves"
    },
    {
      "id": "interval",
      "key": "curves.interval",
      "domain": "emitterTime",
      "contract": "curves"
    },
    {
      "id": "spacing",
      "key": "curves.spacing",
      "domain": "pathPosition",
      "contract": "curves"
    }
  ],
  "spacing": {
    "contract": "spacing",
    "temporal": "Independent rate or interval, burst, jitter, min interval; time, distance or both.",
    "spatial": "Arc length and independent trail/orbit gap, spacing curve and seeded distribution."
  },
  "palettes": [
    {
      "id": "core-rgba",
      "key": "palettes.core",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#DDFDFF",
        "#35BEFF",
        "#4565F7"
      ]
    },
    {
      "id": "ribbon-rgba",
      "key": "palettes.ribbon",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#DDFDFF",
        "#35BEFF",
        "#4565F7"
      ]
    },
    {
      "id": "orbit-rgba",
      "key": "palettes.orbit",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#DDFDFF",
        "#35BEFF",
        "#4565F7"
      ]
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "emitters.0.layers.core.seed",
    "streamPolicy": "Independent emitter/layer seeds; deterministic time, spacing and orbit."
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
    "strategy": "Pooled Pixi Mesh/Sprite, PMA ramp and radial masks, current Spine pose; strict actual backend for PNG, explicit preview fallback. GPU acceptance pending."
  },
  "qualityBudgets": {
    "low": {
      "maxPrimitives": 256,
      "maxEvents": 4096,
      "maxVertices": 8192,
      "maxEmitters": 4
    },
    "balanced": {
      "maxPrimitives": 1024,
      "maxEvents": 4096,
      "maxVertices": 8192,
      "maxEmitters": 4
    },
    "high": {
      "maxPrimitives": 2048,
      "maxEvents": 4096,
      "maxVertices": 8192,
      "maxEmitters": 4
    }
  },
  "tests": {
    "verified": false,
    "evidence": [],
    "required": [
      "Actual backend phases, dark/light/checker backgrounds, isolated layers, rapid turn and stopped trail; independent RGBA and crop checks",
      "Parameter and marker changes, deterministic curves and events, Spine animation/skin and missing attachment; JSON roundtrip",
      "40-frame sequence or canonical loop, both offline demos, Vite builds, architecture checks"
    ]
  },
  "outOfScope": [
    "Promotion before real acceptance.",
    "Historical Spine path and slot-interleaved draw order.",
    "v1 metadata enumerates the default emitter; arbitrary emitter rows, names, cubic control points, curve keys and RGBA stops remain structured preset fields."
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "smoothing": "settings.smoothing",
      "durationFrames": "settings.durationFrames",
      "chargeFrames": "settings.chargeFrames",
      "fadeFrames": "settings.fadeFrames",
      "coreRadius": "settings.coreRadius",
      "travelSpeed": "settings.travelSpeed",
      "tailLength": "settings.tailLength",
      "trailGap": "settings.trailGap",
      "glow": "settings.glow",
      "particleRate": "settings.particleRate",
      "trailRate": "settings.trailRate",
      "orbitGap": "settings.orbitGap",
      "orbitPulseHz": "settings.orbitPulseHz",
      "orbitLifeFrames": "settings.orbitLifeFrames",
      "trailLifeFrames": "settings.trailLifeFrames",
      "particleSize": "settings.particleSize",
      "trailWidth": "settings.trailWidth",
      "intervalFrames": "settings.intervalFrames",
      "minIntervalFrames": "settings.minIntervalFrames",
      "timeJitter": "settings.timeJitter",
      "burstCount": "settings.burstCount",
      "burstDelayFrames": "settings.burstDelayFrames",
      "minGap": "settings.minGap",
      "maxGap": "settings.maxGap",
      "spatialJitter": "settings.spatialJitter",
      "mode": "settings.mode",
      "quality": "settings.quality",
      "frequencySource": "settings.frequencySource",
      "emissionMode": "settings.emissionMode",
      "distribution": "settings.distribution",
      "spacingCurveEnabled": "settings.spacingCurveEnabled",
      "trajectory.closed": "settings.trajectory.closed",
      "emitters.0.enabled": "settings.emitters.0.enabled",
      "emitters.0.anchor.type": "settings.emitters.0.anchor.type",
      "emitters.0.anchor.space": "settings.emitters.0.anchor.space",
      "emitters.0.anchor.x": "settings.emitters.0.anchor.x",
      "emitters.0.anchor.y": "settings.emitters.0.anchor.y",
      "emitters.0.anchor.rotation": "settings.emitters.0.anchor.rotation",
      "emitters.0.layers.core.enabled": "settings.emitters.0.layers.core.enabled",
      "emitters.0.layers.core.visible": "settings.emitters.0.layers.core.visible",
      "emitters.0.layers.core.x": "settings.emitters.0.layers.core.x",
      "emitters.0.layers.core.y": "settings.emitters.0.layers.core.y",
      "emitters.0.layers.core.rotation": "settings.emitters.0.layers.core.rotation",
      "emitters.0.layers.core.delayFrames": "settings.emitters.0.layers.core.delayFrames",
      "emitters.0.layers.core.seed": "settings.emitters.0.layers.core.seed",
      "emitters.0.layers.core.opacity": "settings.emitters.0.layers.core.opacity",
      "emitters.0.layers.core.blend": "settings.emitters.0.layers.core.blend",
      "emitters.0.layers.core.order": "settings.emitters.0.layers.core.order",
      "emitters.0.layers.core.anchor.type": "settings.emitters.0.layers.core.anchor.type",
      "emitters.0.layers.core.anchor.space": "settings.emitters.0.layers.core.anchor.space",
      "emitters.0.layers.core.anchor.x": "settings.emitters.0.layers.core.anchor.x",
      "emitters.0.layers.core.anchor.y": "settings.emitters.0.layers.core.anchor.y",
      "emitters.0.layers.core.anchor.rotation": "settings.emitters.0.layers.core.anchor.rotation",
      "emitters.0.layers.ribbon.enabled": "settings.emitters.0.layers.ribbon.enabled",
      "emitters.0.layers.ribbon.visible": "settings.emitters.0.layers.ribbon.visible",
      "emitters.0.layers.ribbon.x": "settings.emitters.0.layers.ribbon.x",
      "emitters.0.layers.ribbon.y": "settings.emitters.0.layers.ribbon.y",
      "emitters.0.layers.ribbon.rotation": "settings.emitters.0.layers.ribbon.rotation",
      "emitters.0.layers.ribbon.delayFrames": "settings.emitters.0.layers.ribbon.delayFrames",
      "emitters.0.layers.ribbon.seed": "settings.emitters.0.layers.ribbon.seed",
      "emitters.0.layers.ribbon.opacity": "settings.emitters.0.layers.ribbon.opacity",
      "emitters.0.layers.ribbon.blend": "settings.emitters.0.layers.ribbon.blend",
      "emitters.0.layers.ribbon.order": "settings.emitters.0.layers.ribbon.order",
      "emitters.0.layers.ribbon.anchor.type": "settings.emitters.0.layers.ribbon.anchor.type",
      "emitters.0.layers.ribbon.anchor.space": "settings.emitters.0.layers.ribbon.anchor.space",
      "emitters.0.layers.ribbon.anchor.x": "settings.emitters.0.layers.ribbon.anchor.x",
      "emitters.0.layers.ribbon.anchor.y": "settings.emitters.0.layers.ribbon.anchor.y",
      "emitters.0.layers.ribbon.anchor.rotation": "settings.emitters.0.layers.ribbon.anchor.rotation",
      "emitters.0.layers.orbit.enabled": "settings.emitters.0.layers.orbit.enabled",
      "emitters.0.layers.orbit.visible": "settings.emitters.0.layers.orbit.visible",
      "emitters.0.layers.orbit.x": "settings.emitters.0.layers.orbit.x",
      "emitters.0.layers.orbit.y": "settings.emitters.0.layers.orbit.y",
      "emitters.0.layers.orbit.rotation": "settings.emitters.0.layers.orbit.rotation",
      "emitters.0.layers.orbit.delayFrames": "settings.emitters.0.layers.orbit.delayFrames",
      "emitters.0.layers.orbit.seed": "settings.emitters.0.layers.orbit.seed",
      "emitters.0.layers.orbit.opacity": "settings.emitters.0.layers.orbit.opacity",
      "emitters.0.layers.orbit.blend": "settings.emitters.0.layers.orbit.blend",
      "emitters.0.layers.orbit.order": "settings.emitters.0.layers.orbit.order",
      "emitters.0.layers.orbit.anchor.type": "settings.emitters.0.layers.orbit.anchor.type",
      "emitters.0.layers.orbit.anchor.space": "settings.emitters.0.layers.orbit.anchor.space",
      "emitters.0.layers.orbit.anchor.x": "settings.emitters.0.layers.orbit.anchor.x",
      "emitters.0.layers.orbit.anchor.y": "settings.emitters.0.layers.orbit.anchor.y",
      "emitters.0.layers.orbit.anchor.rotation": "settings.emitters.0.layers.orbit.anchor.rotation"
    },
    "preview": "not-implemented",
    "pngBake": "not-implemented",
    "developerZip": "not-implemented",
    "invariant": "Candidate source exists; v1 lifecycle gate forbids claiming accepted exports until evidence passes."
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject"
  },
  "implementation": {
    "status": "specification-only",
    "sourceFiles": [],
    "notes": "E01–E04 candidate implemented; build existing source, do not recreate. E05 acceptance pending."
  }
}
```
