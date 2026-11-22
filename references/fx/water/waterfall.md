# WATER-04 — Waterfall: continuous flowing streams, separated droplets and impact foam

An independently controllable and offline artist editor, not a feature baked into Water Splash, Rainfall or Water Ripples. The source marker and the foam/impact marker can be dragged independently within the **same preview canvas**. Translucent flowing strands, real droplet timing and sparse causal foam remain distinct in each layer.

## Versioned Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.water.waterfall",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "water",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "Independent WATER-04 seamless 60-frame looping falling waterfall ribbon sheet with eight true-arc-length water strands, flowing irregular edges, causal 30 fragment candidates/sec with breakup probability .4, and sparse non-opaque base spray/foam at stream impact endpoint. Optional separate 40-frame shutdown with final frame39 fully transparent. Source and base freely draggable independently and anchored to World/Spine4.2 bone/slot/attachment with per-layer isolation. StreamWidth75, speed180px/s, strands8, crosswise hard strandGap9px, breakupDistance14px measured along stream path, foamRadius45px, turbulence.35. Five distinct editing curves: sheetWidth pathPosition, flowTurbulence effectTime, sprayAlpha particleAge, fragmentRate effectTime, breakupDistance pathPosition. Three-stop editable RGBA #EDF9FF→#54BDE1→#1674AC, Natural/Stylized/Magical. Native Pixi8.22.0 MeshSimple pooled dynamic ribbons and ParticleContainer with true 32x32/64x64 texture pixel-size calibration (Particle scale is relative). Absolute seek with prior-cycle flight history >1 second, pre-allocated GPU buffers and strict Low/Balanced/High budgets. Offline 512px authoring, straight-alpha 60 PNG ZIP + both exact-source WebGL/WebGPU developer ZIPs with pinned Pixi8.22 Spine4.2.120 Vite7.1.12.",
  "phases": [
    {
      "id": "sustained",
      "at": 0,
      "look": "Already flowing translucent sheet at frame0, multiple uneven ribbons and ongoing prior-period droplets; not an empty initial frame or solid opaque block"
    },
    {
      "id": "fragmentation",
      "at": 0.5,
      "look": "Frame30 changing ribbon edge gaps, detached droplets moving downward while the same strand source and shared current impact coordinate remain in phase"
    },
    {
      "id": "impact",
      "at": 1,
      "look": "Cycle point 60/60 shows visible detached-drop collision and sparse translucent base spray/foam, and matches raster at 0; frame59 remains fully active"
    }
  ],
  "layers": [
    {
      "id": "streams",
      "kind": "geometry",
      "position": "separate world/local/Spine anchor, default inherit emitter",
      "purpose": "8 translucent uneven independently seeded falling ribbons built from FX-CORE-08 cubic path and direct 0.25px FxSpacing arc-length sampling; per-frame-advecting gaps and source attached to current Spine pose; pooled MeshSimple."
    },
    {
      "id": "fragments",
      "kind": "particles",
      "position": "separate world/local/Spine anchor, default inherit emitter",
      "purpose": "Droplets selected from true 30/s per-second temporal event schedule, breakup probability and real along-path arc-distance event positions; previous-period history preserved until impact; seeded pooled ParticleContainer."
    },
    {
      "id": "baseSprayFoam",
      "kind": "particles",
      "position": "default transformed stream path endpoint plus independent XY offset; optional detached world/Spine anchor",
      "purpose": "Sparse partial-alpha contact-generated foam beads and droplets; never an opaque solid circle/disc; separate source/base drag handles and blend/alpha controls."
    }
  ],
  "emitterAnchors": [
    {
      "id": "world",
      "space": "logical 512×512 px",
      "onMissing": "n/a"
    },
    {
      "id": "skeleton",
      "space": "Spine-skeleton-local",
      "onMissing": "hide only affected layer and report diagnostic"
    },
    {
      "id": "bone",
      "space": "Spine-bone-local",
      "onMissing": "hide only affected layer and report diagnostic"
    },
    {
      "id": "slot",
      "space": "Spine-slot-local",
      "onMissing": "hide only affected layer and report diagnostic"
    },
    {
      "id": "attachment",
      "space": "Spine active attachment centroid-local",
      "onMissing": "hide only affected layer and report diagnostic"
    },
    {
      "id": "inherit",
      "space": "current emitter anchored world pose and local offsets",
      "onMissing": "hide only affected layer if inherited emitter missing"
    },
    {
      "id": "endpoint",
      "space": "current transformed lower stream endpoint + per-layer XY offset",
      "onMissing": "hide only affected base layer when emitter anchor missing"
    }
  ],
  "parameters": [
    {
      "key": "streamWidth",
      "type": "number",
      "default": 75,
      "min": 12,
      "max": 250,
      "step": 1,
      "unit": "px",
      "controlGroup": "Sheet flow & geometry",
      "exportPath": "settings.streamWidth"
    },
    {
      "key": "flowSpeed",
      "type": "number",
      "default": 180,
      "min": 20,
      "max": 800,
      "step": 1,
      "unit": "px/s",
      "controlGroup": "Sheet flow & geometry",
      "exportPath": "settings.flowSpeed"
    },
    {
      "key": "strands",
      "type": "integer",
      "default": 8,
      "min": 1,
      "max": 40,
      "step": 1,
      "unit": "strands",
      "controlGroup": "Sheet flow & geometry",
      "exportPath": "settings.strands"
    },
    {
      "key": "breakup",
      "type": "number",
      "default": 0.4,
      "min": 0,
      "max": 1,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Sheet flow & geometry",
      "exportPath": "settings.breakup"
    },
    {
      "key": "foamRadius",
      "type": "number",
      "default": 45,
      "min": 0,
      "max": 140,
      "step": 1,
      "unit": "px",
      "controlGroup": "Sheet flow & geometry",
      "exportPath": "settings.foamRadius"
    },
    {
      "key": "turbulence",
      "type": "number",
      "default": 0.35,
      "min": 0,
      "max": 1,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Sheet flow & geometry",
      "exportPath": "settings.turbulence"
    },
    {
      "key": "strandGap",
      "type": "number",
      "default": 9,
      "min": 1,
      "max": 60,
      "step": 0.5,
      "unit": "crosswise strand center min gap px",
      "controlGroup": "Breakup and spatial event placement",
      "exportPath": "settings.strandGap"
    },
    {
      "key": "fragmentRate",
      "type": "number",
      "default": 30,
      "min": 0,
      "max": 120,
      "step": 1,
      "unit": "candidate events/second",
      "controlGroup": "Breakup and spatial event placement",
      "exportPath": "settings.fragmentRate"
    },
    {
      "key": "breakupDistance",
      "type": "number",
      "default": 14,
      "min": 2,
      "max": 120,
      "step": 0.5,
      "unit": "arc-length-px",
      "controlGroup": "Breakup and spatial event placement",
      "exportPath": "settings.breakupDistance"
    },
    {
      "key": "flowLength",
      "type": "number",
      "default": 300,
      "min": 60,
      "max": 400,
      "step": 1,
      "unit": "px",
      "controlGroup": "Sheet flow & geometry",
      "exportPath": "settings.flowLength"
    },
    {
      "key": "spatialJitter",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Breakup and spatial event placement",
      "exportPath": "settings.spatialJitter"
    },
    {
      "key": "exportFrames",
      "type": "integer",
      "default": 60,
      "min": 1,
      "max": 3600,
      "step": 1,
      "unit": "frames-at-60Hz",
      "controlGroup": "Time, seed and quality",
      "exportPath": "settings.exportFrames"
    },
    {
      "key": "seed",
      "type": "integer",
      "default": 94147,
      "min": -2147483648,
      "max": 2147483647,
      "step": 1,
      "unit": "signed-int32",
      "controlGroup": "Time, seed and quality",
      "exportPath": "settings.seed"
    },
    {
      "key": "mode",
      "type": "enum",
      "default": "loop",
      "choices": [
        "loop",
        "shutdown"
      ],
      "unit": "enum",
      "controlGroup": "Time, seed and quality",
      "exportPath": "settings.mode"
    },
    {
      "key": "spatialMode",
      "type": "enum",
      "default": "even",
      "choices": [
        "even",
        "random",
        "clustered"
      ],
      "unit": "enum",
      "controlGroup": "Breakup and spatial event placement",
      "exportPath": "settings.spatialMode"
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
      "unit": "enum",
      "controlGroup": "Time, seed and quality",
      "exportPath": "settings.quality"
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
      "unit": "enum",
      "controlGroup": "Artist style and gradient",
      "exportPath": "settings.style"
    }
  ],
  "controlGroups": [
    "Sheet flow & geometry",
    "Breakup and spatial event placement",
    "Time, seed and quality",
    "Artist style and gradient",
    "Independent emitter/layers and Spine"
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
      "id": "relative-sheet-width",
      "key": "sheetWidthCurve",
      "domain": "pathPosition",
      "contract": "curves"
    },
    {
      "id": "periodic-flow-turbulence",
      "key": "flowTurbulenceCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "base-spray-alpha-by-age",
      "key": "sprayAlphaCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "fragment-event-rate",
      "key": "fragmentRateCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "path-distance-fragment-gap",
      "key": "breakupDistanceCurve",
      "domain": "pathPosition",
      "contract": "curves"
    }
  ],
  "spacing": {
    "contract": "spacing",
    "temporal": "FxSpacing.createTemporalSchedule at 30 candidate events/sec by default (integrated 4096 midpoints with fragmentRate effectTime multiplier converted to emissionRate/emitterTime); first event shifted to period boundary as deterministic phase and 30 events exist over [0,1). Changing rate changes actual event timestamps and count, never only particle velocity.",
    "independentBreakup": "A candidate is accepted if stable indexed seeded RNG < breakup=.4. This changes actual detached count; breakup=0 gives zero particles and unbroken ribbons; explicit report distinguishes candidates vs accepted particles.",
    "crossStrandGap": "strandGap9 px is hard physical distance between neighboring strand centers; require (strands-1)*strandGap <= streamWidth. Any impossible combination fails with clear diagnostic, not hidden rescale.",
    "arcDistance": "breakupDistance14px is true FxSpacing spatial placement along open cubic source-to-impact path and fully independent of time schedule; FxPath.buildRibbon uses the same arc-length oracle and source-path curve; tolerance <=.25px cumulative, no equal-Bezier-t shortcuts.",
    "eventHistory": "flowLength300/flowSpeed180=1.667sec exceeds 1 sec loop. Sample sufficient prior cycles to carry accepted fragments/contact to impact across loop seam. Canonical t0 equals t=1 in numeric state and actual raster, no spontaneous reset.",
    "deformation": "Ribbons are advected via deterministic periodic sinusoidal offset proportional to turbulence and cyclic flowTurbulence curve; widthAt pathPosition and seeded breakup holes evolve in space/time, not static rectangle or fixed decorative rays.",
    "quality": "Low/Balanced/High enforce per-effect total vertices, triangles, droplets, foam and history counts. No silent clipping/allocations or unexplained fallback.",
    "coordinate": "512px logical local stream with y 0->flowLength, source anchor world by default (256,64), default impact y364. Independent base layer anchored to actual transformed current endpoint; base X/Y offset never alters the stream source. Camera zoom is preview-only."
  },
  "palettes": [
    {
      "id": "waterfall-three-stop-color",
      "key": "palette",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#EDF9FF",
        "#54BDE1",
        "#1674AC"
      ],
      "alpha": "Editable straight RGBA alpha per stop. Native MeshSimple shader uses procedural 256x32 age-gradated RGBA texture and feathered transverse edge; droplets/foam use semi-transparent pooled procedural textures with actual 32/64px-aware Particle scale. Normal/add blend per layer."
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "Each stable emitter ID/seed and strand/event index generates deterministic independent streams for drift, acceptance, foam and spatial jitter. No Math.random. Reordering emitters does not perturb siblings, seek/FPS has no stateful RNG progression."
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
    "strategy": "Pixi8.22 native MeshSimple with preallocated dynamic geometry buffers for each ribbon, shader-free in-place aPosition/aUV/indices updates (and stream alpha/palette procedural canvas texture). Pooled ParticleContainer detached soft droplets and sparse per-impact translucent foam, never a solid rectangular sheet or block. 32/64px texture footprint calibrated to Particle scale. Three layer-owned stage containers per emitter; source model and host preserved. Byte-identical UMD/ESM core+renderer in preview/developer ZIPs.",
    "alpha": "Straight RGBA8 512x512 with preserved partial-alpha RGB; WebGL output requires backend-aware unpremultiplication while WebGPU already straight. No CSS background or Spine source burned into PNG. No under-the-hood unapproved fallback.",
    "crop": "All configured geometry and particle radii verified inside 512x512 in every exported frame; explicit numeric extents and user-invoked Fit, no accidental trim.",
    "spine": "Actual Spine4.2.43 multipage JSON sample with 9 animations/bone/slot/attachment tracking; missing anchor hides only dependent layer. Binary .skel support inherits matching pinned runtime loader; fixture NOT RUN unless supplied.",
    "hardware": "Actual Chromium headless software paths WebGL1, WebGL2 and WebGPU; physical phone FPS/thermal/memory NOT RUN."
  },
  "qualityBudgets": {
    "low": {
      "maxRibbons": 40,
      "maxVertices": 12000,
      "maxTriangles": 15000,
      "maxParticles": 240,
      "maxFoam": 120,
      "maxCandidates": 2048,
      "maxEmitters": 4
    },
    "balanced": {
      "maxRibbons": 160,
      "maxVertices": 42000,
      "maxTriangles": 49000,
      "maxParticles": 480,
      "maxFoam": 240,
      "maxCandidates": 4096,
      "maxEmitters": 4
    },
    "high": {
      "maxRibbons": 160,
      "maxVertices": 80000,
      "maxTriangles": 90000,
      "maxParticles": 900,
      "maxFoam": 480,
      "maxCandidates": 4096,
      "maxEmitters": 4
    }
  },
  "tests": {
    "verified": true,
    "evidence": [
      "scripts/test_waterfall_core.cjs",
      "scripts/test_waterfall_mesh.cjs",
      "scripts/test_waterfall_smoke.cjs",
      "scripts/test_waterfall_editor.cjs",
      "scripts/test_waterfall_spine.cjs",
      "scripts/test_waterfall_roi.cjs",
      "scripts/test_waterfall_lifecycle.cjs",
      "scripts/test_waterfall_alpha.cjs",
      "scripts/test_waterfall_packages.cjs",
      "scripts/test_waterfall_png_zip.cjs",
      "scripts/test_waterfall_export.cjs",
      "scripts/test_waterfall_developer.cjs",
      "scripts/test_waterfall_evidence.cjs",
      "scripts/test_waterfall_drag_zoom.cjs",
      "scripts/test_waterfall_repeat_zip.cjs"
    ],
    "required": [
      "60f exact state and PNG seam at time0/time1, moving real flowing ribbons and prior-cycle history of drops >1sec, f59 visible, separate 40f shutdown f39 alpha0",
      "Seamless periodic 8 strand sheet with native MeshSimple moving path and Pool stable after one warmup cycle on actual WebGL1/WebGL2/WebGPU",
      "All 17 declared parameters and all 5 timeline/path curves cause actual decoded 512px PNG pixels or explicit independent numeric export/quality/mode events",
      "Source and bottom impact coordinates editable/drag independently, foam only at actual causal contacts, breakup0 makes 0 detached droplets and uninterrupted ribbons",
      "Each layer own world/local/Spine4.2 skeleton/bone/slot/attachment or endpoint anchor; missing hide only that layer and no caller-owned source destruction",
      "True integrated time schedule 30/s and independent 14px physical arc path spacing, explicit impossible strand width/gap errors and global budgets",
      "No opaque foam disc, no hidden background/Spine/DOM handle, valid straight RGBA8 on WebGL1/2/WebGPU including semitransparent RGB/channel PMA tests",
      "Full 60 PNG ZIP independently decoded and CRC-tested, two developer Vite builds and real animated WebGL/WebGPU browsers; zero remote network requests",
      "FX-CORE-07 screenshot hash/parameter/phase/backend/sourceCommit evidence independently validated after push; exact protected Burn8 hashes/30 controls and previous regressions",
      "Both viewport source and impact drag targets at 50/100/200 percent zoom alter independent correct logical coordinates; two consecutive same-backend complete 60-frame PNG ZIP exports are byte-for-byte identical."
    ]
  },
  "outOfScope": [
    "No physically realistic Navier–Stokes liquid simulation, full volumetric refraction, general water material engine or 3D fluid interaction",
    "No generic FX graph editor or second WATER-01/02/03 route; existing effects/source/HTML untouched",
    "No PixiJS/Spine runtime upgrades, external required shader library or runtime online assets",
    "No perpetual world-detached drops after moving Spine anchor without extra physical transform history; follow current pose",
    "No physical mobile GPU FPS or thermals; external binary .skel validation until matching fixture is available",
    "No requirement to make shutdown 40-frame mode seamless; it is separate from default continuous loop"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "streamWidth": "settings.streamWidth",
      "flowSpeed": "settings.flowSpeed",
      "strands": "settings.strands",
      "breakup": "settings.breakup",
      "foamRadius": "settings.foamRadius",
      "turbulence": "settings.turbulence",
      "strandGap": "settings.strandGap",
      "fragmentRate": "settings.fragmentRate",
      "breakupDistance": "settings.breakupDistance",
      "flowLength": "settings.flowLength",
      "spatialJitter": "settings.spatialJitter",
      "exportFrames": "settings.exportFrames",
      "seed": "settings.seed",
      "mode": "settings.mode",
      "spatialMode": "settings.spatialMode",
      "quality": "settings.quality",
      "style": "settings.style"
    },
    "preview": "assets/Waterfall_Lab.html",
    "pngBake": "WaterfallExports.bake, 60 default real straight-alpha RGBA8 512x512 PNG frames frames/0000..0059 + sequence.json 0..59/60, explicit shutdown40 alpha0 at f39, full crop and cancellation",
    "developerZip": "WaterfallExports.buildPackage webgl/webgpu, exact FxCurves/FxSpacing/FxPath/FxColors/FxTimeline and FxWaterfall/Waterfall source with pinned PixiJS8.22 Spine4.2.120 Vite7.1.12 plus licenses/assets",
    "invariant": "Exact UMD source bytes embedded in editor and two ESM ZIP wrappers; same event schedule/ribbon/particle renderer; no CSS/camera or Spine mesh baked."
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject"
  },
  "implementation": {
    "status": "reference-implementation",
    "sourceFiles": [
      "assets/waterfall/src/waterfall-core.js",
      "assets/waterfall/src/waterfall-runtime.js",
      "assets/waterfall/src/waterfall-editor.js",
      "assets/waterfall/src/waterfall-export.js",
      "assets/waterfall/src/zip-core.js",
      "assets/waterfall/src/ui.html",
      "assets/Waterfall_Lab.html",
      "scripts/build_waterfall_editor.py"
    ],
    "notes": "WATER-04 separate water flow effect; source vs transformed base endpoint and three independent layers, 60f seamless default / 40f shutdown, actual backend-native Pixi MeshSimple+ParticleContainer, 17 artist parameters and five curves, full 60 PNG + two Vite developer ZIPs. FX-CORE-07 reports regen after push to published SHA."
  }
}
```

## RED→GREEN / release gate

Use `python scripts/build_waterfall_editor.py --output assets/Waterfall_Lab.html`, numerical `test_waterfall_core.cjs`, real `test_waterfall_mesh.cjs webgl1|webgl2|webgpu`, all `test_waterfall_editor.cjs` backend modes, matching Spine JSON multipage, ROI/cancellation/PMA/PNG ZIP CRC, actual Vite/WebGL/WebGPU developer demos, Blueprint router and FX-CORE-07 evaluator after published SHA. Do **not** mark external .skel binary fixture, physical mobile GPU FPS or thermal testing as PASS when absent.
