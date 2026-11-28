# ELEC-03 — Electric Aura

**Status:** implementation candidate; v1 machine-readable status `specification-only` until real acceptance. Issue #39.

Build `python scripts/build_electric_aura_editor.py --output /tmp/ElectricAura_Lab.html` outside the repository. Source: `assets/electric-aura/src/`. Default 60-frame canonical loop at 60 FPS; nominal 24 arcs/s before curves, default 18 scheduled arc events and 8 spark events per cycle. Optional one-shot (set durationFrames to 40) fades to transparent. The editable circle/ellipse follows the current Spine anchor, not an automatically extracted silhouette. Up to four emitters; independent halo, arcs, sparks, current-pose anchors and drag offsets. Inherited anchor uses emitter transform; inherited anchor x/y/rotation are not edited separately. Loop time curves and halo palette must match at endpoints; edit JSON for paired changes. JSON keeps all structured curves, palette alpha and anchor fields. PNG uses exact actual backend and signed logical crop, independent of zoom; developer archives include original assets and pinned local runtimes.

Run `node --test scripts/test_electric_aura_*.cjs`, `python scripts/test_electric_aura_builder.py`, `python scripts/test_electric_aura_acceptance_checks.py`. For actual acceptance run `python scripts/test_electric_aura_browser.py /tmp/ElectricAura_Lab.html --backend webgl2 --output /tmp/aura-gl2` and repeat for webgl1/webgpu with separate empty directories. GPU/browser, Vite and architecture require evidence. No promotion based on CPU-only tests.

Run the separate scalar-parameter audit with `node scripts/audit_electric_aura_parameters.cjs > /tmp/aura-parameters.json`. It exercises every catalog scalar with a concrete output witness, native CPU anchor/view objects, conditional anchor controls and budget checks. Exit 2 means one or more parameter witnesses failed; `--allow-incomplete` is for diagnostic collection only. This is a numeric fragment, not a complete release report or actual GPU evidence. Do not promote the Blueprint using this fragment alone.

Halo seed: the shipped seed 4109 retains the original intensity exactly. Other int32 seeds apply a deterministic smooth one-cycle intensity attenuation (0–20% maximum reduction) on top of the authored glow curve and alpha. No effect on geometry, arc/spark RNG, timing, or the one-shot fade envelope. Zero glow/opacity remains invisible. The seed does not add a second clock.

### Optional analytical halo pulse (MOTION-M04)

In Curve editor → Generate halo pulse, choose the center multiplier, amplitude, number of cycles per authored duration, phase in cycles and approximation tolerance. Explicitly press Replace glow curve to replace only the shared `curves.glow` with editable v1 Bezier keys. Center ± amplitude must fit 0–2. The converter rejects invalid inputs and tolerance requests that cannot fit 64 keys. The reported measured error and estimated bound describe the last generated curve, not subsequent manual key edits. This is a normalized-time authoring operation; changing duration stretches the saved keys. It never changes the independent arc emission pulse rate, arc/spark schedules, defaults or other curves. The editor embeds the original motion and conversion modules offline; PNG and both Developer ZIPs consume only the existing serialized glow curve through the same compiler, so no extra runtime files are needed for replay. No new preset schema or runtime pin. Numerical, fixture-editor and archive acceptance do not constitute actual GPU certification. See #91.

