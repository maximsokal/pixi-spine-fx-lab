# WATER-03 — Water Ripples: 40-frame one-shot and optional cyclic expanding surface waves

Water Ripples is **not** the optional ring of Water Splash. It is an independent editor with three independently anchored primary/secondary/highlight layers, strict ring births 0/7/14 (default), ring-spacing distinct from timing and optional highlight arc-spacing, translucent wave color and source-matched WebGL/WebGPU exports.

## Versioned Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.water.water-ripples",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "water",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "40-frame, 60fps 512px one-shot expanding concentric elliptical water surface rings. Three default waves: first births t0/7/60/14/60, global terminal fade last 6 frames, frame39 exactly alpha0; optional cyclic 40-frame impacts reconstruct previous-cycle ripple groups rather than restarting all waves. Default 3 rings, initial radius5, first ring base final radius120, 20px radial index gap, 3px thickness and ellipticity1 (rX/rY ratio). Distinct ring-delay (time), ring-gap (radius), highlight arc-gap (FxSpacing true arc-length) and four editable curves. Three independently source-anchored layers primary/secondary/optional highlights. Pinned Pixi8.22.0 MeshSimple preallocated annulus geometry, 32x128 internal age+radial-alpha gradient texture, source-normal thickness and strict bounds. Offline editor, 40 real isolated straight-alpha RGBA PNGs and two exact-source WebGL/WebGPU developer ZIPs; actual Pixi backends verified and no Burn controls.",
  "phases": [
    {
      "id": "start",
      "at": 0,
      "look": "Frame0 narrow primary ring at startRadius 5px, visible low-alpha surface circle, no late ring or unrelated FX"
    },
    {
      "id": "expansion",
      "at": 0.5,
      "look": "Frame20 several expanding separated rings, decreasing thickness and editable fading alpha; independently delayed ring births"
    },
    {
      "id": "transparent",
      "at": 1,
      "look": "Last included frame39 fully transparent; f38 still fading. One-shot has no abrupt post39 restart"
    }
  ],
  "layers": [
    {
      "id": "primary",
      "kind": "geometry",
      "position": "independent-local-world-or-Spine-anchored",
      "purpose": "First ring from exact t0, independently enabled, moved, rotated, faded and anchored. Native soft-edged annulus MeshSimple with pooled vertex buffers."
    },
    {
      "id": "secondary",
      "kind": "geometry",
      "position": "independent-local-world-or-Spine-anchored",
      "purpose": "Additional delayed rings from true scheduler, default births f7/f14, optionally color-alpha attenuation, own anchor/timing/visibility."
    },
    {
      "id": "highlights",
      "kind": "particles",
      "position": "independent-local-world-or-Spine-anchored",
      "purpose": "OPTIONAL seeded tiny tangent-oriented short mesh strokes on true ellipse arc, angular arc-placement from FxSpacing 0.25px cumulative tolerance; OFF by default."
    }
  ],
  "emitterAnchors": [
    {
      "id": "world",
      "space": "world",
      "onMissing": "n/a"
    },
    {
      "id": "skeleton",
      "space": "Spine-skeleton-local",
      "onMissing": "hide only affected source layer and diagnose"
    },
    {
      "id": "bone",
      "space": "Spine-bone-local",
      "onMissing": "hide only affected source layer and diagnose"
    },
    {
      "id": "slot",
      "space": "Spine-slot-local",
      "onMissing": "hide only affected source layer and diagnose"
    },
    {
      "id": "attachment",
      "space": "Spine-active-attachment-centroid-local",
      "onMissing": "hide only affected source layer and diagnose"
    },
    {
      "id": "inherit",
      "space": "current emitter anchor+layer offsets",
      "onMissing": "hide only inherited layers if emitter anchor is missing"
    }
  ],
  "parameters": [
    {
      "key": "rings",
      "type": "integer",
      "default": 3,
      "min": 1,
      "max": 12,
      "step": 1,
      "unit": "rings",
      "controlGroup": "Concentric waves",
      "exportPath": "settings.rings"
    },
    {
      "key": "startRadius",
      "type": "number",
      "default": 5,
      "min": 0,
      "max": 90,
      "step": 0.5,
      "unit": "px",
      "controlGroup": "Concentric waves",
      "exportPath": "settings.startRadius"
    },
    {
      "key": "finalRadius",
      "type": "number",
      "default": 120,
      "min": 20,
      "max": 350,
      "step": 0.5,
      "unit": "base-ring-radius-px",
      "controlGroup": "Concentric waves",
      "exportPath": "settings.finalRadius"
    },
    {
      "key": "ringDelayFrames",
      "type": "integer",
      "default": 7,
      "min": 0,
      "max": 60,
      "step": 1,
      "unit": "frames",
      "controlGroup": "Concentric waves",
      "exportPath": "settings.ringDelayFrames"
    },
    {
      "key": "radialGapPx",
      "type": "number",
      "default": 20,
      "min": 1,
      "max": 90,
      "step": 0.5,
      "unit": "radial-ring-center-gap-px",
      "controlGroup": "Concentric waves",
      "exportPath": "settings.radialGapPx"
    },
    {
      "key": "thickness",
      "type": "number",
      "default": 3,
      "min": 0.5,
      "max": 20,
      "step": 0.25,
      "unit": "normal-width-px",
      "controlGroup": "Concentric waves",
      "exportPath": "settings.thickness"
    },
    {
      "key": "ellipticity",
      "type": "number",
      "default": 1,
      "min": 0.2,
      "max": 3,
      "step": 0.05,
      "unit": "ratio-rX-to-rY",
      "controlGroup": "Concentric waves",
      "exportPath": "settings.ellipticity"
    },
    {
      "key": "highlightArcGapPx",
      "type": "number",
      "default": 20,
      "min": 1,
      "max": 90,
      "step": 0.5,
      "unit": "arc-length-px",
      "controlGroup": "Optional highlights",
      "exportPath": "settings.highlightArcGapPx"
    },
    {
      "key": "highlightJitter",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Optional highlights",
      "exportPath": "settings.highlightJitter"
    },
    {
      "key": "exportFrames",
      "type": "integer",
      "default": 40,
      "min": 1,
      "max": 3600,
      "step": 1,
      "unit": "frames-at-60Hz",
      "controlGroup": "Timeline and quality",
      "exportPath": "settings.exportFrames"
    },
    {
      "key": "seed",
      "type": "integer",
      "default": 83291,
      "min": -2147483648,
      "max": 2147483647,
      "step": 1,
      "unit": "signed-int32",
      "controlGroup": "Timeline and quality",
      "exportPath": "settings.seed"
    },
    {
      "key": "loop",
      "type": "boolean",
      "default": false,
      "unit": "enabled",
      "controlGroup": "Timeline and quality",
      "exportPath": "settings.loop"
    },
    {
      "key": "highlightDistribution",
      "type": "enum",
      "default": "even",
      "choices": [
        "even",
        "stratified",
        "random",
        "clustered"
      ],
      "unit": "enum",
      "controlGroup": "Optional highlights",
      "exportPath": "settings.highlightDistribution"
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
      "controlGroup": "Timeline and quality",
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
      "controlGroup": "Artist style and color",
      "exportPath": "settings.style"
    }
  ],
  "controlGroups": [
    "Concentric waves",
    "Optional highlights",
    "Timeline and quality",
    "Artist style and color",
    "Independent emitters and layers"
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
      "id": "emission-age-radius",
      "key": "radiusCurve",
      "domain": "emitterTime",
      "contract": "curves"
    },
    {
      "id": "wave-age-thickness",
      "key": "thicknessCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "wave-age-alpha",
      "key": "ringAlphaCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "emitter-time-interval",
      "key": "ringDelayCurve",
      "domain": "emitterTime",
      "contract": "curves"
    }
  ],
  "spacing": {
    "contract": "spacing",
    "temporal": "FxSpacing.createTemporalSchedule custom integrated interval multiplier on emitterTime, base interval ringDelayFrames/60; first ring at exact t0, default second/third at f7/f14. When delay=0, simultaneous stable IDs from index0..rings-1. Missing events over f39 cause explicit user-visible validation rejection, never silent truncation.",
    "radial": "Physical radius on ring i at its own normalized age u: startRadius + i*radialGapPx + (finalRadius-startRadius)*radiusCurve(u). Gap is a separate radial offset, not the emission interval or arc-length spacing. finalRadius is base ring target; later rings add index gap. If finalRadius<=startRadius, reject.",
    "ellipse": "ellipticity rX/rY fixed, rX=r*sqrt(ellipticity),rY=r/sqrt(ellipticity), constant geometric mean ring radius. Thickness is true Euclidean px along ellipse outward normal.",
    "highlights": "Optional independent highlightArcGapPx (default20) uses FxSpacing.createSpatialPlacement on closed four cubic Bezier ellipse, globally bounded 0.25px true cumulative arc-length tolerance, no repeated seam anchor. Four placement modes even/random/stratified/clustered and independent seeded jitter. Hidden controls disabled when highlights off.",
    "fps": "Absolute sampling at 60 Hz independent of browser frames; 30/60/120 FPS, backward seek, frame modulo only for cyclic mode.",
    "caps": "Low/Balanced/High hard limits on mesh vertices, active rings, pooled highlights across max 4 emitters; reject rather than silently clip ring counts."
  },
  "palettes": [
    {
      "id": "water-ripple-color",
      "key": "palette",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#E2FAFF",
        "#5BBED5"
      ],
      "alpha": "Editable straight RGBA stops per ring-age, multiplied by ringAlphaCurve, per-layer opacity, stable seed and one-shot terminal envelope; RGB encoded in pooled 32x128 age lookup texture with radial-alpha feather to preserve accurate WebGPU straight RGB."
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "No Math.random. Stable independent emitter IDs/seeds, per-ring index and historical cycle; highlight placement derives seed per emitter and ring only; no changes to sibling positions when emitters are reordered."
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
    "strategy": "All visible rings and optional tangent highlights are native Pixi MeshSimple, each with stable MeshGeometry vertices/UVs/indices and explicit position+UV buffer update on absolute seek. Three independent layer stage surfaces, source ID and per-layer world/skeleton/bone/slot/attachment anchor resolution and missing-only-layer diagnostics. One pooled procedural color-by-age x alpha-by-normal-distance 32x128 texture per palette/style (replaced only on authoring change), never per-frame Graphics.clear, custom WGSL or runtime network. Quality changes explicitly reallocate segment pools.",
    "alpha": "One-shot frame0 visible, f38 still visible and f39 alpha0; cyclic group history yields exact t=0 and t=40/60 same state. 512x512 straight RGBA8 transparent PNG with verified backend-aware PMA conversion: Pixi8.22 WebGL premultiplied readback, WebGPU straight. No Photoshop/overlay/Spine model in export.",
    "crop": "All enabled ring geometry finite and checked at each of 40 frames; prevent unnoticed horizontal/vertical cropping and offer deliberate Fit action. Current logical center world(256,256).",
    "spine": "Matching Spine4.2.x JSON or binary and multipage atlas supported by loader; actual JSON two-page animation + live bone/slot/attachment validated; missing layer anchor hides only that layer; no past physical world-release simulation.",
    "hardware": "Chromium headless renderer status and decoded PNG prove actual WebGL1/2/WebGPU code path, not mobile physical GPU FPS/thermals."
  },
  "qualityBudgets": {
    "low": {
      "maxRings": 48,
      "maxVertices": 12000,
      "maxHighlights": 192,
      "segmentsPerRing": 48,
      "maxEmitters": 4
    },
    "balanced": {
      "maxRings": 48,
      "maxVertices": 42000,
      "maxHighlights": 480,
      "segmentsPerRing": 96,
      "maxEmitters": 4
    },
    "high": {
      "maxRings": 48,
      "maxVertices": 80000,
      "maxHighlights": 960,
      "segmentsPerRing": 160,
      "maxEmitters": 4
    }
  },
  "tests": {
    "verified": true,
    "evidence": [
      "scripts/test_ripples_core.cjs",
      "scripts/test_ripples_mesh.cjs",
      "scripts/test_ripples_editor.cjs",
      "scripts/test_ripples_spine.cjs",
      "scripts/test_ripples_roi.cjs",
      "scripts/test_ripples_lifecycle.cjs",
      "scripts/test_ripples_alpha.cjs",
      "scripts/test_ripples_packages.cjs",
      "scripts/test_ripples_png_zip.cjs",
      "scripts/test_ripples_export.cjs",
      "scripts/test_ripples_developer.cjs",
      "scripts/test_ripples_evidence.cjs",
      "scripts/test_ripples_color_canary.cjs"
    ],
    "required": [
      "Actual f0/20/38/39 GPU imagery, one-shot f39 exactly alpha0 and loop t0↔40/60 identical without resetting prior ripple histories.",
      "FxSpacing births f0/7/14 and independent scalar ringGap vs temporal delay, 0-delay simultaneous stable ring indices, unsupported 12*60 timeline explicitly rejects.",
      "Each of all 15 declared parameter controls causes actual real backend PNG or validated numeric quality/export change, plus all four editable curves and RGBA stops.",
      "Ellipticity geometric-mean radius preserves shape; constant ring width along outward normal and feathered alpha no holes/canvas center fill.",
      "Three layer-specific world/spine anchors, separate transforms/alpha/blend/time, max 4 seed-isolated emitters, missing anchor hides only affected layer.",
      "True Pixi MeshSimple on actual WebGL1/WebGL2/WebGPU with same source and bounded no-per-frame mesh allocations.",
      "40 PNG frames at 512x512 RGBA8 straight-alpha, CRC and manifest timestamps 0..39/60, no false background/camera pixels or PMA black/double-unpremultiply white.",
      "Both exact-source ESM developer Vite builds, real browser animations and offline no-HTTP outside localhost, protected original Burn8 hashes/30 controls and existing effects regressions.",
      "FX-CORE-07 per-phase + per-parameter JSON evidence with actual PNG SHA-256 and published full 40-digit commit, independently validated by schema."
    ]
  },
  "outOfScope": [
    "No arbitrary fluid dynamics, collision reflection, wet surfaces, 3D volume, background refraction or screen-wide water shader",
    "No generic all-effects editor, renamed WATER-01 single ripple or WATER-02 rainfall physics",
    "No changing pinned Pixi/Spine/Vite/graphics filters or protected FIRE/WATER-01/02 implementations",
    "No requirement for seamless 40f one-shot restart; cyclic mode is an explicit separate mode with pre-roll",
    "No world-history detached emission from moving Spine bones; layer anchors follow current pose",
    "No assumed physical phone GPU FPS or thermals or unprovided external binary .skel validation"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "rings": "settings.rings",
      "startRadius": "settings.startRadius",
      "finalRadius": "settings.finalRadius",
      "ringDelayFrames": "settings.ringDelayFrames",
      "radialGapPx": "settings.radialGapPx",
      "thickness": "settings.thickness",
      "ellipticity": "settings.ellipticity",
      "highlightArcGapPx": "settings.highlightArcGapPx",
      "highlightJitter": "settings.highlightJitter",
      "exportFrames": "settings.exportFrames",
      "seed": "settings.seed",
      "loop": "settings.loop",
      "highlightDistribution": "settings.highlightDistribution",
      "quality": "settings.quality",
      "style": "settings.style"
    },
    "preview": "assets/Water_Ripples_Lab.html",
    "pngBake": "RipplesExports.bake: 40 default 512px straight RGBA8 PNG frames + sequence.json; 0..38 visible, 39 exactly transparent one-shot; optional cycle old-wave carry, cancellation/CRC, all-frame ROI check.",
    "developerZip": "RipplesExports.buildPackage webgl/webgpu, exact FxRipples.mjs+WaterRipples.mjs source and shared versioned FxCurves/Spacing/Colors/Timeline with pinned Pixi8.22 Spine4.2.120 Vite7.1.12 and licenses",
    "invariant": "Identical pure FxRipples numerical and native MeshSimple renderer code in offline app and both ESM developer ZIPs, no hidden alpha/CSS/camera dependency."
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject"
  },
  "implementation": {
    "status": "reference-implementation",
    "sourceFiles": [
      "assets/water-ripples/src/ripples-core.js",
      "assets/water-ripples/src/ripples-runtime.js",
      "assets/water-ripples/src/ripples-editor.js",
      "assets/water-ripples/src/ripples-export.js",
      "assets/water-ripples/src/zip-core.js",
      "assets/water-ripples/src/ui.html",
      "assets/Water_Ripples_Lab.html",
      "scripts/build_ripples_editor.py"
    ],
    "notes": "WATER-03 separate genuine concentric ripple FX Lab. One-shot40f with f39 empty, optional cyclic carry, world/Spine anchors per layer, four independent curves and radial/arc/time spacing, bounded native Pixi 8.22 MeshSimple and exact-source export. SourceCommit must be regenerated after push."
  }
}
```

## Commands and release gate

Run `python scripts/build_ripples_editor.py --output assets/Water_Ripples_Lab.html` and `node scripts/test_ripples_core.cjs`, `node scripts/test_ripples_mesh.cjs webgl1|webgl2|webgpu`, `node scripts/test_ripples_editor.cjs webgl1|webgl2|webgpu`; then PNG ZIP CRC, package ESM parity, real Vite browser demo, Spine, ROI, cancellation, PNG alpha, FX-CORE-07 report validator, protected hashes and legacy core regressions. The binary .skel fixture and hardware mobile FPS remain NOT RUN until real fixtures exist. Never claim PASS with only a bundle compile.
