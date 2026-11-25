# Healing Aura

GAME-09 / #48 — **implementation candidate; GPU acceptance pending**. Source exists in `assets/healing-aura/src/`. Do not reimplement from the specification. The v1 catalog retains `specification-only` until real browser and package acceptance, consistent with Snowfall and Magic Shield.

Build outside the checkout:

    python scripts/build_healing_editor.py --output ../HealingAura.html

Run local tests:

    node --test scripts/test_healing_*.cjs
    python scripts/test_healing_builder.py
    python scripts/test_blueprints.py
    python scripts/test_healing_browser.py ../HealingAura.html --backend webgl2 --output ../healing-evidence-webgl2

CPU verification includes actual pinned Pixi MeshSimple and Spine bone objects (not GPU readback), all three styles, isolated Bezier alpha witness, 240 seeded configurations, independent layer/anchor tests, real PNG compression and ZIP byte preservation. Actual browser pixels, pinned offline assembly, Vite dependency builds and architecture suite remain unverified. Repeat the browser command for webgl1 and webgpu using empty output directories. On a GPU-capable host check all three backends explicitly, 40-frame PNG dimensions and transparent endpoints, camera-independent crop, all layers disabled, sample + real physics rigs, and both developer builds. Do not treat CPU tests as pixel parity. The requested default 1.1 Hz loop pulse quantizes to 1 Hz. One-shot endpoints are blank. Signed crop offsets refer to the center pixel (odd dimensions); frame count is independent export metadata. Spine physics uses fixed 60 FPS pose replay.

