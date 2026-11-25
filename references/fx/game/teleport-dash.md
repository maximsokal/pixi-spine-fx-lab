# Teleport and Dash Trail (GAME-07, #46)

Reference implementation. Build offline with `python scripts/build_dash_editor.py --output <outside-repository>/TeleportDash.html`. Load a Spine 4.2 JSON/SKEL with all atlas pages for silhouette afterimages. Dash travels the shared open cubic path; teleport snaps at the chosen frame without spatial birth credit or bridging ribbon. Source visibility is independent from FX. Exact one-shot endpoints concern FX only. The source can remain visible. Numeric controls accept continuous valid decimals even where the schema gives a suggested step. Quality controls capacity; actual mobile/max-size throughput is not certified. Crop is world-aligned, untrimmed straight RGBA8; developer archives preserve original asset bytes and use pinned Vite packages.

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.game.teleport-dash",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "game",
  "styles": [
    "stylized",
    "magical"
  ],
  "visualGoal": "40-frame one-shot dash or teleport, tapered curved trail, historical Spine silhouettes, origin/arrival flash and seeded particles. 60 FPS; 512 authored pixels. Exact blank FX endpoints; no fabricated travel on jumps.",
  "phases": [
    {
      "id": "start",
      "at": 0,
      "look": "Transparent FX at exact initial sample"
    },
    {
      "id": "peak",
      "at": 0.5,
      "look": "Directional tapered trail and historical silhouettes with particles"
    },
    {
      "id": "end",
      "at": 1,
      "look": "Transparent FX at exact final sample"
    }
  ],
  "layers": [
    {
      "id": "trail",
      "kind": "geometry",
      "position": "Independent world/local/bone or inherited emitter transform",
      "purpose": "Tapered cubic arc ribbon"
    },
    {
      "id": "echoes",
      "kind": "geometry",
      "position": "Independent world/local/bone or inherited emitter transform",
      "purpose": "Independent historical Spine silhouettes, requires loaded source"
    },
    {
      "id": "flash",
      "kind": "geometry",
      "position": "Independent world/local/bone or inherited emitter transform",
      "purpose": "Origin and jump endpoint flash"
    },
    {
      "id": "particles",
      "kind": "particles",
      "position": "Independent world/local/bone or inherited emitter transform",
      "purpose": "Seeded directional particles"
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
      "key": "mode",
      "type": "enum",
      "default": "dash",
      "choices": [
        "dash",
        "teleport"
      ],
      "unit": "mode",
      "controlGroup": "Movement",
      "exportPath": "settings.mode"
    },
    {
      "key": "durationFrames",
      "type": "integer",
      "default": 40,
      "min": 2,
      "max": 3600,
      "step": 1,
      "unit": "frames",
      "controlGroup": "Movement",
      "exportPath": "settings.durationFrames"
    },
    {
      "key": "teleportFrame",
      "type": "integer",
      "default": 16,
      "min": 1,
      "max": 3599,
      "step": 1,
      "unit": "frames",
      "controlGroup": "Movement",
      "exportPath": "settings.teleportFrame"
    },
    {
      "key": "dashLength",
      "type": "number",
      "default": 170,
      "min": 10,
      "max": 600,
      "step": 0.01,
      "unit": "px",
      "controlGroup": "Movement",
      "exportPath": "settings.dashLength"
    },
    {
      "key": "trailWidth",
      "type": "number",
      "default": 24,
      "min": 0.5,
      "max": 110,
      "step": 0.01,
      "unit": "px",
      "controlGroup": "Movement",
      "exportPath": "settings.trailWidth"
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
      "controlGroup": "Movement",
      "exportPath": "settings.quality"
    },
    {
      "key": "seed",
      "type": "integer",
      "default": 6179,
      "min": -2147483648,
      "max": 2147483647,
      "step": 1,
      "unit": "int32",
      "controlGroup": "Movement",
      "exportPath": "settings.seed"
    },
    {
      "key": "echoMode",
      "type": "enum",
      "default": "time",
      "choices": [
        "time",
        "distance"
      ],
      "unit": "mode",
      "controlGroup": "Afterimages",
      "exportPath": "settings.echoMode"
    },
    {
      "key": "afterimageCount",
      "type": "integer",
      "default": 5,
      "min": 0,
      "max": 24,
      "step": 1,
      "unit": "count",
      "controlGroup": "Afterimages",
      "exportPath": "settings.afterimageCount"
    },
    {
      "key": "temporalEchoGap",
      "type": "number",
      "default": 3,
      "min": 1,
      "max": 20,
      "step": 0.01,
      "unit": "frames",
      "controlGroup": "Afterimages",
      "exportPath": "settings.temporalEchoGap"
    },
    {
      "key": "spatialEchoGap",
      "type": "number",
      "default": 14,
      "min": 1,
      "max": 100,
      "step": 0.01,
      "unit": "px",
      "controlGroup": "Afterimages",
      "exportPath": "settings.spatialEchoGap"
    },
    {
      "key": "afterimageAlpha",
      "type": "number",
      "default": 0.6,
      "min": 0,
      "max": 1,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Afterimages",
      "exportPath": "settings.afterimageAlpha"
    },
    {
      "key": "echoLifetimeFrames",
      "type": "integer",
      "default": 18,
      "min": 1,
      "max": 3600,
      "step": 1,
      "unit": "frames",
      "controlGroup": "Afterimages",
      "exportPath": "settings.echoLifetimeFrames"
    },
    {
      "key": "frequencySource",
      "type": "enum",
      "default": "interval",
      "choices": [
        "interval",
        "rate"
      ],
      "unit": "mode",
      "controlGroup": "Afterimages",
      "exportPath": "settings.frequencySource"
    },
    {
      "key": "echoRate",
      "type": "number",
      "default": 20,
      "min": 0,
      "max": 60,
      "step": 0.01,
      "unit": "1/s",
      "controlGroup": "Afterimages",
      "exportPath": "settings.echoRate"
    },
    {
      "key": "burstCount",
      "type": "integer",
      "default": 1,
      "min": 1,
      "max": 8,
      "step": 1,
      "unit": "count",
      "controlGroup": "Afterimages",
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
      "controlGroup": "Afterimages",
      "exportPath": "settings.burstDelayFrames"
    },
    {
      "key": "minIntervalFrames",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 3600,
      "step": 0.01,
      "unit": "frames",
      "controlGroup": "Afterimages",
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
      "controlGroup": "Afterimages",
      "exportPath": "settings.timeJitter"
    },
    {
      "key": "minGapPx",
      "type": "number",
      "default": 1,
      "min": 1,
      "max": 100,
      "step": 0.01,
      "unit": "px",
      "controlGroup": "Afterimages",
      "exportPath": "settings.minGapPx"
    },
    {
      "key": "maxGapPx",
      "type": "number",
      "default": 100,
      "min": 1,
      "max": 100,
      "step": 0.01,
      "unit": "px",
      "controlGroup": "Afterimages",
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
      "controlGroup": "Afterimages",
      "exportPath": "settings.spatialJitter"
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
      "controlGroup": "Afterimages",
      "exportPath": "settings.distribution"
    },
    {
      "key": "particleCount",
      "type": "integer",
      "default": 16,
      "min": 0,
      "max": 128,
      "step": 1,
      "unit": "count",
      "controlGroup": "Accents",
      "exportPath": "settings.particleCount"
    },
    {
      "key": "particleLifetimeFrames",
      "type": "integer",
      "default": 12,
      "min": 1,
      "max": 3600,
      "step": 1,
      "unit": "frames",
      "controlGroup": "Accents",
      "exportPath": "settings.particleLifetimeFrames"
    },
    {
      "key": "particleSize",
      "type": "number",
      "default": 2,
      "min": 0.1,
      "max": 20,
      "step": 0.01,
      "unit": "px",
      "controlGroup": "Accents",
      "exportPath": "settings.particleSize"
    },
    {
      "key": "flashLifetimeFrames",
      "type": "integer",
      "default": 6,
      "min": 1,
      "max": 3600,
      "step": 1,
      "unit": "frames",
      "controlGroup": "Accents",
      "exportPath": "settings.flashLifetimeFrames"
    },
    {
      "key": "flashRadius",
      "type": "number",
      "default": 28,
      "min": 1,
      "max": 300,
      "step": 0.01,
      "unit": "px",
      "controlGroup": "Accents",
      "exportPath": "settings.flashRadius"
    }
  ],
  "controlGroups": [
    "Movement",
    "Afterimages",
    "Accents"
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
      "id": "widthCurve",
      "key": "widthCurve",
      "domain": "pathPosition",
      "contract": "curves"
    },
    {
      "id": "echoAlphaCurve",
      "key": "echoAlphaCurve",
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
    "temporal": "Independent rate/interval curve, burst delay/minimum and seeded jitter. Birth time and source pose time use absolute seconds before animation speed.",
    "spatial": "Actual traveled open cubic arc; exclude teleport and stepped discontinuities. Spacing curve scaled by spatialEchoGap/14; min/max gap and seeded jitter."
  },
  "palettes": [
    {
      "id": "dash-rgba",
      "key": "palette",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#D0F8FF",
        "#519DEA"
      ]
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "Independent emitter/layer seeds, deterministic absolute-time sampling"
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
    "strategy": "Native Graphics ribbon strips and accents; independent Spine model pool with fixed-step historical replay; tiled isolated PNG bake; same runtime in developer ZIP."
  },
  "qualityBudgets": {
    "low": {
      "echoesPerEmitter": 8,
      "vertices": 512,
      "particles": 128,
      "maxEmitters": 4
    },
    "balanced": {
      "echoesPerEmitter": 24,
      "vertices": 2048,
      "particles": 512,
      "maxEmitters": 4
    },
    "high": {
      "echoesPerEmitter": 24,
      "vertices": 4096,
      "particles": 1024,
      "maxEmitters": 4
    }
  },
  "tests": {
    "verified": true,
    "evidence": [
      "scripts/test_dash_core.cjs",
      "scripts/test_dash_spine_contract.cjs",
      "scripts/test_dash_runtime_contract.cjs",
      "scripts/test_dash_runtime.cjs",
      "scripts/test_dash_editor_state.cjs",
      "scripts/test_dash_editor.cjs",
      "scripts/test_dash_export_contract.cjs",
      "scripts/test_dash_bake_contract.cjs",
      "scripts/test_dash_export_ui.cjs",
      "scripts/test_dash_developer_contract.cjs",
      "scripts/test_dash_developer_ui.cjs",
      "scripts/test_dash_developer.cjs",
      "scripts/test_dash_catalog_evidence.cjs"
    ],
    "required": [
      "Exact blank endpoints, historical silhouettes and all four layers on actual backends",
      "All declared parameters, curves, palette and cubic path numerical witnesses",
      "Spine JSON/SKEL, selected skin, source preservation, 40-frame PNG and both developer ZIPs, fallback"
    ]
  },
  "outOfScope": [
    "Scene refraction; exact full affine shear/reflection and slot/attachment anchors",
    "Physical mobile and maximum-size bake performance certification",
    "Spine runtime versions outside 4.2",
    "Looping FX: dash and teleport are one-shot; independent source animation may loop"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "mode": "settings.mode",
      "durationFrames": "settings.durationFrames",
      "teleportFrame": "settings.teleportFrame",
      "dashLength": "settings.dashLength",
      "trailWidth": "settings.trailWidth",
      "quality": "settings.quality",
      "seed": "settings.seed",
      "echoMode": "settings.echoMode",
      "afterimageCount": "settings.afterimageCount",
      "temporalEchoGap": "settings.temporalEchoGap",
      "spatialEchoGap": "settings.spatialEchoGap",
      "afterimageAlpha": "settings.afterimageAlpha",
      "echoLifetimeFrames": "settings.echoLifetimeFrames",
      "frequencySource": "settings.frequencySource",
      "echoRate": "settings.echoRate",
      "burstCount": "settings.burstCount",
      "burstDelayFrames": "settings.burstDelayFrames",
      "minIntervalFrames": "settings.minIntervalFrames",
      "timeJitter": "settings.timeJitter",
      "minGapPx": "settings.minGapPx",
      "maxGapPx": "settings.maxGapPx",
      "spatialJitter": "settings.spatialJitter",
      "distribution": "settings.distribution",
      "particleCount": "settings.particleCount",
      "particleLifetimeFrames": "settings.particleLifetimeFrames",
      "particleSize": "settings.particleSize",
      "flashLifetimeFrames": "settings.flashLifetimeFrames",
      "flashRadius": "settings.flashRadius"
    },
    "preview": "python scripts/build_dash_editor.py --output <outside-repository>/TeleportDash.html",
    "pngBake": "FxDashExport.bakeSequence; FxDashBake world-aligned tiles; straight RGBA8 at 60 FPS",
    "developerZip": "FxDashExportBrowser.developer; pinned runnable Vite examples",
    "invariant": "Same core/runtime and historical pose policy in preview, bake and developer example"
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject"
  },
  "implementation": {
    "status": "reference-implementation",
    "sourceFiles": [
      "assets/teleport-dash/src/dash-core.js",
      "assets/teleport-dash/src/dash-spine.js",
      "assets/teleport-dash/src/dash-runtime.js",
      "assets/teleport-dash/src/dash-editor-state.js",
      "assets/teleport-dash/src/dash-editor.js",
      "assets/teleport-dash/src/dash-export.js",
      "assets/teleport-dash/src/dash-bake.js",
      "assets/teleport-dash/src/dash-export-browser.js",
      "assets/teleport-dash/src/ui.html",
      "scripts/build_dash_editor.py"
    ],
    "notes": "Shared open cubic path (not per-emitter path); independent emitter/layer transform and seed. Historical source pose reset/replay at fixed 60Hz, selected skin before fitting. Quality is capacity, not raster quality; no source means no rendered echoes."
  }
}
```

## Reproduce acceptance

Use `node scripts/test_dash_catalog_evidence.cjs <html> <backend> <empty-external-dir>` for each actual backend, and `python scripts/effect_validation.py <report.json> --require-pass`. The report includes real RGBA PNGs, decoded pixel witnesses, parameter and curve behavior, and backend identity. Separate T02–T04 suites exercise JSON/SKEL, physics, skins, editor/drag, 40-frame PNG and runnable developer ZIP/fallback. Official fixture hashes and licensing requirements are documented in `docs/teleport-dash-t02-renderer-plan.md`. No physical mobile or max-size bake performance certification.

Final desktop acceptance on runtime baseline b6ccd4ab14a0aa3e94bc5b0bbde114c886136255: 53/53 machine-validated checks per actual backend, 159 total; 28 declared parameters, six curves, palette and shared path, exact blank endpoints, independent four-layer mute/solo, teleport and actual dark/light/checker preview screenshots. Earlier T04c runtime baseline 5c8a3cd passed 57/57 native Dash tests, exact PNG crop and alpha on all three backends, both built Vite ZIPs and forced WebGL fallback. External reports and PNGs are generated outside the repository, not embedded here. Automated pixel checks, not human aesthetic approval. Python 67/67. Statik health remains unverified where the binary is absent.