## Machine-checkable Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.ice.electric-aura",
  "effectVersion": "0.1.0",
  "presetSchemaVersion": 1,
  "category": "ice",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "Crackling cyan-white arcs on an editable circular or elliptical current-pose aura, independent soft halo and outward sparks; 512 logical px, 60 FPS.",
  "phases": [
    {
      "id": "buildup",
      "at": 0,
      "look": "Default loop pre-roll has visible glow; optional one-shot starts transparent."
    },
    {
      "id": "discharge",
      "at": 0.5,
      "look": "Seeded intermittent arcs, tapered branches, halo and outward sparks."
    },
    {
      "id": "repeat",
      "at": 1,
      "look": "Loop returns to canonical start; optional one-shot ends transparent."
    }
  ],
  "layers": [
    {
      "id": "halo",
      "kind": "geometry",
      "position": "behind",
      "purpose": "Independent ring and soft PMA glow"
    },
    {
      "id": "arcs",
      "kind": "geometry",
      "position": "front",
      "purpose": "Seeded tapered jagged arcs and branches"
    },
    {
      "id": "sparks",
      "kind": "particles",
      "position": "front",
      "purpose": "Independent outward sparks"
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
      "key": "durationFrames",
      "type": "integer",
      "default": 60,
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
      "key": "auraRadius",
      "type": "number",
      "default": 80,
      "unit": "px",
      "controlGroup": "Aura",
      "exportPath": "settings.auraRadius",
      "min": 10,
      "max": 260,
      "step": 0.01
    },
    {
      "key": "ellipseRatio",
      "type": "number",
      "default": 1,
      "unit": "ratio",
      "controlGroup": "Aura",
      "exportPath": "settings.ellipseRatio",
      "min": 0.25,
      "max": 4,
      "step": 0.01
    },
    {
      "key": "arcCount",
      "type": "integer",
      "default": 12,
      "unit": "count",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.arcCount",
      "min": 0,
      "max": 60,
      "step": 1
    },
    {
      "key": "pulseRate",
      "type": "number",
      "default": 2,
      "unit": "Hz",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.pulseRate",
      "min": 0,
      "max": 15,
      "step": 0.01
    },
    {
      "key": "arcLength",
      "type": "number",
      "default": 35,
      "unit": "px",
      "controlGroup": "Aura",
      "exportPath": "settings.arcLength",
      "min": 2,
      "max": 140,
      "step": 0.01
    },
    {
      "key": "arcWidth",
      "type": "number",
      "default": 2,
      "unit": "px",
      "controlGroup": "Aura",
      "exportPath": "settings.arcWidth",
      "min": 0.5,
      "max": 14,
      "step": 0.01
    },
    {
      "key": "glowStrength",
      "type": "number",
      "default": 0.7,
      "unit": "ratio",
      "controlGroup": "Aura",
      "exportPath": "settings.glowStrength",
      "min": 0,
      "max": 2,
      "step": 0.01
    },
    {
      "key": "haloWidth",
      "type": "number",
      "default": 2,
      "unit": "px",
      "controlGroup": "Aura",
      "exportPath": "settings.haloWidth",
      "min": 0.5,
      "max": 20,
      "step": 0.01
    },
    {
      "key": "arcLifeFrames",
      "type": "integer",
      "default": 10,
      "unit": "frames",
      "controlGroup": "Aura",
      "exportPath": "settings.arcLifeFrames",
      "min": 1,
      "max": 120,
      "step": 1
    },
    {
      "key": "jaggedness",
      "type": "number",
      "default": 0.7,
      "unit": "ratio",
      "controlGroup": "Aura",
      "exportPath": "settings.jaggedness",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "branchChance",
      "type": "number",
      "default": 0.25,
      "unit": "ratio",
      "controlGroup": "Aura",
      "exportPath": "settings.branchChance",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "branchLengthRatio",
      "type": "number",
      "default": 0.4,
      "unit": "ratio",
      "controlGroup": "Aura",
      "exportPath": "settings.branchLengthRatio",
      "min": 0.1,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "intervalFrames",
      "type": "number",
      "default": 2.5,
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
      "default": 0.25,
      "unit": "ratio",
      "controlGroup": "Temporal spacing",
      "exportPath": "settings.timeJitter",
      "min": 0,
      "max": 0.45,
      "step": 0.01
    },
    {
      "key": "perimeterGap",
      "type": "number",
      "default": 15,
      "unit": "px",
      "controlGroup": "Spatial spacing",
      "exportPath": "settings.perimeterGap",
      "min": 2,
      "max": 80,
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
      "min": 2,
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
      "key": "sparkRate",
      "type": "number",
      "default": 8,
      "unit": "events/s",
      "controlGroup": "Sparks",
      "exportPath": "settings.sparkRate",
      "min": 0,
      "max": 120,
      "step": 0.01
    },
    {
      "key": "sparkTimeJitter",
      "type": "number",
      "default": 0.25,
      "unit": "ratio",
      "controlGroup": "Sparks",
      "exportPath": "settings.sparkTimeJitter",
      "min": 0,
      "max": 0.45,
      "step": 0.01
    },
    {
      "key": "sparkMinIntervalFrames",
      "type": "number",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Sparks",
      "exportPath": "settings.sparkMinIntervalFrames",
      "min": 0,
      "max": 120,
      "step": 0.01
    },
    {
      "key": "sparkGap",
      "type": "number",
      "default": 23,
      "unit": "px",
      "controlGroup": "Sparks",
      "exportPath": "settings.sparkGap",
      "min": 2,
      "max": 80,
      "step": 0.01
    },
    {
      "key": "sparkLifeFrames",
      "type": "integer",
      "default": 18,
      "unit": "frames",
      "controlGroup": "Sparks",
      "exportPath": "settings.sparkLifeFrames",
      "min": 1,
      "max": 120,
      "step": 1
    },
    {
      "key": "sparkSpeed",
      "type": "number",
      "default": 65,
      "unit": "px/s",
      "controlGroup": "Sparks",
      "exportPath": "settings.sparkSpeed",
      "min": 0,
      "max": 500,
      "step": 0.01
    },
    {
      "key": "sparkSize",
      "type": "number",
      "default": 2,
      "unit": "px",
      "controlGroup": "Sparks",
      "exportPath": "settings.sparkSize",
      "min": 0.25,
      "max": 15,
      "step": 0.01
    },
    {
      "key": "mode",
      "type": "enum",
      "default": "loop",
      "unit": "choice",
      "controlGroup": "Timeline",
      "exportPath": "settings.mode",
      "choices": [
        "loop",
        "oneShot"
      ]
    },
    {
      "key": "quality",
      "type": "enum",
      "default": "balanced",
      "unit": "choice",
      "controlGroup": "Aura",
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
      "key": "emitters.0.layers.halo.enabled",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.halo.enabled"
    },
    {
      "key": "emitters.0.layers.halo.visible",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.halo.visible"
    },
    {
      "key": "emitters.0.layers.halo.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.halo.x",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.halo.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.halo.y",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.halo.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.halo.rotation",
      "min": -360,
      "max": 360,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.halo.delayFrames",
      "type": "integer",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.halo.delayFrames",
      "min": 0,
      "max": 120,
      "step": 1
    },
    {
      "key": "emitters.0.layers.halo.seed",
      "type": "integer",
      "default": 4109,
      "unit": "seed",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.halo.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "emitters.0.layers.halo.opacity",
      "type": "number",
      "default": 1,
      "unit": "ratio",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.halo.opacity",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.halo.blend",
      "type": "enum",
      "default": "add",
      "unit": "choice",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.halo.blend",
      "choices": [
        "normal",
        "add"
      ]
    },
    {
      "key": "emitters.0.layers.halo.order",
      "type": "enum",
      "default": "behind",
      "unit": "choice",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.halo.order",
      "choices": [
        "behind",
        "front"
      ]
    },
    {
      "key": "emitters.0.layers.halo.anchor.type",
      "type": "enum",
      "default": "inherit",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.halo.anchor.type",
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
      "key": "emitters.0.layers.halo.anchor.space",
      "type": "enum",
      "default": "world",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.halo.anchor.space",
      "choices": [
        "world",
        "local"
      ]
    },
    {
      "key": "emitters.0.layers.halo.anchor.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.halo.anchor.x",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.halo.anchor.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.halo.anchor.y",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.halo.anchor.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.halo.anchor.rotation",
      "min": -360,
      "max": 360,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.arcs.enabled",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.arcs.enabled"
    },
    {
      "key": "emitters.0.layers.arcs.visible",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.arcs.visible"
    },
    {
      "key": "emitters.0.layers.arcs.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.arcs.x",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.arcs.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.arcs.y",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.arcs.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.arcs.rotation",
      "min": -360,
      "max": 360,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.arcs.delayFrames",
      "type": "integer",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.arcs.delayFrames",
      "min": 0,
      "max": 120,
      "step": 1
    },
    {
      "key": "emitters.0.layers.arcs.seed",
      "type": "integer",
      "default": 4110,
      "unit": "seed",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.arcs.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "emitters.0.layers.arcs.opacity",
      "type": "number",
      "default": 1,
      "unit": "ratio",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.arcs.opacity",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.arcs.blend",
      "type": "enum",
      "default": "add",
      "unit": "choice",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.arcs.blend",
      "choices": [
        "normal",
        "add"
      ]
    },
    {
      "key": "emitters.0.layers.arcs.order",
      "type": "enum",
      "default": "front",
      "unit": "choice",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.arcs.order",
      "choices": [
        "behind",
        "front"
      ]
    },
    {
      "key": "emitters.0.layers.arcs.anchor.type",
      "type": "enum",
      "default": "inherit",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.arcs.anchor.type",
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
      "key": "emitters.0.layers.arcs.anchor.space",
      "type": "enum",
      "default": "world",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.arcs.anchor.space",
      "choices": [
        "world",
        "local"
      ]
    },
    {
      "key": "emitters.0.layers.arcs.anchor.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.arcs.anchor.x",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.arcs.anchor.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.arcs.anchor.y",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.arcs.anchor.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.arcs.anchor.rotation",
      "min": -360,
      "max": 360,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.sparks.enabled",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.sparks.enabled"
    },
    {
      "key": "emitters.0.layers.sparks.visible",
      "type": "boolean",
      "default": true,
      "unit": "boolean",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.sparks.visible"
    },
    {
      "key": "emitters.0.layers.sparks.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.sparks.x",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.sparks.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.sparks.y",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.sparks.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.sparks.rotation",
      "min": -360,
      "max": 360,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.sparks.delayFrames",
      "type": "integer",
      "default": 0,
      "unit": "frames",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.sparks.delayFrames",
      "min": 0,
      "max": 120,
      "step": 1
    },
    {
      "key": "emitters.0.layers.sparks.seed",
      "type": "integer",
      "default": 4111,
      "unit": "seed",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.sparks.seed",
      "min": -2147483648,
      "max": 2147483647,
      "step": 1
    },
    {
      "key": "emitters.0.layers.sparks.opacity",
      "type": "number",
      "default": 1,
      "unit": "ratio",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.sparks.opacity",
      "min": 0,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.sparks.blend",
      "type": "enum",
      "default": "add",
      "unit": "choice",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.sparks.blend",
      "choices": [
        "normal",
        "add"
      ]
    },
    {
      "key": "emitters.0.layers.sparks.order",
      "type": "enum",
      "default": "front",
      "unit": "choice",
      "controlGroup": "Layer",
      "exportPath": "settings.emitters.0.layers.sparks.order",
      "choices": [
        "behind",
        "front"
      ]
    },
    {
      "key": "emitters.0.layers.sparks.anchor.type",
      "type": "enum",
      "default": "inherit",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.sparks.anchor.type",
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
      "key": "emitters.0.layers.sparks.anchor.space",
      "type": "enum",
      "default": "world",
      "unit": "choice",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.sparks.anchor.space",
      "choices": [
        "world",
        "local"
      ]
    },
    {
      "key": "emitters.0.layers.sparks.anchor.x",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.sparks.anchor.x",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.sparks.anchor.y",
      "type": "number",
      "default": 0,
      "unit": "px",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.sparks.anchor.y",
      "min": -10000,
      "max": 10000,
      "step": 0.01
    },
    {
      "key": "emitters.0.layers.sparks.anchor.rotation",
      "type": "number",
      "default": 0,
      "unit": "degrees",
      "controlGroup": "Anchor",
      "exportPath": "settings.emitters.0.layers.sparks.anchor.rotation",
      "min": -360,
      "max": 360,
      "step": 0.01
    }
  ],
  "controlGroups": [
    "Aura",
    "Timeline",
    "Temporal spacing",
    "Spatial spacing",
    "Sparks",
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
      "id": "frequency",
      "key": "curves.frequency",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "glow",
      "key": "curves.glow",
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
    "temporal": "Composed effectTime frequency and emitterTime rate/interval; bounded seeded jitter, independent spark rate/jitter/gap; cyclic minimum interval.",
    "spatial": "Shared cubic ellipse arc-length table, independent perimeter and spark spacing, seeded clustering, tapered branch geometry."
  },
  "palettes": [
    {
      "id": "halo-rgba",
      "key": "palettes.halo",
      "contract": "colors",
      "domain": "effectTime",
      "defaultStops": [
        "#60C6FF",
        "#DFFAFF",
        "#60C6FF"
      ]
    },
    {
      "id": "arcs-rgba",
      "key": "palettes.arcs",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#DFFAFF",
        "#60C6FF",
        "#6660E8"
      ]
    },
    {
      "id": "sparks-rgba",
      "key": "palettes.sparks",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#DFFAFF",
        "#60C6FF",
        "#6660E8"
      ]
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "emitters.0.layers.arcs.seed",
    "streamPolicy": "Independent emitter/layer time and placement salts; repeatable canonical cycle."
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
    "strategy": "Fixed-capacity native Pixi MeshGeometry batches, PMA soft halo and pooled spark sprites; current Spine pose; exact backend bake and explicit preview fallback. GPU acceptance pending."
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
      "Actual backend start/peak/end, dark/light/checker, isolated layers and transparent RGBA; visual review",
      "Numerical frequency/spacing/width, zero arcs, independent anchors and deterministic seeks; JSON roundtrip",
      "60-frame loop or 40-frame one-shot, signed crop and same-backend zoom invariance; both offline developer demos, Vite and architecture"
    ]
  },
  "outOfScope": [
    "Promotion before real acceptance.",
    "Automatic deformed silhouette extraction, historical trail and slot interleaving.",
    "Scalar metadata covers default emitter row; arbitrary emitter IDs, anchor names/slots, curve keys and RGBA stops remain structured preset fields."
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "durationFrames": "settings.durationFrames",
      "fadeFrames": "settings.fadeFrames",
      "auraRadius": "settings.auraRadius",
      "ellipseRatio": "settings.ellipseRatio",
      "arcCount": "settings.arcCount",
      "pulseRate": "settings.pulseRate",
      "arcLength": "settings.arcLength",
      "arcWidth": "settings.arcWidth",
      "glowStrength": "settings.glowStrength",
      "haloWidth": "settings.haloWidth",
      "arcLifeFrames": "settings.arcLifeFrames",
      "jaggedness": "settings.jaggedness",
      "branchChance": "settings.branchChance",
      "branchLengthRatio": "settings.branchLengthRatio",
      "intervalFrames": "settings.intervalFrames",
      "minIntervalFrames": "settings.minIntervalFrames",
      "timeJitter": "settings.timeJitter",
      "perimeterGap": "settings.perimeterGap",
      "minGap": "settings.minGap",
      "maxGap": "settings.maxGap",
      "spatialJitter": "settings.spatialJitter",
      "sparkRate": "settings.sparkRate",
      "sparkTimeJitter": "settings.sparkTimeJitter",
      "sparkMinIntervalFrames": "settings.sparkMinIntervalFrames",
      "sparkGap": "settings.sparkGap",
      "sparkLifeFrames": "settings.sparkLifeFrames",
      "sparkSpeed": "settings.sparkSpeed",
      "sparkSize": "settings.sparkSize",
      "mode": "settings.mode",
      "quality": "settings.quality",
      "frequencySource": "settings.frequencySource",
      "distribution": "settings.distribution",
      "spacingCurveEnabled": "settings.spacingCurveEnabled",
      "emitters.0.enabled": "settings.emitters.0.enabled",
      "emitters.0.anchor.type": "settings.emitters.0.anchor.type",
      "emitters.0.anchor.space": "settings.emitters.0.anchor.space",
      "emitters.0.anchor.x": "settings.emitters.0.anchor.x",
      "emitters.0.anchor.y": "settings.emitters.0.anchor.y",
      "emitters.0.anchor.rotation": "settings.emitters.0.anchor.rotation",
      "emitters.0.layers.halo.enabled": "settings.emitters.0.layers.halo.enabled",
      "emitters.0.layers.halo.visible": "settings.emitters.0.layers.halo.visible",
      "emitters.0.layers.halo.x": "settings.emitters.0.layers.halo.x",
      "emitters.0.layers.halo.y": "settings.emitters.0.layers.halo.y",
      "emitters.0.layers.halo.rotation": "settings.emitters.0.layers.halo.rotation",
      "emitters.0.layers.halo.delayFrames": "settings.emitters.0.layers.halo.delayFrames",
      "emitters.0.layers.halo.seed": "settings.emitters.0.layers.halo.seed",
      "emitters.0.layers.halo.opacity": "settings.emitters.0.layers.halo.opacity",
      "emitters.0.layers.halo.blend": "settings.emitters.0.layers.halo.blend",
      "emitters.0.layers.halo.order": "settings.emitters.0.layers.halo.order",
      "emitters.0.layers.halo.anchor.type": "settings.emitters.0.layers.halo.anchor.type",
      "emitters.0.layers.halo.anchor.space": "settings.emitters.0.layers.halo.anchor.space",
      "emitters.0.layers.halo.anchor.x": "settings.emitters.0.layers.halo.anchor.x",
      "emitters.0.layers.halo.anchor.y": "settings.emitters.0.layers.halo.anchor.y",
      "emitters.0.layers.halo.anchor.rotation": "settings.emitters.0.layers.halo.anchor.rotation",
      "emitters.0.layers.arcs.enabled": "settings.emitters.0.layers.arcs.enabled",
      "emitters.0.layers.arcs.visible": "settings.emitters.0.layers.arcs.visible",
      "emitters.0.layers.arcs.x": "settings.emitters.0.layers.arcs.x",
      "emitters.0.layers.arcs.y": "settings.emitters.0.layers.arcs.y",
      "emitters.0.layers.arcs.rotation": "settings.emitters.0.layers.arcs.rotation",
      "emitters.0.layers.arcs.delayFrames": "settings.emitters.0.layers.arcs.delayFrames",
      "emitters.0.layers.arcs.seed": "settings.emitters.0.layers.arcs.seed",
      "emitters.0.layers.arcs.opacity": "settings.emitters.0.layers.arcs.opacity",
      "emitters.0.layers.arcs.blend": "settings.emitters.0.layers.arcs.blend",
      "emitters.0.layers.arcs.order": "settings.emitters.0.layers.arcs.order",
      "emitters.0.layers.arcs.anchor.type": "settings.emitters.0.layers.arcs.anchor.type",
      "emitters.0.layers.arcs.anchor.space": "settings.emitters.0.layers.arcs.anchor.space",
      "emitters.0.layers.arcs.anchor.x": "settings.emitters.0.layers.arcs.anchor.x",
      "emitters.0.layers.arcs.anchor.y": "settings.emitters.0.layers.arcs.anchor.y",
      "emitters.0.layers.arcs.anchor.rotation": "settings.emitters.0.layers.arcs.anchor.rotation",
      "emitters.0.layers.sparks.enabled": "settings.emitters.0.layers.sparks.enabled",
      "emitters.0.layers.sparks.visible": "settings.emitters.0.layers.sparks.visible",
      "emitters.0.layers.sparks.x": "settings.emitters.0.layers.sparks.x",
      "emitters.0.layers.sparks.y": "settings.emitters.0.layers.sparks.y",
      "emitters.0.layers.sparks.rotation": "settings.emitters.0.layers.sparks.rotation",
      "emitters.0.layers.sparks.delayFrames": "settings.emitters.0.layers.sparks.delayFrames",
      "emitters.0.layers.sparks.seed": "settings.emitters.0.layers.sparks.seed",
      "emitters.0.layers.sparks.opacity": "settings.emitters.0.layers.sparks.opacity",
      "emitters.0.layers.sparks.blend": "settings.emitters.0.layers.sparks.blend",
      "emitters.0.layers.sparks.order": "settings.emitters.0.layers.sparks.order",
      "emitters.0.layers.sparks.anchor.type": "settings.emitters.0.layers.sparks.anchor.type",
      "emitters.0.layers.sparks.anchor.space": "settings.emitters.0.layers.sparks.anchor.space",
      "emitters.0.layers.sparks.anchor.x": "settings.emitters.0.layers.sparks.anchor.x",
      "emitters.0.layers.sparks.anchor.y": "settings.emitters.0.layers.sparks.anchor.y",
      "emitters.0.layers.sparks.anchor.rotation": "settings.emitters.0.layers.sparks.anchor.rotation"
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
    "notes": "A01–A04 candidate implemented; use existing source. A05 real acceptance pending."
  }
}
```
