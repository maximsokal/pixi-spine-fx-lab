# Shockwave Ring

GAME-05 / #44. Independent offline editor. Fixed 40-frame one-shot. Optional refraction is not implemented; requires explicit background capture. Use world/local/bone anchors; attachment anchors are not implemented. Quality is a particle capacity guard, not a raster quality slider.

    python scripts/build_shockwave_editor.py --output ../Shockwave_Lab.html

## Machine-checkable Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.game.shockwave",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "game",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "Rapidly expanding circular pressure front with thinning edge, delayed secondary waves and optional outward particles. 40 frames at 60 FPS; logical 512x512.",
  "phases": [
    {
      "id": "impact",
      "at": 0,
      "look": "Tiny energetic origin"
    },
    {
      "id": "expansion",
      "at": 0.5,
      "look": "Visible expanding thin ring"
    },
    {
      "id": "dissipate",
      "at": 1,
      "look": "Exactly transparent terminal frame"
    }
  ],
  "layers": [
    {
      "id": "primary",
      "kind": "geometry",
      "position": "Independent world/local/bone or inherited emitter anchor",
      "purpose": "Primary annulus"
    },
    {
      "id": "secondary",
      "kind": "geometry",
      "position": "Independent world/local/bone or inherited emitter anchor",
      "purpose": "Independently delayed wave"
    },
    {
      "id": "particles",
      "kind": "geometry",
      "position": "Independent world/local/bone or inherited emitter anchor",
      "purpose": "Seeded arc-length outward particles"
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
      "key": "startRadius",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 60,
      "step": 0.5,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.startRadius"
    },
    {
      "key": "finalRadius",
      "type": "number",
      "default": 150,
      "min": 20,
      "max": 500,
      "step": 0.5,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.finalRadius"
    },
    {
      "key": "ringWidth",
      "type": "number",
      "default": 8,
      "min": 0.5,
      "max": 60,
      "step": 0.5,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.ringWidth"
    },
    {
      "key": "edgeSoftness",
      "type": "number",
      "default": 0.6,
      "min": 0,
      "max": 1,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Effect",
      "exportPath": "settings.edgeSoftness"
    },
    {
      "key": "ringCount",
      "type": "integer",
      "default": 1,
      "min": 1,
      "max": 8,
      "step": 1,
      "unit": "count",
      "controlGroup": "Effect",
      "exportPath": "settings.ringCount"
    },
    {
      "key": "ringDelayFrames",
      "type": "number",
      "default": 5,
      "min": 0,
      "max": 30,
      "step": 0.5,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.ringDelayFrames"
    },
    {
      "key": "radialGapPx",
      "type": "number",
      "default": 22,
      "min": 2,
      "max": 100,
      "step": 0.5,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.radialGapPx"
    },
    {
      "key": "arcGapPx",
      "type": "number",
      "default": 22,
      "min": 2,
      "max": 100,
      "step": 0.5,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.arcGapPx"
    },
    {
      "key": "minIntervalFrames",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 30,
      "step": 0.5,
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
      "key": "seed",
      "type": "integer",
      "default": 7321,
      "min": -2147483648,
      "max": 2147483647,
      "step": 1,
      "unit": "int32",
      "controlGroup": "Effect",
      "exportPath": "settings.seed"
    },
    {
      "key": "distribution",
      "type": "enum",
      "default": "even",
      "choices": [
        "even",
        "random",
        "clustered"
      ],
      "unit": "mode",
      "controlGroup": "Effect",
      "exportPath": "settings.distribution"
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
      "id": "radiusCurve",
      "key": "radiusCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "widthCurve",
      "key": "widthCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "opacityCurve",
      "key": "opacityCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "intervalCurve",
      "key": "intervalCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "arcSpacingCurve",
      "key": "arcSpacingCurve",
      "domain": "pathPosition",
      "contract": "curves"
    }
  ],
  "spacing": {
    "contract": "spacing",
    "temporal": "Independent seeded interval schedule, 40-frame window; zero delay permits simultaneous bursts; impossible schedules reject.",
    "spatial": "Analytic circle arc length at final radius; radial gap independent of time; even placement omits near-duplicate seam; random and clustered jitter."
  },
  "palettes": [
    {
      "id": "shock-rgba",
      "key": "palette",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#E0F9FF",
        "#88CDEB"
      ]
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "Independent emitter and layer seeds; absolute-time seek"
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
    "strategy": "Pooled annulus meshes and procedural particle sprites; isolated straight-alpha PNG; same runtime for preview and developer example."
  },
  "qualityBudgets": {
    "low": {
      "particles": 256,
      "maxEmitters": 4,
      "maxRingsPerEmitter": 8
    },
    "balanced": {
      "particles": 1024,
      "maxEmitters": 4,
      "maxRingsPerEmitter": 8
    },
    "high": {
      "particles": 2048,
      "maxEmitters": 4,
      "maxRingsPerEmitter": 8
    }
  },
  "tests": {
    "verified": true,
    "evidence": [
      "scripts/test_shockwave_core.cjs",
      "scripts/test_shockwave_runtime.cjs",
      "scripts/test_shockwave_editor.cjs",
      "scripts/test_shockwave_anchors.cjs",
      "scripts/test_shockwave_anchor_editor.cjs",
      "scripts/test_shockwave_spine.cjs",
      "scripts/test_shockwave_atlas.cjs",
      "scripts/test_shockwave_export_ui.cjs",
      "scripts/test_shockwave_developer.cjs",
      "scripts/test_shockwave_developer_ui.cjs",
      "scripts/test_shockwave_developer_contract.cjs",
      "scripts/test_shockwave_catalog_evidence.cjs",
      "scripts/test_shockwave_skel.cjs"
    ],
    "required": [
      "Phase and independent layer pixels, all declared artist parameters and curves",
      "Real WebGL1/2/WebGPU, deterministic fixed-step PNG crop and alpha",
      "Matching Spine JSON/SKEL, multipage atlas; both built developer packages and fallback"
    ]
  },
  "outOfScope": [
    "Optional background refraction (distortion must remain 0; requires scene capture policy)",
    "Attachment anchors and full affine shear/reflection",
    "Physical mobile performance certification",
    "Spine versions outside 4.2"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "startRadius": "settings.startRadius",
      "finalRadius": "settings.finalRadius",
      "ringWidth": "settings.ringWidth",
      "edgeSoftness": "settings.edgeSoftness",
      "ringCount": "settings.ringCount",
      "ringDelayFrames": "settings.ringDelayFrames",
      "radialGapPx": "settings.radialGapPx",
      "arcGapPx": "settings.arcGapPx",
      "minIntervalFrames": "settings.minIntervalFrames",
      "timeJitter": "settings.timeJitter",
      "spatialJitter": "settings.spatialJitter",
      "seed": "settings.seed",
      "distribution": "settings.distribution",
      "quality": "settings.quality"
    },
    "preview": "python scripts/build_shockwave_editor.py --output <outside-repository>/Shockwave_Lab.html",
    "pngBake": "FxShockwaveExport.bakeSequence; isolated FxShockwaveBake scene; straight RGBA8 60Hz",
    "developerZip": "FxShockwaveExportBrowser.developer; pinned Vite packages",
    "invariant": "Same core/runtime in preview, bake and developer example"
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject"
  },
  "implementation": {
    "status": "reference-implementation",
    "sourceFiles": [
      "assets/shockwave/src/shockwave-core.js",
      "assets/shockwave/src/shockwave-runtime.js",
      "assets/shockwave/src/shockwave-editor.js",
      "assets/shockwave/src/shockwave-spine.js",
      "assets/shockwave/src/shockwave-export.js",
      "assets/shockwave/src/shockwave-bake.js",
      "assets/shockwave/src/shockwave-export-browser.js",
      "assets/shockwave/src/ui.html",
      "scripts/build_shockwave_editor.py"
    ],
    "notes": "Build outside source tree. Fixed durationFrames=40; distortion=0 reserved. JSON and genuine Spine 4.2.22 SKEL verified. No refraction, no attachment anchor. Catalog evidence covers phases and declared controls, separate regression suites cover editor/exports."
  }
}
```


## Reproduce acceptance

Use the pinned runtime; collect evidence outside the repository. The browser harness
requires Playwright/Chromium. Run the builder above, then for each actual backend
(webgl1, webgl2, webgpu) run:

    node scripts/test_shockwave_catalog_evidence.cjs <html> <backend> <empty-external-dir>

The report is checked with effect_validation.py --require-pass. On runtime baseline
106cabc4918ae1d9cb7165171c4490e0bdc4d4cd, all three backends passed 34 checks
each (3 phases, 14 parameters, 5 curves, palette, layers, backgrounds and backend).
Independent RGBA8 PNG decode counted 52 / 4148 / 0 visible pixels at 0 / 19.5 / 39
frames on each backend. All-disabled output had zero visible pixels. Quality
is verified by a real capacity rejection, not a claim of higher visual quality.

For the genuine binary regression, supply the external official Spine runtime
sample exports from EsotericSoftware/spine-runtimes commit
5cb78e77d3711ddcd80c7bd043bb11cf70fcc88c, examples/spineboy/export:
spineboy-pro.skel (Git blob 09e564b7edc42fe37be66a4a0391862071ed948a),
spineboy.atlas (eca542b711e7e140de85efac07b1bccbda07c5f5) and spineboy.png
(0ea9737f30707915e0bf495cdf987c6511dc0500). Respect upstream asset licensing;
the fixtures are not redistributed in this repository.

    node scripts/test_shockwave_skel.cjs <external-fixture-dir> <html>

Real 4.2.22 binary animation, visible/hidden PNG, repeat seek and both developer
ZIP asset-byte preservation passed. Earlier developer ZIP builds and actual
WebGL2/WebGPU fallback were verified in f0f085f. Desktop GPU acceptance is not
mobile performance certification; optional refraction and attachment anchors
remain excluded. The catalog report is a scoped visual/numeric audit, not a
substitute for the separate editor, Spine, runtime and export regression suites.
