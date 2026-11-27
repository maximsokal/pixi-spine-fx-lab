# ELEC-02 — Chain Lightning

**Status:** implementation candidate; v1 machine-readable status `specification-only` until real acceptance. Issue #38.

Build `python scripts/build_chain_lightning_editor.py --output /tmp/ChainLightning_Lab.html` outside the repository. Source: `assets/chain-lightning/src/`. The offline standalone editor uses pinned PixiJS 8.22.0 and Spine 4.2.120. Default 40 frames at 60 FPS, separate source plus four ordered destinations (2–8 targets), first contact at frame 2, default last contact at frame 17. No automatic loop. Add/remove/reorder targets using their stable IDs; selected target and layer offsets, independent anchor type/space, conditional name/slot fields, per-target delay/seed and layer switches. Target count is the length of the `targets` array, not a second scalar. Metadata below describes row zero as an example; other rows retain their own values. Palette alpha and curve keys/handles are preserved in presets. Missing anchors suppress incident links without bridging, resolved destinations retain local glow. Coincident targets produce no ribbon. The effect ends at the last authored frame, while extended PNG exports preserve absolute Spine time. PNG uses the actual preview backend and a signed logical crop independent of camera; developer ZIP targets preserve original Spine bytes, ordered targets and runtime pins.

Run `node scripts/test_chain_lightning_blueprint.cjs`, `node --test scripts/test_chain_lightning_*.cjs`, `python scripts/test_chain_lightning_builder.py`, `python scripts/test_blueprints.py`, and `python scripts/test_fx_backlog.py`. Real GPU/browser, offline demo launch, Vite and architecture acceptance remain open. Do not promote status on CPU-only evidence.