## Machine-checkable Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.game.healing-aura",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "game",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "Gentle green healing backglow, rising motes, optional pulse and independent rising lines, 512 logical px, 60 FPS, default 60-frame loop.",
  "phases": [
    {
      "id": "emerge",
      "at": 0,
      "look": "One-shot transparent; loop is pre-rolled."
    },
    {
      "id": "rise",
      "at": 0.5,
      "look": "Soft green light, rising motes and optional pulse."
    },
    {
      "id": "fade",
      "at": 1,
      "look": "One-shot transparent; loop matches the initial phase."
    }
  ],
  "layers": [
    {
      "id": "glow",
      "kind": "geometry",
      "position": "Behind by default",
      "purpose": "Soft green radial backglow"
    },
    {
      "id": "motes",
      "kind": "particles",
      "position": "Front by default",
      "purpose": "Rising motes or magical sparks"
    },
    {
      "id": "pulse",
      "kind": "geometry",
      "position": "Front by default",
      "purpose": "Optional concentric ring"
    },
    {
      "id": "lines",
      "kind": "geometry",
      "position": "Front by default",
      "purpose": "Independently toggleable rising lines"
    }
  ],
  "emitterAnchors": [
    {
      "id": "world",
      "space": "world",
      "onMissing": "hide dependent layer and diagnose"
    },
    {
      "id": "local",
      "space": "local",
      "onMissing": "hide dependent layer and diagnose"
    },
    {
      "id": "bone",
      "space": "bone",
      "onMissing": "hide dependent layer and diagnose"
    },
    {
      "id": "inherit",
      "space": "inherit",
      "onMissing": "hide dependent layer and diagnose"
    }
  ],
  "parameters": [
    {
      "key": "durationFrames",
      "type": "integer",
      "default": 60,
      "min": 2,
      "max": 3600,
      "step": 1,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.durationFrames"
    },
    {
      "key": "particleRate",
      "type": "number",
      "default": 18,
      "min": 0,
      "max": 120,
      "step": 0.1,
      "unit": "1/s",
      "controlGroup": "Effect",
      "exportPath": "settings.particleRate"
    },
    {
      "key": "riseSpeed",
      "type": "number",
      "default": 60,
      "min": 0,
      "max": 250,
      "step": 1,
      "unit": "px/s",
      "controlGroup": "Effect",
      "exportPath": "settings.riseSpeed"
    },
    {
      "key": "glowRadius",
      "type": "number",
      "default": 85,
      "min": 10,
      "max": 250,
      "step": 0.5,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.glowRadius"
    },
    {
      "key": "pulseRate",
      "type": "number",
      "default": 1.1,
      "min": 0,
      "max": 9,
      "step": 0.1,
      "unit": "Hz",
      "controlGroup": "Effect",
      "exportPath": "settings.pulseRate"
    },
    {
      "key": "moteSize",
      "type": "number",
      "default": 5,
      "min": 1,
      "max": 20,
      "step": 0.1,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.moteSize"
    },
    {
      "key": "glowStrength",
      "type": "number",
      "default": 0.45,
      "min": 0,
      "max": 2,
      "step": 0.01,
      "unit": "multiplier",
      "controlGroup": "Effect",
      "exportPath": "settings.glowStrength"
    },
    {
      "key": "lifetimeFrames",
      "type": "integer",
      "default": 36,
      "min": 1,
      "max": 3600,
      "step": 1,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.lifetimeFrames"
    },
    {
      "key": "intervalFrames",
      "type": "number",
      "default": 3.3333333333333335,
      "min": 0.25,
      "max": 3600,
      "step": 0.01,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.intervalFrames"
    },
    {
      "key": "minIntervalFrames",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 3600,
      "step": 0.01,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.minIntervalFrames"
    },
    {
      "key": "timeJitter",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Effect",
      "exportPath": "settings.timeJitter"
    },
    {
      "key": "burstRate",
      "type": "number",
      "default": 2,
      "min": 0,
      "max": 60,
      "step": 0.1,
      "unit": "1/s",
      "controlGroup": "Effect",
      "exportPath": "settings.burstRate"
    },
    {
      "key": "burstCount",
      "type": "integer",
      "default": 3,
      "min": 1,
      "max": 8,
      "step": 1,
      "unit": "count",
      "controlGroup": "Effect",
      "exportPath": "settings.burstCount"
    },
    {
      "key": "burstDelayFrames",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 3600,
      "step": 0.01,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.burstDelayFrames"
    },
    {
      "key": "spacingPx",
      "type": "number",
      "default": 14,
      "min": 0.25,
      "max": 140,
      "step": 0.25,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.spacingPx"
    },
    {
      "key": "minGapPx",
      "type": "number",
      "default": 2,
      "min": 0.25,
      "max": 140,
      "step": 0.25,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.minGapPx"
    },
    {
      "key": "maxGapPx",
      "type": "number",
      "default": 140,
      "min": 0.25,
      "max": 140,
      "step": 0.25,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.maxGapPx"
    },
    {
      "key": "spatialJitter",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Effect",
      "exportPath": "settings.spatialJitter"
    },
    {
      "key": "driftPx",
      "type": "number",
      "default": 12,
      "min": 0,
      "max": 100,
      "step": 0.1,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.driftPx"
    },
    {
      "key": "seed",
      "type": "integer",
      "default": 4109,
      "min": -2147483648,
      "max": 2147483647,
      "step": 1,
      "unit": "int32",
      "controlGroup": "Effect",
      "exportPath": "settings.seed"
    },
    {
      "key": "mode",
      "type": "enum",
      "default": "loop",
      "choices": [
        "loop",
        "oneShot"
      ],
      "unit": "mode",
      "controlGroup": "Effect",
      "exportPath": "settings.mode"
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
      "unit": "mode",
      "controlGroup": "Effect",
      "exportPath": "settings.quality"
    },
    {
      "key": "frequencySource",
      "type": "enum",
      "default": "rate",
      "choices": [
        "rate",
        "interval"
      ],
      "unit": "mode",
      "controlGroup": "Effect",
      "exportPath": "settings.frequencySource"
    },
    {
      "key": "distribution",
      "type": "enum",
      "default": "even",
      "choices": [
        "even",
        "random",
        "stratified",
        "clustered"
      ],
      "unit": "mode",
      "controlGroup": "Effect",
      "exportPath": "settings.distribution"
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
      "unit": "mode",
      "controlGroup": "Effect",
      "exportPath": "settings.style"
    },
    {
      "key": "burstEnabled",
      "type": "boolean",
      "default": false,
      "unit": "toggle",
      "controlGroup": "Effect",
      "exportPath": "settings.burstEnabled"
    }
  ],
  "controlGroups": [
    "Effect"
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
      "id": "glowCurve",
      "key": "glowCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "alphaCurve",
      "key": "alphaCurve",
      "domain": "particleAge",
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
    "temporal": "Independent rate/interval curves and optional burst stream; seeded jitter and minimum trigger gap.",
    "spatial": "Closed cubic circle; true arc-length origin candidates, min/max gap and distance curve; seeded permutation and drift."
  },
  "palettes": [
    {
      "id": "healing-rgba",
      "key": "palette",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#F4FFDE",
        "#93DF86",
        "#42B89C"
      ]
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "Independent emitter/layer seeds, separate base/burst streams and seeded per-particle drift."
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
    "strategy": "Candidate pooled native Pixi MeshSimple, shared premultiplied alpha ramp; real pinned CPU objects tested, GPU acceptance pending."
  },
  "qualityBudgets": {
    "low": {
      "primitives": 256,
      "maxEmitters": 4
    },
    "balanced": {
      "primitives": 1024,
      "maxEmitters": 4
    },
    "high": {
      "primitives": 2048,
      "maxEmitters": 4
    }
  },
  "tests": {
    "verified": false,
    "evidence": [],
    "required": [
      "Actual WebGL1/2/WebGPU visual and transparent PNG/crop parity on light/dark/checker",
      "Actual Spine asset/physics and editor interaction",
      "Standalone vendor build and Vite package build, offline network assertion"
    ]
  },
  "outOfScope": [
    "Exact affine shear and reflection of local offsets",
    "Other Spine versions",
    "Physical-device performance certification"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "durationFrames": "settings.durationFrames",
      "particleRate": "settings.particleRate",
      "riseSpeed": "settings.riseSpeed",
      "glowRadius": "settings.glowRadius",
      "pulseRate": "settings.pulseRate",
      "moteSize": "settings.moteSize",
      "glowStrength": "settings.glowStrength",
      "lifetimeFrames": "settings.lifetimeFrames",
      "intervalFrames": "settings.intervalFrames",
      "minIntervalFrames": "settings.minIntervalFrames",
      "timeJitter": "settings.timeJitter",
      "burstRate": "settings.burstRate",
      "burstCount": "settings.burstCount",
      "burstDelayFrames": "settings.burstDelayFrames",
      "spacingPx": "settings.spacingPx",
      "minGapPx": "settings.minGapPx",
      "maxGapPx": "settings.maxGapPx",
      "spatialJitter": "settings.spatialJitter",
      "driftPx": "settings.driftPx",
      "seed": "settings.seed",
      "mode": "settings.mode",
      "quality": "settings.quality",
      "frequencySource": "settings.frequencySource",
      "distribution": "settings.distribution",
      "style": "settings.style",
      "burstEnabled": "settings.burstEnabled"
    },
    "preview": "not-implemented",
    "pngBake": "not-implemented",
    "developerZip": "not-implemented",
    "invariant": "Catalog reference status withheld until real browser and developer build acceptance. Candidate source documented above."
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject"
  },
  "implementation": {
    "status": "specification-only",
    "sourceFiles": [],
    "notes": "Candidate source exists; v1 registry has no intermediate state. Do not reimplement or promote until real acceptance."
  }
}
```
