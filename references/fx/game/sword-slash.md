# GAME-03 — Sword Slash

**Status:** implementation candidate (acceptance pending); machine-readable status stays `specification-only` under the v1 evidence gate. Issue #42.

Build from repository root: `python scripts/build_sword_slash_editor.py --output /tmp/SwordSlash_Lab.html` (output outside repository). Existing implementation lives in `assets/sword-slash/src/` and includes authoring, PNG ZIP and both developer targets. Do not rebuild the effect from scratch. Default 40 frames at 60 FPS; frame 0 and 39 transparent, main and edge visible mid-sweep. Residual glow and sparks default off; turn either on to evaluate that layer. Base width controls multiply the authored width curve; displayed effective widths need not equal the base values.

Authored arc/custom path is shared between layers; recorded mode uses an independently replayed Spine model and ignores authored path/reveal geometry for that layer. Bone/slot/attachment identity and custom cubic points, gradient stops and curve handles are retained in JSON even where v1 scalar metadata cannot represent them. Preview is a 512 logical px plane; export crop is independent. Both developer ZIPs include pinned runtimes, local modules, notices and original source bytes. WebGPU preference may fall back to WebGL and reports the actual backend.

Run `node --test scripts/test_sword_slash_*.cjs` and `python scripts/test_sword_slash_builder.py`. Real acceptance: `python scripts/test_sword_slash_browser.py /tmp/SwordSlash_Lab.html --backend webgl2 --output /tmp/slash-webgl2` (repeat with webgl1 and webgpu, using empty separate output directories). Set `BROWSER_EXECUTABLE` if needed. Run architecture and baseline checks separately. Do not mark verified if real backend, pixel evidence, or exports fail or are NOT RUN.

