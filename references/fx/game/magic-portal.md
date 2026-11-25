# Magic Portal

GAME-06 / #45. Independent offline editor. Default 120-frame loop, optional one-shot. Warp is surface-only, not background refraction. Use world/local/bone anchors. Quality is a capacity guard. Particle lifetime cannot exceed duration. Burst delay must fit between triggers. Loop speed is quantized to a nonzero 180-degree multiple when requested rotation is nonzero.

    python scripts/build_portal_editor.py --output ../MagicPortal.html

## Machine-checkable Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.game.magic-portal",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "game",
  "styles": [
    "stylized",
    "magical"
  ],
  "visualGoal": "Luminous twofold rotating polar aperture, independent rim and diamond runes, orbiting particles. Default 120-frame seamless loop; optional one-shot open/close, 60 FPS, 512 logical px.",
  "phases": [
    {
      "id": "opening",
      "at": 0,
      "look": "One-shot exact transparent initial frame"
    },
    {
      "id": "steady",
      "at": 0.5,
      "look": "Open luminous aperture, rim and particle orbit"
    },
    {
      "id": "closing",
      "at": 1,
      "look": "One-shot exact transparent final frame"
    }
  ],
  "layers": [
    {
      "id": "aperture",
      "kind": "geometry",
      "position": "Independent world/local/bone or inherited emitter anchor",
      "purpose": "Polar swirling inner surface"
    },
    {
      "id": "rim",
      "kind": "geometry",
      "position": "Independent world/local/bone or inherited emitter anchor",
      "purpose": "Polar rim and diamond runes"
    },
    {
      "id": "particles",
      "kind": "geometry",
      "position": "Independent world/local/bone or inherited emitter anchor",
      "purpose": "Seeded orbiting particle accents"
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
      "default": 120,
      "min": 2,
      "max": 3600,
      "step": 1,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.durationFrames"
    },
    {
      "key": "portalRadius",
      "type": "number",
      "default": 90,
      "min": 15,
      "max": 300,
      "step": 0.5,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.portalRadius"
    },
    {
      "key": "rimWidth",
      "type": "number",
      "default": 14,
      "min": 1,
      "max": 70,
      "step": 0.5,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.rimWidth"
    },
    {
      "key": "swirlSpeed",
      "type": "number",
      "default": 120,
      "min": -720,
      "max": 720,
      "step": 1,
      "unit": "deg/s",
      "controlGroup": "Effect",
      "exportPath": "settings.swirlSpeed"
    },
    {
      "key": "particleRate",
      "type": "number",
      "default": 30,
      "min": 0,
      "max": 240,
      "step": 0.1,
      "unit": "1/s",
      "controlGroup": "Effect",
      "exportPath": "settings.particleRate"
    },
    {
      "key": "particleLifetimeFrames",
      "type": "integer",
      "default": 36,
      "min": 1,
      "max": 3600,
      "step": 1,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.particleLifetimeFrames"
    },
    {
      "key": "spacing",
      "type": "number",
      "default": 13,
      "min": 2,
      "max": 80,
      "step": 0.1,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.spacing"
    },
    {
      "key": "minGapPx",
      "type": "number",
      "default": 2,
      "min": 2,
      "max": 80,
      "step": 0.1,
      "unit": "px",
      "controlGroup": "Effect",
      "exportPath": "settings.minGapPx"
    },
    {
      "key": "maxGapPx",
      "type": "number",
      "default": 80,
      "min": 2,
      "max": 80,
      "step": 0.1,
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
      "key": "intervalFrames",
      "type": "number",
      "default": 2,
      "min": 0.25,
      "max": 3600,
      "step": 0.01,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.intervalFrames"
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
      "key": "groupCount",
      "type": "integer",
      "default": 1,
      "min": 1,
      "max": 8,
      "step": 1,
      "unit": "count",
      "controlGroup": "Effect",
      "exportPath": "settings.groupCount"
    },
    {
      "key": "groupDelayFrames",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 3600,
      "step": 0.01,
      "unit": "frames",
      "controlGroup": "Effect",
      "exportPath": "settings.groupDelayFrames"
    },
    {
      "key": "glow",
      "type": "number",
      "default": 0.7,
      "min": 0,
      "max": 2,
      "step": 0.01,
      "unit": "multiplier",
      "controlGroup": "Effect",
      "exportPath": "settings.glow"
    },
    {
      "key": "warp",
      "type": "number",
      "default": 0.4,
      "min": 0,
      "max": 1,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Effect",
      "exportPath": "settings.warp"
    },
    {
      "key": "seed",
      "type": "integer",
      "default": 4106,
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
      "id": "apertureCurve",
      "key": "apertureCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "swirlCurve",
      "key": "swirlCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "rimCurve",
      "key": "rimCurve",
      "domain": "pathPosition",
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
    },
    {
      "id": "alphaCurve",
      "key": "alphaCurve",
      "domain": "particleAge",
      "contract": "curves"
    }
  ],
  "spacing": {
    "contract": "spacing",
    "temporal": "Independent seeded rate/interval schedule; group delay must fit between triggers. Signed swirl phase never changes event clock. Minimum interval applies to triggers, not simultaneous group members.",
    "spatial": "Closed cubic circle approximation, arc length placement with min/max spacing and seeded jitter; final seam enforces minimum gap."
  },
  "palettes": [
    {
      "id": "portal-rgba",
      "key": "palette",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#E0B2FF",
        "#9955DE",
        "#432075"
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
    "strategy": "Native GLSL/WGSL polar meshes and reusable Graphics accents; isolated world-aligned 512px tiled PNG raster; same core/runtime in preview and developer packages."
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
    "verified": true,
    "evidence": [
      "scripts/test_portal_core.cjs",
      "scripts/test_portal_runtime.cjs",
      "scripts/test_portal_runtime_contract.cjs",
      "scripts/test_portal_editor.cjs",
      "scripts/test_portal_spine.cjs",
      "scripts/test_portal_spine_contract.cjs",
      "scripts/test_portal_bake_contract.cjs",
      "scripts/test_portal_export_contract.cjs",
      "scripts/test_portal_export_ui.cjs",
      "scripts/test_portal_developer.cjs",
      "scripts/test_portal_developer_ui.cjs",
      "scripts/test_portal_developer_contract.cjs",
      "scripts/test_portal_catalog_evidence.cjs",
      "scripts/test_portal_skel.cjs"
    ],
    "required": [
      "One-shot phases and exact loop seam; independent layers; all declared parameters and curves",
      "Real WebGL1/2/WebGPU, straight RGBA8 crop and alpha",
      "Spine JSON/SKEL and multipage atlas; both built developer packages and fallback"
    ]
  },
  "outOfScope": [
    "Optional scene-background refraction; warp is self-warp only",
    "Slot/attachment anchors and exact reflection/shear/nonuniform affine transforms",
    "Physical mobile and max-size bake performance certification",
    "Spine versions outside 4.2"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "durationFrames": "settings.durationFrames",
      "portalRadius": "settings.portalRadius",
      "rimWidth": "settings.rimWidth",
      "swirlSpeed": "settings.swirlSpeed",
      "particleRate": "settings.particleRate",
      "particleLifetimeFrames": "settings.particleLifetimeFrames",
      "spacing": "settings.spacing",
      "minGapPx": "settings.minGapPx",
      "maxGapPx": "settings.maxGapPx",
      "spatialJitter": "settings.spatialJitter",
      "intervalFrames": "settings.intervalFrames",
      "timeJitter": "settings.timeJitter",
      "minIntervalFrames": "settings.minIntervalFrames",
      "groupCount": "settings.groupCount",
      "groupDelayFrames": "settings.groupDelayFrames",
      "glow": "settings.glow",
      "warp": "settings.warp",
      "seed": "settings.seed",
      "mode": "settings.mode",
      "distribution": "settings.distribution",
      "frequencySource": "settings.frequencySource",
      "quality": "settings.quality"
    },
    "preview": "python scripts/build_portal_editor.py --output <outside-repository>/MagicPortal.html",
    "pngBake": "FxPortalExport.bakeSequence; world-aligned tiled FxPortalBake; straight RGBA8 60Hz",
    "developerZip": "FxPortalExportBrowser.developer; pinned Vite packages",
    "invariant": "Same core/runtime in preview, bake and developer example"
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject"
  },
  "implementation": {
    "status": "reference-implementation",
    "sourceFiles": [
      "assets/magic-portal/src/portal-core.js",
      "assets/magic-portal/src/portal-runtime.js",
      "assets/magic-portal/src/portal-editor.js",
      "assets/magic-portal/src/portal-spine.js",
      "assets/magic-portal/src/portal-export.js",
      "assets/magic-portal/src/portal-bake.js",
      "assets/magic-portal/src/portal-export-browser.js",
      "assets/magic-portal/src/ui.html",
      "scripts/build_portal_editor.py"
    ],
    "notes": "Loop always open, requested speed quantized to 180 degree total rotation; one-shot uses aperture curve and exact blank endpoints. Particle lifetime <= durationFrames. Quality limits conservative reserved primitives; no scene refraction or attachment anchors. Independent runtime and editor; catalog evidence is scoped."
  }
}
```


## Reproduce acceptance

Build the offline HTML outside the repository. With Playwright and Chromium
available, run the following once per actual backend (webgl1, webgl2, webgpu):

    node scripts/test_portal_catalog_evidence.cjs <html> <backend> <empty-external-dir>

The report is validated against the catalog using
scripts/effect_validation.py --require-pass. Baseline runtime commit
5d9d37a7d1652cf091df1e94cf32d9a112867042: 45/45 checks per backend (135 total).
22 declared top-level artist controls and seven curves plus palette have
numerical witnesses, independently enabled/muted layers have decoded PNG
witnesses, and exact nonblank loop-seam PNG equality is verified. One-shot
opening and closing are intentionally transparent. Three real preview
backgrounds have screenshot witnesses. Quality changes capacity, not raster
quality. The loop aperture intentionally ignores the open curve; the one-shot
witness exercises it. Swirl speed is tested in one-shot to avoid loop
quantization masking a valid parameter change. Separate UI/core/export
regressions cover emitter transforms, drag, transport, skin and rollback.

The genuine binary regression uses external official runtime sample assets from
EsotericSoftware/spine-runtimes commit 5cb78e77d3711ddcd80c7bd043bb11cf70fcc88c,
examples/spineboy/export: spineboy-pro.skel (Git blob
09e564b7edc42fe37be66a4a0391862071ed948a), spineboy.atlas
(eca542b711e7e140de85efac07b1bccbda07c5f5), spineboy.png
(0ea9737f30707915e0bf495cdf987c6511dc0500). Respect upstream asset licenses;
these fixtures are not redistributed.

    node scripts/test_portal_skel.cjs <external-fixture-dir> <html>

Actual Spine 4.2.22 binary animation, visible/hidden source PNG, repeat seek
and exact original bytes in both developer ZIPs passed on desktop. Earlier
actual Vite builds and WebGL2/WebGPU/fallback runs with JSON passed in 5d9d37a.
A separate rebuilt SKEL developer example is not certified. No mobile/max-size
performance certification. Optional scene refraction and attachment anchors
remain excluded; exact affine transforms are not claimed. The previously
reported one-sided/stepped rim-curve seam interpretation remains a separate
edge case, not resolved by this acceptance slice.