## Machine-checkable Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.ice.chain-lightning",
  "effectVersion": "0.1.0",
  "presetSchemaVersion": 1,
  "category": "ice",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "Ordered seeded electrical arcs jump from a source through 2–8 current-pose targets, with independent branches/sparks and impact glow. 512 logical px, 60 FPS, one-shot.",
  "phases": [
    {
      "id": "start",
      "at": 0,
      "look": "Transparent; first contact is scheduled at frame 2."
    },
    {
      "id": "chain",
      "at": 0.5,
      "look": "Ordered contacts, tapered arcs and independently controlled target-local glow and branches."
    },
    {
      "id": "fade",
      "at": 1,
      "look": "Transparent final authored frame; no implicit loop."
    }
  ],
  "layers": [
    {
      "id": "arcs",
      "kind": "geometry",
      "position": "front",
      "purpose": "Tapered seeded link ribbons"
    },
    {
      "id": "branches",
      "kind": "geometry",
      "position": "front",
      "purpose": "Independent fork ribbons and pooled spark discs"
    },
    {
      "id": "glow",
      "kind": "particles",
      "position": "behind",
      "purpose": "Target-local soft PMA glow"
    }
  ],
  "emitterAnchors": [
    {
      "id": "world",
      "space": "world",
      "onMissing": "Suppress incident links and unresolved local visuals; no bridging or stale position."
    },
    {
      "id": "skeleton",
      "space": "local or world",
      "onMissing": "Suppress incident links and unresolved local visuals; no bridging or stale position."
    },
    {
      "id": "bone",
      "space": "local or world",
      "onMissing": "Suppress incident links and unresolved local visuals; no bridging or stale position."
    },
    {
      "id": "slot",
      "space": "local or world",
      "onMissing": "Suppress incident links and unresolved local visuals; no bridging or stale position."
    },
    {
      "id": "attachment",
      "space": "local or world",
      "onMissing": "Suppress incident links and unresolved local visuals; no bridging or stale position."
    }
  ],
  "parameters": [
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
      "key": "fadeFrames",
      "type": "integer",
      "default": 8,
      "unit": "frames",
      "controlGroup": "Timeline",
      "exportPath": "settings.fadeFrames",
      "min": 1,
      "max": 120,
      "step": 1
    },
    {
      "key": "arcWidth",
      "type": "number",
      "default": 4,
      "unit": "px",
      "controlGroup": "Geometry",
      "exportPath": "settings.arcWidth",
      "min": 1,
      "max": 24,
      "step": 0.01
    },
    {
      "key": "jumpDelay",
      "type": "number",
      "default": 5,
      "unit": "frames",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.jumpDelay",
      "min": 0,
      "max": 40,
      "step": 0.01
    },
    {
      "key": "arcGap",
      "type": "number",
      "default": 12,
      "unit": "px",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.arcGap",
      "min": 2,
      "max": 90,
      "step": 0.01
    },
    {
      "key": "branchSpread",
      "type": "number",
      "default": 25,
      "unit": "degrees",
      "controlGroup": "Geometry",
      "exportPath": "settings.branchSpread",
      "min": 0,
      "max": 160,
      "step": 0.01
    },
    {
      "key": "jitter",
      "type": "number",
      "default": 0.45,
      "unit": "ratio",
      "controlGroup": "Geometry",
      "exportPath": "settings.jitter",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "smoothness",
      "type": "number",
      "default": 0.2,
      "unit": "ratio",
      "controlGroup": "Geometry",
      "exportPath": "settings.smoothness",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "arcLifeFrames",
      "type": "integer",
      "default": 10,
      "unit": "frames",
      "controlGroup": "Geometry",
      "exportPath": "settings.arcLifeFrames",
      "min": 1,
      "max": 120,
      "step": 1
    },
    {
      "key": "branchLifeFrames",
      "type": "integer",
      "default": 12,
      "unit": "frames",
      "controlGroup": "Geometry",
      "exportPath": "settings.branchLifeFrames",
      "min": 1,
      "max": 120,
      "step": 1
    },
    {
      "key": "glowLifeFrames",
      "type": "integer",
      "default": 14,
      "unit": "frames",
      "controlGroup": "Geometry",
      "exportPath": "settings.glowLifeFrames",
      "min": 1,
      "max": 120,
      "step": 1
    },
    {
      "key": "branchCount",
      "type": "integer",
      "default": 2,
      "unit": "count",
      "controlGroup": "Geometry",
      "exportPath": "settings.branchCount",
      "min": 0,
      "max": 4,
      "step": 1
    },
    {
      "key": "branchLength",
      "type": "number",
      "default": 25,
      "unit": "px",
      "controlGroup": "Geometry",
      "exportPath": "settings.branchLength",
      "min": 2,
      "max": 80,
      "step": 0.01
    },
    {
      "key": "branchWidthRatio",
      "type": "number",
      "default": 0.45,
      "unit": "ratio",
      "controlGroup": "Geometry",
      "exportPath": "settings.branchWidthRatio",
      "min": 0.1,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "sparkGap",
      "type": "number",
      "default": 30,
      "unit": "px",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.sparkGap",
      "min": 15,
      "max": 100,
      "step": 0.01
    },
    {
      "key": "sparkSize",
      "type": "number",
      "default": 2,
      "unit": "px",
      "controlGroup": "Geometry",
      "exportPath": "settings.sparkSize",
      "min": 0.25,
      "max": 15,
      "step": 0.01
    },
    {
      "key": "sparkSpeed",
      "type": "number",
      "default": 65,
      "unit": "px/s",
      "controlGroup": "Geometry",
      "exportPath": "settings.sparkSpeed",
      "min": 0,
      "max": 500,
      "step": 0.01
    },
    {
      "key": "glowRadius",
      "type": "number",
      "default": 18,
      "unit": "px",
      "controlGroup": "Geometry",
      "exportPath": "settings.glowRadius",
      "min": 2,
      "max": 100,
      "step": 0.01
    },
    {
      "key": "glowStrength",
      "type": "number",
      "default": 1,
      "unit": "ratio",
      "controlGroup": "Geometry",
      "exportPath": "settings.glowStrength",
      "min": 0,
      "max": 2,
      "step": 0.01
    },
    {
      "key": "restrikeRate",
      "type": "number",
      "default": 12,
      "unit": "events/s",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.restrikeRate",
      "min": 0,
      "max": 120,
      "step": 0.01
    },
    {
      "key": "intervalFrames",
      "type": "number",
      "default": 5,
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
      "default": 1,
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
      "default": 0.25,
      "unit": "ratio",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.timeJitter",
      "min": 0,
      "max": 0.45,
      "step": 0.01
    },
    {
      "key": "minGap",
      "type": "number",
      "default": 2,
      "unit": "px",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.minGap",
      "min": 2,
      "max": 90,
      "step": 0.01
    },
    {
      "key": "maxGap",
      "type": "number",
      "default": 90,
      "unit": "px",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.maxGap",
      "min": 2,
      "max": 90,
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
      "key": "quality",
      "type": "enum",
      "default": "balanced",
      "unit": "choice",
      "controlGroup": "Geometry",
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
      "key": "restrikes",
      "type": "boolean",
      "default": false,
      "unit": "boolean",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.restrikes"
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
      "key": "source.type",
      "type": "enum",
      "default": "world",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.source.type",
      "choices": [
        "world",
        "skeleton",
        "bone",
        "slot",
        "attachment"
      ]
    },
    {
      "key": "source.space",
      "type": "enum",
      "default": "world",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.source.space",
      "choices": [
        "world",
        "local"
      ]
    },
    {
      "key": "source.x",
      "type": "number",
      "default": 64,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.source.x",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "source.y",
      "type": "number",
      "default": 256,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.source.y",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "source.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Anchor",
      "exportPath": "settings.source.rotation",
      "min": -360,
      "max": 360,
      "step": 0.01
    },
    {
      "key": "targets.0.anchor.type",
      "type": "enum",
      "default": "world",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.targets.0.anchor.type",
      "choices": [
        "world",
        "skeleton",
        "bone",
        "slot",
        "attachment"
      ]
    },
    {
      "key": "targets.0.anchor.space",
      "type": "enum",
      "default": "world",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.targets.0.anchor.space",
      "choices": [
        "world",
        "local"
      ]
    },
    {
      "key": "targets.0.anchor.x",
      "type": "number",
      "default": 144,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.targets.0.anchor.x",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "targets.0.anchor.y",
      "type": "number",
      "default": 192,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.targets.0.anchor.y",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "targets.0.anchor.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Anchor",
      "exportPath": "settings.targets.0.anchor.rotation",
      "min": -360,
      "max": 360,
      "step": 0.01
    },
    {
      "key": "targets.0.enabled",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Target",
      "exportPath": "settings.targets.0.enabled"
    },
    {
      "key": "targets.0.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Target",
      "exportPath": "settings.targets.0.x",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "targets.0.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Target",
      "exportPath": "settings.targets.0.y",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "targets.0.delayFrames",
      "type": "integer",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Target",
      "exportPath": "settings.targets.0.delayFrames",
      "min": 0,
      "max": 120,
      "step": 1
    },
    {
      "key": "targets.0.seed",
      "type": "integer",
      "default": 4109,
      "unit": "seed",
      "controlGroup": "Target",
      "exportPath": "settings.targets.0.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "targets.0.layers.arcs.enabled",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.arcs.enabled"
    },
    {
      "key": "targets.0.layers.arcs.visible",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.arcs.visible"
    },
    {
      "key": "targets.0.layers.arcs.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.arcs.x",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "targets.0.layers.arcs.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.arcs.y",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "targets.0.layers.arcs.delayFrames",
      "type": "integer",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.arcs.delayFrames",
      "min": 0,
      "max": 120,
      "step": 1
    },
    {
      "key": "targets.0.layers.arcs.seed",
      "type": "integer",
      "default": 4109,
      "unit": "seed",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.arcs.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "targets.0.layers.arcs.opacity",
      "type": "number",
      "default": 1,
      "unit": "ratio",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.arcs.opacity",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "targets.0.layers.arcs.blend",
      "type": "enum",
      "default": "add",
      "unit": "choice",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.arcs.blend",
      "choices": [
        "normal",
        "add"
      ]
    },
    {
      "key": "targets.0.layers.arcs.order",
      "type": "enum",
      "default": "front",
      "unit": "choice",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.arcs.order",
      "choices": [
        "behind",
        "front"
      ]
    },
    {
      "key": "targets.0.layers.branches.enabled",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.branches.enabled"
    },
    {
      "key": "targets.0.layers.branches.visible",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.branches.visible"
    },
    {
      "key": "targets.0.layers.branches.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.branches.x",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "targets.0.layers.branches.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.branches.y",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "targets.0.layers.branches.delayFrames",
      "type": "integer",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.branches.delayFrames",
      "min": 0,
      "max": 120,
      "step": 1
    },
    {
      "key": "targets.0.layers.branches.seed",
      "type": "integer",
      "default": 4110,
      "unit": "seed",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.branches.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "targets.0.layers.branches.opacity",
      "type": "number",
      "default": 1,
      "unit": "ratio",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.branches.opacity",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "targets.0.layers.branches.blend",
      "type": "enum",
      "default": "add",
      "unit": "choice",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.branches.blend",
      "choices": [
        "normal",
        "add"
      ]
    },
    {
      "key": "targets.0.layers.branches.order",
      "type": "enum",
      "default": "front",
      "unit": "choice",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.branches.order",
      "choices": [
        "behind",
        "front"
      ]
    },
    {
      "key": "targets.0.layers.glow.enabled",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.glow.enabled"
    },
    {
      "key": "targets.0.layers.glow.visible",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.glow.visible"
    },
    {
      "key": "targets.0.layers.glow.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.glow.x",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "targets.0.layers.glow.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.glow.y",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "targets.0.layers.glow.delayFrames",
      "type": "integer",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.glow.delayFrames",
      "min": 0,
      "max": 120,
      "step": 1
    },
    {
      "key": "targets.0.layers.glow.seed",
      "type": "integer",
      "default": 4111,
      "unit": "seed",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.glow.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "targets.0.layers.glow.opacity",
      "type": "number",
      "default": 1,
      "unit": "ratio",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.glow.opacity",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "targets.0.layers.glow.blend",
      "type": "enum",
      "default": "add",
      "unit": "choice",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.glow.blend",
      "choices": [
        "normal",
        "add"
      ]
    },
    {
      "key": "targets.0.layers.glow.order",
      "type": "enum",
      "default": "behind",
      "unit": "choice",
      "controlGroup": "Layer",
      "exportPath": "settings.targets.0.layers.glow.order",
      "choices": [
        "behind",
        "front"
      ]
    }
  ],
  "controlGroups": [
    "Geometry",
    "Timeline",
    "Temporal spacing",
    "Spatial spacing",
    "Target",
    "Layer",
    "Anchor"
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
      "id": "jump",
      "key": "curves.jump",
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
      "id": "glow",
      "key": "curves.glow",
      "domain": "emitterTime",
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
    },
    {
      "id": "alpha",
      "key": "curves.alpha",
      "domain": "particleAge",
      "contract": "curves"
    }
  ],
  "spacing": {
    "contract": "spacing",
    "temporal": "Jump timing at 2 + jumpDelay × (targetCount−1) × normalized jump curve plus target delay; separate layer delay and seeded optional restrike rate/interval.",
    "spatial": "Cubic arc-length ribbon gap, independent impact spark gap, branch placement curve and seeded spatial jitter."
  },
  "palettes": [
    {
      "id": "arcs-rgba",
      "key": "palettes.arcs",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#F4FBFF",
        "#66BFFF",
        "#6856F6"
      ]
    },
    {
      "id": "branches-rgba",
      "key": "palettes.branches",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#F4FBFF",
        "#66BFFF",
        "#6856F6"
      ]
    },
    {
      "id": "glow-rgba",
      "key": "palettes.glow",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#F4FBFF",
        "#66BFFF",
        "#6856F6"
      ]
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "targets.0.seed",
    "streamPolicy": "Stable directed edge identity, independent target/layer/event salts, no global Math.random."
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
    "strategy": "Fixed-capacity native Pixi MeshGeometry and pooled PMA discs; current Spine pose; exact-backend isolated tiled PNG bake; preview fallback explicit. Real GPU acceptance pending."
  },
  "qualityBudgets": {
    "low": {
      "maxPrimitives": 256,
      "maxEvents": 4096,
      "maxVertices": 8192,
      "maxEmitters": 8,
      "maxLinkPx": 1024
    },
    "balanced": {
      "maxPrimitives": 1024,
      "maxEvents": 4096,
      "maxVertices": 8192,
      "maxEmitters": 8,
      "maxLinkPx": 1024
    },
    "high": {
      "maxPrimitives": 2048,
      "maxEvents": 4096,
      "maxVertices": 8192,
      "maxEmitters": 8,
      "maxLinkPx": 1024
    }
  },
  "tests": {
    "verified": false,
    "evidence": [],
    "required": [
      "Real WebGL1/WebGL2/WebGPU start/peak/end, light/dark/checker and transparent RGBA; backend fallback reported.",
      "Ordered targets, independent layers, current-pose anchors, missing/coincident/over-cap links, numeric timing/spacing and deterministic seeks.",
      "40-frame PNG, signed crop, same-backend camera invariance, both developer ZIP demos and Vite, architecture checks."
    ]
  },
  "outOfScope": [
    "No promotion before real acceptance.",
    "No automatic loop, electrical physics, nearest-neighbor rerouting or historic poses.",
    "Scalar metadata describes the selected target row and its three layers using default row zero; target count/order/IDs, anchor names/slots, curves and palettes remain structured fields. Coupled duration/fade and min/max gap constraints and budget validation remain authoritative."
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "durationFrames": "settings.durationFrames",
      "fadeFrames": "settings.fadeFrames",
      "arcWidth": "settings.arcWidth",
      "jumpDelay": "settings.jumpDelay",
      "arcGap": "settings.arcGap",
      "branchSpread": "settings.branchSpread",
      "jitter": "settings.jitter",
      "smoothness": "settings.smoothness",
      "arcLifeFrames": "settings.arcLifeFrames",
      "branchLifeFrames": "settings.branchLifeFrames",
      "glowLifeFrames": "settings.glowLifeFrames",
      "branchCount": "settings.branchCount",
      "branchLength": "settings.branchLength",
      "branchWidthRatio": "settings.branchWidthRatio",
      "sparkGap": "settings.sparkGap",
      "sparkSize": "settings.sparkSize",
      "sparkSpeed": "settings.sparkSpeed",
      "glowRadius": "settings.glowRadius",
      "glowStrength": "settings.glowStrength",
      "restrikeRate": "settings.restrikeRate",
      "intervalFrames": "settings.intervalFrames",
      "minIntervalFrames": "settings.minIntervalFrames",
      "timeJitter": "settings.timeJitter",
      "minGap": "settings.minGap",
      "maxGap": "settings.maxGap",
      "spatialJitter": "settings.spatialJitter",
      "quality": "settings.quality",
      "frequencySource": "settings.frequencySource",
      "restrikes": "settings.restrikes",
      "spacingCurveEnabled": "settings.spacingCurveEnabled",
      "source.type": "settings.source.type",
      "source.space": "settings.source.space",
      "source.x": "settings.source.x",
      "source.y": "settings.source.y",
      "source.rotation": "settings.source.rotation",
      "targets.0.anchor.type": "settings.targets.0.anchor.type",
      "targets.0.anchor.space": "settings.targets.0.anchor.space",
      "targets.0.anchor.x": "settings.targets.0.anchor.x",
      "targets.0.anchor.y": "settings.targets.0.anchor.y",
      "targets.0.anchor.rotation": "settings.targets.0.anchor.rotation",
      "targets.0.enabled": "settings.targets.0.enabled",
      "targets.0.x": "settings.targets.0.x",
      "targets.0.y": "settings.targets.0.y",
      "targets.0.delayFrames": "settings.targets.0.delayFrames",
      "targets.0.seed": "settings.targets.0.seed",
      "targets.0.layers.arcs.enabled": "settings.targets.0.layers.arcs.enabled",
      "targets.0.layers.arcs.visible": "settings.targets.0.layers.arcs.visible",
      "targets.0.layers.arcs.x": "settings.targets.0.layers.arcs.x",
      "targets.0.layers.arcs.y": "settings.targets.0.layers.arcs.y",
      "targets.0.layers.arcs.delayFrames": "settings.targets.0.layers.arcs.delayFrames",
      "targets.0.layers.arcs.seed": "settings.targets.0.layers.arcs.seed",
      "targets.0.layers.arcs.opacity": "settings.targets.0.layers.arcs.opacity",
      "targets.0.layers.arcs.blend": "settings.targets.0.layers.arcs.blend",
      "targets.0.layers.arcs.order": "settings.targets.0.layers.arcs.order",
      "targets.0.layers.branches.enabled": "settings.targets.0.layers.branches.enabled",
      "targets.0.layers.branches.visible": "settings.targets.0.layers.branches.visible",
      "targets.0.layers.branches.x": "settings.targets.0.layers.branches.x",
      "targets.0.layers.branches.y": "settings.targets.0.layers.branches.y",
      "targets.0.layers.branches.delayFrames": "settings.targets.0.layers.branches.delayFrames",
      "targets.0.layers.branches.seed": "settings.targets.0.layers.branches.seed",
      "targets.0.layers.branches.opacity": "settings.targets.0.layers.branches.opacity",
      "targets.0.layers.branches.blend": "settings.targets.0.layers.branches.blend",
      "targets.0.layers.branches.order": "settings.targets.0.layers.branches.order",
      "targets.0.layers.glow.enabled": "settings.targets.0.layers.glow.enabled",
      "targets.0.layers.glow.visible": "settings.targets.0.layers.glow.visible",
      "targets.0.layers.glow.x": "settings.targets.0.layers.glow.x",
      "targets.0.layers.glow.y": "settings.targets.0.layers.glow.y",
      "targets.0.layers.glow.delayFrames": "settings.targets.0.layers.glow.delayFrames",
      "targets.0.layers.glow.seed": "settings.targets.0.layers.glow.seed",
      "targets.0.layers.glow.opacity": "settings.targets.0.layers.glow.opacity",
      "targets.0.layers.glow.blend": "settings.targets.0.layers.glow.blend",
      "targets.0.layers.glow.order": "settings.targets.0.layers.glow.order"
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
    "notes": "L01–L04 implementation candidate exists; L05 real acceptance remains pending."
  }
}
```
