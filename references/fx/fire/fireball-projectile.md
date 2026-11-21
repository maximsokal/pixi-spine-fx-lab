# FIRE-03 — Fireball Projectile: editable motion-aware FX Lab

Independent 60fps, 512×512 editor with source-backed FxPath ribbons, real FxSpacing time/distance/both trail events, deterministic seeking, five separate layers, explicit one-shot/loop and a passive impact-ready event. **Heat haze is an optional stylized contour, not a physically correct refraction filter.**

## Versioned FX Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.fire.fireball-projectile",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "fire",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "Editable head traverses a two-cubic Bezier at true arc-speed, with independently tapered history-following flame ribbon, time/distance/both scheduled glowing residue, detached sparks and optional explicitly stylized heat shimmer. Spawn, curved flight, terminal fade/impact-ready event.",
  "phases": [
    {
      "id": "launch",
      "at": 0,
      "look": "Immediately visible hot ball at first frame, with no stationary ghost ribbon"
    },
    {
      "id": "flight",
      "at": 0.25,
      "look": "Moving glowing core sheds curved tapered tail and seeded sparks"
    },
    {
      "id": "turn",
      "at": 0.5,
      "look": "Arcing projectile with a lagging continuous ribbon; head tangent remains independent of lag"
    },
    {
      "id": "fade",
      "at": 1,
      "look": "Nearly extinguished residual sparks on last included frame 119; exclusive frame 120 is fully transparent"
    }
  ],
  "layers": [
    {
      "id": "core",
      "kind": "geometry",
      "position": "projectile-traject+owned-layer-XY",
      "purpose": "hot ball, pulse, independent world/local XY/alpha"
    },
    {
      "id": "ribbon",
      "kind": "geometry",
      "position": "projectile-traject+owned-layer-XY",
      "purpose": "continuous curve-following taper from FxPath with turn lag and unlocked tail endpoint"
    },
    {
      "id": "sparks",
      "kind": "particles",
      "position": "projectile-traject+owned-layer-XY",
      "purpose": "seeded detached particles with physical origin offset and age"
    },
    {
      "id": "embers",
      "kind": "particles",
      "position": "projectile-traject+owned-layer-XY",
      "purpose": "motion-time/distance gated residue particles fading independently"
    },
    {
      "id": "haze",
      "kind": "geometry",
      "position": "projectile-traject+owned-layer-XY",
      "purpose": "optional *stylized* shimmering contour; explicitly not optical refraction"
    }
  ],
  "emitterAnchors": [
    {
      "id": "world",
      "space": "world",
      "onMissing": "cannot be missing"
    },
    {
      "id": "skeleton",
      "space": "Spine-skeleton-local",
      "onMissing": "hide-and-diagnose"
    },
    {
      "id": "bone",
      "space": "Spine-bone-local",
      "onMissing": "hide-and-diagnose"
    },
    {
      "id": "slot",
      "space": "Spine-slot-local",
      "onMissing": "hide-and-diagnose"
    },
    {
      "id": "attachment",
      "space": "Spine-attachment-local",
      "onMissing": "hide-and-diagnose"
    }
  ],
  "parameters": [
    {
      "key": "coreRadius",
      "type": "number",
      "default": 35,
      "min": 5,
      "max": 120,
      "step": 1,
      "unit": "logical-pixels",
      "controlGroup": "Fireball geometry and flight",
      "exportPath": "settings.coreRadius"
    },
    {
      "key": "speed",
      "type": "number",
      "default": 200,
      "min": 0,
      "max": 900,
      "step": 1,
      "unit": "logical-pixels-per-second",
      "controlGroup": "Fireball geometry and flight",
      "exportPath": "settings.speed"
    },
    {
      "key": "tailLength",
      "type": "number",
      "default": 65,
      "min": 0,
      "max": 240,
      "step": 1,
      "unit": "logical-arc-length-pixels",
      "controlGroup": "Fireball geometry and flight",
      "exportPath": "settings.tailLength"
    },
    {
      "key": "tailWidth",
      "type": "number",
      "default": 28,
      "min": 1,
      "max": 120,
      "step": 1,
      "unit": "logical-pixels",
      "controlGroup": "Fireball geometry and flight",
      "exportPath": "settings.tailWidth"
    },
    {
      "key": "turnLag",
      "type": "number",
      "default": 0.25,
      "min": 0,
      "max": 1,
      "step": 0.01,
      "unit": "blend-current-vs-historical-path",
      "controlGroup": "Fireball geometry and flight",
      "exportPath": "settings.turnLag"
    },
    {
      "key": "sparkCount",
      "type": "integer",
      "default": 15,
      "min": 0,
      "max": 120,
      "step": 1,
      "unit": "active-particle-cap",
      "controlGroup": "Trail emission and spark particles",
      "exportPath": "settings.sparkCount"
    },
    {
      "key": "trailRate",
      "type": "number",
      "default": 25,
      "min": 0,
      "max": 120,
      "step": 1,
      "unit": "events-per-second",
      "controlGroup": "Trail emission and spark particles",
      "exportPath": "settings.trailRate"
    },
    {
      "key": "trailSpacing",
      "type": "number",
      "default": 6,
      "min": 0.25,
      "max": 100,
      "step": 0.25,
      "unit": "arc-length-pixels",
      "controlGroup": "Trail emission and spark particles",
      "exportPath": "settings.trailSpacing"
    },
    {
      "key": "trailJitter",
      "type": "number",
      "default": 0.15,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "normalized-emission-interval",
      "controlGroup": "Trail emission and spark particles",
      "exportPath": "settings.trailJitter"
    },
    {
      "key": "sparkGap",
      "type": "number",
      "default": 16,
      "min": 8,
      "max": 30,
      "step": 0.5,
      "unit": "logical-pixels",
      "controlGroup": "Trail emission and spark particles",
      "exportPath": "settings.sparkGap"
    },
    {
      "key": "sparkRate",
      "type": "number",
      "default": 12,
      "min": 0,
      "max": 120,
      "step": 1,
      "unit": "events-per-second",
      "controlGroup": "Trail emission and spark particles",
      "exportPath": "settings.sparkRate"
    },
    {
      "key": "sparkLifeFrames",
      "type": "integer",
      "default": 18,
      "min": 1,
      "max": 180,
      "step": 1,
      "unit": "frames-60fps",
      "controlGroup": "Trail emission and spark particles",
      "exportPath": "settings.sparkLifeFrames"
    },
    {
      "key": "particleSize",
      "type": "number",
      "default": 2.5,
      "min": 0.2,
      "max": 20,
      "step": 0.2,
      "unit": "logical-pixels",
      "controlGroup": "Trail emission and spark particles",
      "exportPath": "settings.particleSize"
    },
    {
      "key": "trailLifeFrames",
      "type": "integer",
      "default": 30,
      "min": 1,
      "max": 180,
      "step": 1,
      "unit": "frames-60fps",
      "controlGroup": "Trail emission and spark particles",
      "exportPath": "settings.trailLifeFrames"
    },
    {
      "key": "fadeFrames",
      "type": "integer",
      "default": 24,
      "min": 1,
      "max": 180,
      "step": 1,
      "unit": "frames-60fps",
      "controlGroup": "Fireball geometry and flight",
      "exportPath": "settings.fadeFrames"
    },
    {
      "key": "launchFrames",
      "type": "integer",
      "default": 6,
      "min": 0,
      "max": 120,
      "step": 1,
      "unit": "frames-60fps",
      "controlGroup": "Fireball geometry and flight",
      "exportPath": "settings.launchFrames"
    },
    {
      "key": "fadeStartFrame",
      "type": "integer",
      "default": 96,
      "min": 1,
      "max": 600,
      "step": 1,
      "unit": "frames-60fps",
      "controlGroup": "Fireball geometry and flight",
      "exportPath": "settings.fadeStartFrame"
    },
    {
      "key": "durationFrames",
      "type": "integer",
      "default": 120,
      "min": 6,
      "max": 600,
      "step": 1,
      "unit": "frames-60fps",
      "controlGroup": "Fireball geometry and flight",
      "exportPath": "settings.durationFrames"
    },
    {
      "key": "exportFrames",
      "type": "integer",
      "default": 120,
      "min": 1,
      "max": 3600,
      "step": 1,
      "unit": "frames-60fps",
      "controlGroup": "Fireball geometry and flight",
      "exportPath": "settings.exportFrames"
    },
    {
      "key": "tailX",
      "type": "number",
      "default": -75,
      "min": -1000,
      "max": 1000,
      "step": 1,
      "unit": "world-relative-logical-pixels-if-unlocked",
      "controlGroup": "Trail emission and spark particles",
      "exportPath": "settings.tailX"
    },
    {
      "key": "tailY",
      "type": "number",
      "default": 12,
      "min": -1000,
      "max": 1000,
      "step": 1,
      "unit": "world-relative-logical-pixels-if-unlocked",
      "controlGroup": "Trail emission and spark particles",
      "exportPath": "settings.tailY"
    },
    {
      "key": "seed",
      "type": "integer",
      "default": 31415,
      "min": -2147483648,
      "max": 2147483647,
      "step": 1,
      "unit": "int32",
      "controlGroup": "Fireball geometry and flight",
      "exportPath": "settings.seed"
    },
    {
      "key": "loop",
      "type": "boolean",
      "default": false,
      "unit": "enabled",
      "controlGroup": "Trail spacing and mode",
      "exportPath": "settings.loop"
    },
    {
      "key": "unlockTail",
      "type": "boolean",
      "default": false,
      "unit": "enabled",
      "controlGroup": "Trail spacing and mode",
      "exportPath": "settings.unlockTail"
    },
    {
      "key": "spacingCurveEnabled",
      "type": "boolean",
      "default": false,
      "unit": "enabled",
      "controlGroup": "Trail spacing and mode",
      "exportPath": "settings.spacingCurveEnabled"
    },
    {
      "key": "heatHaze",
      "type": "boolean",
      "default": false,
      "unit": "enabled",
      "controlGroup": "Trail spacing and mode",
      "exportPath": "settings.heatHaze"
    },
    {
      "key": "emissionMode",
      "type": "enum",
      "default": "distance",
      "choices": [
        "time",
        "distance",
        "both"
      ],
      "unit": "enum",
      "controlGroup": "Trail spacing and mode",
      "exportPath": "settings.emissionMode"
    },
    {
      "key": "spatialMode",
      "type": "enum",
      "default": "even",
      "choices": [
        "even",
        "random",
        "stratified",
        "clustered"
      ],
      "unit": "enum",
      "controlGroup": "Trail spacing and mode",
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
      "controlGroup": "Preset and export",
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
      "controlGroup": "Fireball gradient and style",
      "exportPath": "settings.style"
    }
  ],
  "controlGroups": [
    "Fireball geometry and flight",
    "Trail emission and spark particles",
    "Trail spacing and mode",
    "Fireball gradient and style",
    "Editable trajectory",
    "Preset and export"
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
      "id": "tail-taper",
      "key": "tailTaperCurve",
      "domain": "pathPosition",
      "contract": "curves"
    },
    {
      "id": "trail-alpha",
      "key": "trailAlphaCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "core-pulse",
      "key": "corePulseCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "emission-rate",
      "key": "emissionRateCurve",
      "domain": "emitterTime",
      "contract": "curves"
    },
    {
      "id": "distance-spacing",
      "key": "trailSpacingCurve",
      "domain": "pathPosition",
      "contract": "curves"
    }
  ],
  "spacing": {
    "enabledByDefault": true,
    "contract": "spacing",
    "modes": [
      "time-25-per-second",
      "distance-6px",
      "both-time-gated-by-physical-distance"
    ],
    "note": "FxSpacing real arc-length and exact normalized emissionRate curve. Spatial mode has no events while stationary. Trail rate is intentionally inactive in distance-only mode, while trailSpacing is intentionally inactive in time-only mode; both modes produce numerical witnesses. Trail never emits catch-up events on terminal fade/teleport. Independently salted spark schedule and per-particle age."
  },
  "palettes": [
    {
      "id": "fireball-gradient",
      "key": "palette",
      "domain": "flameIntensity",
      "contract": "colors",
      "defaultStops": [
        "#AE2413",
        "#FA761D",
        "#FFE9A0"
      ]
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "Absolute-time hash index streams isolate particle angle/speed from spatial distance and emitter time jitter; no random state depends on ticker frames."
  },
  "rendering": {
    "approach": "composition",
    "strategy": "FxSpacing true arc-length, FxPath smooth bounded ribbons; typed triangle geometry rendered with owned Pixi Graphics quads. Optional heat haze is a stylized animated shimmer contour, NOT a heat-distortion shader; true refractive heat distortion is not claimed.",
    "backends": [
      "webgl1",
      "webgl2",
      "webgpu"
    ],
    "runtimePins": {
      "pixi": "8.22.0",
      "spine": "4.2.120"
    },
    "fallback": "Expose actual backend; reject silent WebGL/WebGPU substitution and oversized 512 PNG; explicit Fit re-scales owned trajectory and effect dimensions only.",
    "shaderStatus": "No custom GLSL/WGSL or true refraction in this reviewed baseline."
  },
  "qualityBudgets": {
    "low": {
      "maxSparkParticles": 10,
      "maxEmbers": 20,
      "maxRibbonVertices": 1024,
      "maxPrimitives": 68
    },
    "balanced": {
      "maxSparkParticles": 30,
      "maxEmbers": 60,
      "maxRibbonVertices": 4096,
      "maxPrimitives": 160
    },
    "high": {
      "maxSparkParticles": 120,
      "maxEmbers": 160,
      "maxRibbonVertices": 8192,
      "maxPrimitives": 350
    }
  },
  "tests": {
    "verified": true,
    "evidence": [
      "scripts/test_projectile_core.cjs",
      "scripts/test_projectile_editor.cjs",
      "scripts/test_projectile_evidence.cjs",
      "scripts/test_projectile_lifecycle.cjs",
      "scripts/test_projectile_export.cjs",
      "scripts/test_projectile_developer.cjs"
    ],
    "required": [
      "One-shot 120-frame/60fps spawn, curving travel and final alpha-zero frame 120; optional explicit loop with reset history",
      "Arc-speed correctness at 0,0.5,1.6 s, moving versus stationary and turnLag without head drift",
      "Artist draggable handles: two continuous cubic segments with start/joint/end and tangent controls, independently movable unlocked tail and live head",
      "Temporal 25/s and spatial 6px must change independent real event timestamps and physical arc distances; both gates rather than doubles",
      "Five independent layer toggles/XY/rotation/alpha, disabled-all zero transparent RGBA pixels, missing anchors fail closed",
      "Five editable curves with domain/range/key/Bezier interpolation preserved in JSON and PNG",
      "Natural/Stylized/Magical styles preserve editable RGBA palette; documented optional stylized heat contour, no false refraction shader claim",
      "Real WebGL1/WebGL2/WebGPU Chromium backend provenance, PNG alpha with no PMA dark fringes, isolated camera zoom/background parity",
      "Spine 4.2 JSON/SKEL and multipage atlas, animated bone/slot/attachment anchors, deterministic arbitrary backward seek",
      "1-3600 PNG ZIP, bounded output/explicit fit/no crop/cancellation recovery and frozen world export with exact frame i/60",
      "Developer ZIP exact ESM parity, both pinned Vite builds and real browser runtime, offline no network",
      "FX-CORE-07 complete parameter/phase evidence with final commit SHA and protected Burn/Torch/Explosion regressions"
    ]
  },
  "outOfScope": [
    "No real optical heat-distortion framebuffer shader; haze represents visibly animated contour only, disabled by default",
    "No automatic linking/triggering FIRE-02 Explosion: impact-ready event is a passive contract without side effects",
    "No new generalized effect graph, no changes to protected Burn/Torch/Explosion HTML/vendor files",
    "No physical mobile GPU/thermal/FPS certification from headless software Chromium",
    "No silent auto crop, hidden auto resize or automatic loop of a nonclosed path"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "coreRadius": "settings.coreRadius",
      "speed": "settings.speed",
      "tailLength": "settings.tailLength",
      "tailWidth": "settings.tailWidth",
      "turnLag": "settings.turnLag",
      "sparkCount": "settings.sparkCount",
      "trailRate": "settings.trailRate",
      "trailSpacing": "settings.trailSpacing",
      "trailJitter": "settings.trailJitter",
      "sparkGap": "settings.sparkGap",
      "sparkRate": "settings.sparkRate",
      "sparkLifeFrames": "settings.sparkLifeFrames",
      "particleSize": "settings.particleSize",
      "trailLifeFrames": "settings.trailLifeFrames",
      "fadeFrames": "settings.fadeFrames",
      "launchFrames": "settings.launchFrames",
      "fadeStartFrame": "settings.fadeStartFrame",
      "durationFrames": "settings.durationFrames",
      "exportFrames": "settings.exportFrames",
      "tailX": "settings.tailX",
      "tailY": "settings.tailY",
      "seed": "settings.seed",
      "loop": "settings.loop",
      "unlockTail": "settings.unlockTail",
      "spacingCurveEnabled": "settings.spacingCurveEnabled",
      "heatHaze": "settings.heatHaze",
      "emissionMode": "settings.emissionMode",
      "spatialMode": "settings.spatialMode",
      "quality": "settings.quality",
      "style": "settings.style"
    },
    "preview": "assets/Fireball_Projectile_Lab.html",
    "pngBake": "ProjectileExports.bake. Straight-alpha 512x512 PNG ZIP, 1-3600 frames at frameIndex/60 and no clipped geometry.",
    "developerZip": "ProjectileExports.buildPackage('webgl'|'webgpu') with exact shared FxPath and FxProjectile ES module source",
    "invariant": "Identical pure FxProjectile core for absolute-time preview, PNG baker, WebGL and WebGPU example."
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject",
    "policy": "Explicit versioned migration only, strict unknown key rejection."
  },
  "implementation": {
    "status": "reference-implementation",
    "sourceFiles": [
      "assets/fireball-projectile/src/projectile-core.js",
      "assets/fireball-projectile/src/projectile-runtime.js",
      "assets/fireball-projectile/src/projectile-editor.js",
      "assets/fireball-projectile/src/projectile-export.js",
      "assets/fireball-projectile/src/zip-core.js",
      "assets/fireball-projectile/src/ui.html",
      "scripts/build_projectile_editor.py",
      "assets/Fireball_Projectile_Lab.html"
    ],
    "notes": "Standalone offline FIRE-03 editor with independently authored two-cubic trajectory and 120-frame starter; no effects injected into Burn/Torch/Explosion."
  }
}
```

## Build and verify

Run `python scripts/build_projectile_editor.py --output assets/Fireball_Projectile_Lab.html` to generate a single offline HTML. Run `node scripts/test_projectile_core.cjs` and backend-selectable `node scripts/test_projectile_editor.cjs --backend webgl1|webgl2|webgpu --output OUT`; validate generated FX-CORE-07 reports before closing. This effect is distinct from the FIRE-02 radial blast and FIRE-01 static torch.