## Machine-checkable Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.game.sword-slash",
  "effectVersion": "0.1.0",
  "presetSchemaVersion": 1,
  "category": "game",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "Tapered weapon slash ribbon with independent luminous edge and optional residual glow/sparks; 512 logical px, 60 FPS.",
  "phases": [
    {
      "id": "wind-up",
      "at": 0,
      "look": "Default first frame is transparent."
    },
    {
      "id": "sweep",
      "at": 0.3076923076923077,
      "look": "Ribbon and leading edge; optional spark contact."
    },
    {
      "id": "decay",
      "at": 1,
      "look": "Default one-shot is transparent; longer authored durations may require more frames."
    }
  ],
  "layers": [
    {
      "id": "residual",
      "kind": "geometry",
      "position": "behind main",
      "purpose": "Optional wider glow and detached sparks"
    },
    {
      "id": "main",
      "kind": "geometry",
      "position": "middle",
      "purpose": "Tapered continuous ribbon"
    },
    {
      "id": "edge",
      "kind": "geometry",
      "position": "front",
      "purpose": "Thin leading edge"
    }
  ],
  "emitterAnchors": [
    {
      "id": "world",
      "space": "world",
      "onMissing": "hide dependent layer; recorded trajectory breaks"
    },
    {
      "id": "skeleton",
      "space": "local or world",
      "onMissing": "hide dependent layer; recorded trajectory breaks"
    },
    {
      "id": "bone",
      "space": "local or world",
      "onMissing": "hide dependent layer; recorded trajectory breaks"
    },
    {
      "id": "slot",
      "space": "local or world",
      "onMissing": "hide dependent layer; recorded trajectory breaks"
    },
    {
      "id": "attachment",
      "space": "local or world",
      "onMissing": "hide dependent layer; recorded trajectory breaks"
    }
  ],
  "parameters": [
    {
      "key": "effect.arcAngle",
      "type": "number",
      "default": 140,
      "unit": "degrees",
      "controlGroup": "Sweep and width",
      "exportPath": "settings.effect.arcAngle",
      "min": 10,
      "max": 330,
      "step": 1
    },
    {
      "key": "effect.trailLength",
      "type": "number",
      "default": 120,
      "unit": "px",
      "controlGroup": "Sweep and width",
      "exportPath": "settings.effect.trailLength",
      "min": 20,
      "max": 450,
      "step": 0.1
    },
    {
      "key": "effect.startWidth",
      "type": "number",
      "default": 4,
      "unit": "px",
      "controlGroup": "Sweep and width",
      "exportPath": "settings.effect.startWidth",
      "min": 0.5,
      "max": 70,
      "step": 0.1
    },
    {
      "key": "effect.middleWidth",
      "type": "number",
      "default": 35,
      "unit": "px",
      "controlGroup": "Sweep and width",
      "exportPath": "settings.effect.middleWidth",
      "min": 0.5,
      "max": 120,
      "step": 0.1
    },
    {
      "key": "effect.endWidth",
      "type": "number",
      "default": 2,
      "unit": "px",
      "controlGroup": "Sweep and width",
      "exportPath": "settings.effect.endWidth",
      "min": 0.5,
      "max": 70,
      "step": 0.1
    },
    {
      "key": "effect.lifetimeFrames",
      "type": "integer",
      "default": 16,
      "unit": "frames",
      "controlGroup": "Sweep and width",
      "exportPath": "settings.effect.lifetimeFrames",
      "min": 2,
      "max": 90,
      "step": 1
    },
    {
      "key": "effect.edgeGlow",
      "type": "number",
      "default": 0.6,
      "unit": "multiplier",
      "controlGroup": "Sparks and glow",
      "exportPath": "settings.effect.edgeGlow",
      "min": 0,
      "max": 2,
      "step": 0.01
    },
    {
      "key": "effect.sweepFrames",
      "type": "integer",
      "default": 24,
      "unit": "frames",
      "controlGroup": "Timeline",
      "exportPath": "settings.effect.sweepFrames",
      "min": 2,
      "max": 120,
      "step": 1
    },
    {
      "key": "effect.exportFrames",
      "type": "integer",
      "default": 40,
      "unit": "frames",
      "controlGroup": "Timeline",
      "exportPath": "settings.effect.exportFrames",
      "min": 1,
      "max": 3600,
      "step": 1
    },
    {
      "key": "effect.intervalFrames",
      "type": "integer",
      "default": 2,
      "unit": "frames",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.effect.intervalFrames",
      "min": 1,
      "max": 60,
      "step": 1
    },
    {
      "key": "effect.rate",
      "type": "number",
      "default": 30,
      "unit": "events/s",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.effect.rate",
      "min": 0,
      "max": 120,
      "step": 0.1
    },
    {
      "key": "effect.minIntervalFrames",
      "type": "number",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.effect.minIntervalFrames",
      "min": 0,
      "max": 120,
      "step": 0.1
    },
    {
      "key": "effect.timeJitter",
      "type": "number",
      "default": 0,
      "unit": "ratio",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.effect.timeJitter",
      "min": 0,
      "max": 0.45,
      "step": 0.01
    },
    {
      "key": "effect.gap",
      "type": "number",
      "default": 10,
      "unit": "px",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.effect.gap",
      "min": 1,
      "max": 80,
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
      "max": 80,
      "step": 0.1
    },
    {
      "key": "effect.maxGap",
      "type": "number",
      "default": 80,
      "unit": "px",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.effect.maxGap",
      "min": 1,
      "max": 80,
      "step": 0.1
    },
    {
      "key": "effect.spatialJitter",
      "type": "number",
      "default": 0,
      "unit": "ratio",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.effect.spatialJitter",
      "min": 0,
      "max": 0.45,
      "step": 0.01
    },
    {
      "key": "effect.contactFrame",
      "type": "integer",
      "default": 12,
      "unit": "frames",
      "controlGroup": "Sparks and glow",
      "exportPath": "settings.effect.contactFrame",
      "min": 0,
      "max": 119,
      "step": 1
    },
    {
      "key": "effect.sparkCount",
      "type": "integer",
      "default": 12,
      "unit": "count",
      "controlGroup": "Sparks and glow",
      "exportPath": "settings.effect.sparkCount",
      "min": 0,
      "max": 64,
      "step": 1
    },
    {
      "key": "effect.sparkLifetimeFrames",
      "type": "integer",
      "default": 8,
      "unit": "frames",
      "controlGroup": "Sparks and glow",
      "exportPath": "settings.effect.sparkLifetimeFrames",
      "min": 1,
      "max": 90,
      "step": 1
    },
    {
      "key": "effect.sparkSpeed",
      "type": "number",
      "default": 140,
      "unit": "px/s",
      "controlGroup": "Sparks and glow",
      "exportPath": "settings.effect.sparkSpeed",
      "min": 0,
      "max": 900,
      "step": 1
    },
    {
      "key": "effect.pathMode",
      "type": "enum",
      "default": "arc",
      "unit": "choice",
      "controlGroup": "Sweep and width",
      "exportPath": "settings.effect.pathMode",
      "choices": [
        "arc",
        "custom"
      ]
    },
    {
      "key": "effect.triggerMode",
      "type": "enum",
      "default": "time",
      "unit": "choice",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.effect.triggerMode",
      "choices": [
        "time",
        "distance"
      ]
    },
    {
      "key": "effect.frequencySource",
      "type": "enum",
      "default": "interval",
      "unit": "choice",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.effect.frequencySource",
      "choices": [
        "rate",
        "interval"
      ]
    },
    {
      "key": "effect.distribution",
      "type": "enum",
      "default": "even",
      "unit": "choice",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.effect.distribution",
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
      "unit": "boolean",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.effect.spacingCurveEnabled"
    },
    {
      "key": "effect.sparksEnabled",
      "type": "boolean",
      "default": false,
      "unit": "boolean",
      "controlGroup": "Sparks and glow",
      "exportPath": "settings.effect.sparksEnabled"
    },
    {
      "key": "effect.glowEnabled",
      "type": "boolean",
      "default": false,
      "unit": "boolean",
      "controlGroup": "Sparks and glow",
      "exportPath": "settings.effect.glowEnabled"
    },
    {
      "key": "effect.layers.main.enabled",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.main.enabled"
    },
    {
      "key": "effect.layers.main.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.main.x",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "effect.layers.main.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.main.y",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "effect.layers.main.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.main.rotation",
      "min": -360,
      "max": 360,
      "step": 0.1
    },
    {
      "key": "effect.layers.main.delayFrames",
      "type": "integer",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.main.delayFrames",
      "min": 0,
      "max": 120,
      "step": 1
    },
    {
      "key": "effect.layers.main.seed",
      "type": "integer",
      "default": 4109,
      "unit": "seed",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.main.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "effect.layers.main.opacity",
      "type": "number",
      "default": 1,
      "unit": "ratio",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.main.opacity",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "effect.layers.main.blend",
      "type": "enum",
      "default": "normal",
      "unit": "choice",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.main.blend",
      "choices": [
        "normal",
        "add"
      ]
    },
    {
      "key": "anchors.main.type",
      "type": "enum",
      "default": "world",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.anchors.main.type",
      "choices": [
        "world",
        "skeleton",
        "bone",
        "slot",
        "attachment"
      ]
    },
    {
      "key": "anchors.main.space",
      "type": "enum",
      "default": "world",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.anchors.main.space",
      "choices": [
        "world",
        "local"
      ]
    },
    {
      "key": "anchors.main.x",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.anchors.main.x",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "anchors.main.y",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.anchors.main.y",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "anchors.main.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Anchor",
      "exportPath": "settings.anchors.main.rotation",
      "min": -360,
      "max": 360,
      "step": 0.1
    },
    {
      "key": "trajectory.main",
      "type": "enum",
      "default": "authored",
      "unit": "choice",
      "controlGroup": "Trajectory",
      "exportPath": "settings.trajectory.main",
      "choices": [
        "authored",
        "recorded"
      ]
    },
    {
      "key": "effect.layers.edge.enabled",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.edge.enabled"
    },
    {
      "key": "effect.layers.edge.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.edge.x",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "effect.layers.edge.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.edge.y",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "effect.layers.edge.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.edge.rotation",
      "min": -360,
      "max": 360,
      "step": 0.1
    },
    {
      "key": "effect.layers.edge.delayFrames",
      "type": "integer",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.edge.delayFrames",
      "min": 0,
      "max": 120,
      "step": 1
    },
    {
      "key": "effect.layers.edge.seed",
      "type": "integer",
      "default": 4110,
      "unit": "seed",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.edge.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "effect.layers.edge.opacity",
      "type": "number",
      "default": 1,
      "unit": "ratio",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.edge.opacity",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "effect.layers.edge.blend",
      "type": "enum",
      "default": "add",
      "unit": "choice",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.edge.blend",
      "choices": [
        "normal",
        "add"
      ]
    },
    {
      "key": "anchors.edge.type",
      "type": "enum",
      "default": "world",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.anchors.edge.type",
      "choices": [
        "world",
        "skeleton",
        "bone",
        "slot",
        "attachment"
      ]
    },
    {
      "key": "anchors.edge.space",
      "type": "enum",
      "default": "world",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.anchors.edge.space",
      "choices": [
        "world",
        "local"
      ]
    },
    {
      "key": "anchors.edge.x",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.anchors.edge.x",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "anchors.edge.y",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.anchors.edge.y",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "anchors.edge.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Anchor",
      "exportPath": "settings.anchors.edge.rotation",
      "min": -360,
      "max": 360,
      "step": 0.1
    },
    {
      "key": "trajectory.edge",
      "type": "enum",
      "default": "authored",
      "unit": "choice",
      "controlGroup": "Trajectory",
      "exportPath": "settings.trajectory.edge",
      "choices": [
        "authored",
        "recorded"
      ]
    },
    {
      "key": "effect.layers.residual.enabled",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.residual.enabled"
    },
    {
      "key": "effect.layers.residual.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.residual.x",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "effect.layers.residual.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.residual.y",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "effect.layers.residual.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.residual.rotation",
      "min": -360,
      "max": 360,
      "step": 0.1
    },
    {
      "key": "effect.layers.residual.delayFrames",
      "type": "integer",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.residual.delayFrames",
      "min": 0,
      "max": 120,
      "step": 1
    },
    {
      "key": "effect.layers.residual.seed",
      "type": "integer",
      "default": 4111,
      "unit": "seed",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.residual.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "effect.layers.residual.opacity",
      "type": "number",
      "default": 1,
      "unit": "ratio",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.residual.opacity",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "effect.layers.residual.blend",
      "type": "enum",
      "default": "add",
      "unit": "choice",
      "controlGroup": "Layer",
      "exportPath": "settings.effect.layers.residual.blend",
      "choices": [
        "normal",
        "add"
      ]
    },
    {
      "key": "anchors.residual.type",
      "type": "enum",
      "default": "world",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.anchors.residual.type",
      "choices": [
        "world",
        "skeleton",
        "bone",
        "slot",
        "attachment"
      ]
    },
    {
      "key": "anchors.residual.space",
      "type": "enum",
      "default": "world",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.anchors.residual.space",
      "choices": [
        "world",
        "local"
      ]
    },
    {
      "key": "anchors.residual.x",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.anchors.residual.x",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "anchors.residual.y",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.anchors.residual.y",
      "min": -10000,
      "max": 10000,
      "step": 0.1
    },
    {
      "key": "anchors.residual.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Anchor",
      "exportPath": "settings.anchors.residual.rotation",
      "min": -360,
      "max": 360,
      "step": 0.1
    },
    {
      "key": "trajectory.residual",
      "type": "enum",
      "default": "authored",
      "unit": "choice",
      "controlGroup": "Trajectory",
      "exportPath": "settings.trajectory.residual",
      "choices": [
        "authored",
        "recorded"
      ]
    },
    {
      "key": "teleportThreshold",
      "type": "number",
      "default": 128,
      "unit": "px",
      "controlGroup": "Trajectory",
      "exportPath": "settings.teleportThreshold",
      "min": 1,
      "max": 10000,
      "step": 0.1
    }
  ],
  "controlGroups": [
    "Sweep and width",
    "Temporal spacing",
    "Spatial spacing",
    "Sparks and glow",
    "Layer",
    "Anchor",
    "Trajectory",
    "Timeline"
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
      "id": "reveal",
      "key": "effect.curves.reveal",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "width",
      "key": "effect.curves.width",
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
      "id": "rate",
      "key": "effect.curves.rate",
      "domain": "emitterTime",
      "contract": "curves"
    },
    {
      "id": "interval",
      "key": "effect.curves.interval",
      "domain": "emitterTime",
      "contract": "curves"
    },
    {
      "id": "spacing",
      "key": "effect.curves.spacing",
      "domain": "pathPosition",
      "contract": "curves"
    }
  ],
  "spacing": {
    "contract": "spacing",
    "temporal": "Independent integrated rate or interval, min interval and jitter; time or distance trigger.",
    "spatial": "Arc-length gap and placement curve with seeded distribution, independent of time and speed."
  },
  "palettes": [
    {
      "id": "main-rgba",
      "key": "effect.palettes.main",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#FFFFFF",
        "#8EE5FF"
      ]
    },
    {
      "id": "edge-rgba",
      "key": "effect.palettes.edge",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#FFFFFF",
        "#8EE5FF"
      ]
    },
    {
      "id": "residual-rgba",
      "key": "effect.palettes.residual",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#FFFFFF",
        "#8EE5FF"
      ]
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "effect.layers.main.seed",
    "streamPolicy": "Separate per-layer seeds; time, spatial and spark streams."
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
    "strategy": "Native Pixi mesh with premultiplied ramp; independent replay model for recorded paths. Real GPU acceptance pending."
  },
  "qualityBudgets": {
    "low": {
      "maxSectionsPerLayer": 512,
      "maxRibbonsPerLayer": 120,
      "maxSparks": 64,
      "maxLayers": 3
    },
    "balanced": {
      "maxSectionsPerLayer": 512,
      "maxRibbonsPerLayer": 120,
      "maxSparks": 64,
      "maxLayers": 3
    },
    "high": {
      "maxSectionsPerLayer": 512,
      "maxRibbonsPerLayer": 120,
      "maxSparks": 64,
      "maxLayers": 3
    }
  },
  "tests": {
    "verified": false,
    "evidence": [],
    "required": [
      "Actual browser WebGL1/2 and WebGPU or explicit unavailable result; phase, layer, backgrounds, crop, transparent pixels",
      "Real editor controls, independent endpoints, Spine assets and recorded trajectory",
      "40-frame PNG, alpha, zoom invariance, both local developer demos and Vite build; architecture suite"
    ]
  },
  "outOfScope": [
    "Promotion to reference implementation until actual acceptance.",
    "Quality tier selection: same hard limits across tiers.",
    "Custom path control points, anchor names/slots, RGBA stops and curve keys are structured preset fields; v1 scalar metadata cannot describe arbitrary strings/arrays."
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "effect.arcAngle": "settings.effect.arcAngle",
      "effect.trailLength": "settings.effect.trailLength",
      "effect.startWidth": "settings.effect.startWidth",
      "effect.middleWidth": "settings.effect.middleWidth",
      "effect.endWidth": "settings.effect.endWidth",
      "effect.lifetimeFrames": "settings.effect.lifetimeFrames",
      "effect.edgeGlow": "settings.effect.edgeGlow",
      "effect.sweepFrames": "settings.effect.sweepFrames",
      "effect.exportFrames": "settings.effect.exportFrames",
      "effect.intervalFrames": "settings.effect.intervalFrames",
      "effect.rate": "settings.effect.rate",
      "effect.minIntervalFrames": "settings.effect.minIntervalFrames",
      "effect.timeJitter": "settings.effect.timeJitter",
      "effect.gap": "settings.effect.gap",
      "effect.minGap": "settings.effect.minGap",
      "effect.maxGap": "settings.effect.maxGap",
      "effect.spatialJitter": "settings.effect.spatialJitter",
      "effect.contactFrame": "settings.effect.contactFrame",
      "effect.sparkCount": "settings.effect.sparkCount",
      "effect.sparkLifetimeFrames": "settings.effect.sparkLifetimeFrames",
      "effect.sparkSpeed": "settings.effect.sparkSpeed",
      "effect.pathMode": "settings.effect.pathMode",
      "effect.triggerMode": "settings.effect.triggerMode",
      "effect.frequencySource": "settings.effect.frequencySource",
      "effect.distribution": "settings.effect.distribution",
      "effect.spacingCurveEnabled": "settings.effect.spacingCurveEnabled",
      "effect.sparksEnabled": "settings.effect.sparksEnabled",
      "effect.glowEnabled": "settings.effect.glowEnabled",
      "effect.layers.main.enabled": "settings.effect.layers.main.enabled",
      "effect.layers.main.x": "settings.effect.layers.main.x",
      "effect.layers.main.y": "settings.effect.layers.main.y",
      "effect.layers.main.rotation": "settings.effect.layers.main.rotation",
      "effect.layers.main.delayFrames": "settings.effect.layers.main.delayFrames",
      "effect.layers.main.seed": "settings.effect.layers.main.seed",
      "effect.layers.main.opacity": "settings.effect.layers.main.opacity",
      "effect.layers.main.blend": "settings.effect.layers.main.blend",
      "anchors.main.type": "settings.anchors.main.type",
      "anchors.main.space": "settings.anchors.main.space",
      "anchors.main.x": "settings.anchors.main.x",
      "anchors.main.y": "settings.anchors.main.y",
      "anchors.main.rotation": "settings.anchors.main.rotation",
      "trajectory.main": "settings.trajectory.main",
      "effect.layers.edge.enabled": "settings.effect.layers.edge.enabled",
      "effect.layers.edge.x": "settings.effect.layers.edge.x",
      "effect.layers.edge.y": "settings.effect.layers.edge.y",
      "effect.layers.edge.rotation": "settings.effect.layers.edge.rotation",
      "effect.layers.edge.delayFrames": "settings.effect.layers.edge.delayFrames",
      "effect.layers.edge.seed": "settings.effect.layers.edge.seed",
      "effect.layers.edge.opacity": "settings.effect.layers.edge.opacity",
      "effect.layers.edge.blend": "settings.effect.layers.edge.blend",
      "anchors.edge.type": "settings.anchors.edge.type",
      "anchors.edge.space": "settings.anchors.edge.space",
      "anchors.edge.x": "settings.anchors.edge.x",
      "anchors.edge.y": "settings.anchors.edge.y",
      "anchors.edge.rotation": "settings.anchors.edge.rotation",
      "trajectory.edge": "settings.trajectory.edge",
      "effect.layers.residual.enabled": "settings.effect.layers.residual.enabled",
      "effect.layers.residual.x": "settings.effect.layers.residual.x",
      "effect.layers.residual.y": "settings.effect.layers.residual.y",
      "effect.layers.residual.rotation": "settings.effect.layers.residual.rotation",
      "effect.layers.residual.delayFrames": "settings.effect.layers.residual.delayFrames",
      "effect.layers.residual.seed": "settings.effect.layers.residual.seed",
      "effect.layers.residual.opacity": "settings.effect.layers.residual.opacity",
      "effect.layers.residual.blend": "settings.effect.layers.residual.blend",
      "anchors.residual.type": "settings.anchors.residual.type",
      "anchors.residual.space": "settings.anchors.residual.space",
      "anchors.residual.x": "settings.anchors.residual.x",
      "anchors.residual.y": "settings.anchors.residual.y",
      "anchors.residual.rotation": "settings.anchors.residual.rotation",
      "trajectory.residual": "settings.trajectory.residual",
      "teleportThreshold": "settings.teleportThreshold"
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
    "notes": "S01–S04 candidate implemented. Build and test commands above; do not recreate. Pending real acceptance."
  }
}
```
