# FIRE-04 — Embers and Sparks: editable multi-emitter FX Lab

Independent 60fps offline 512×512 editor. Default **40 frames of emitter activity + 0.8s particle decay**, exported as 90 frames. Natural hot-to-cool sparks with optional independent motion streaks and localized bloom. **No hidden rays and no global blur filter**.

## Versioned FX Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.fire.embers-sparks",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "fire",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "A stationary or optionally path/bone-tracked combustion source emits independent physically ballistic hot particles, rises against a configurable signed Y acceleration, cools through a full editable RGBA gradient, shrinks and fades. 40 emission frames at 60fps plus 0.8s age-tail yields a 90-frame full one-shot. One-to-four independent emitters; optional independent motion streaks and bloom layers, off by default. No hidden rays or unrelated blast/torch graphics.",
  "phases": [
    {
      "id": "launch",
      "at": 0,
      "look": "One immediately visible tiny hot ember on frame zero"
    },
    {
      "id": "emission",
      "at": 0.28,
      "look": "Several bright particles rise from stationary/moving source, no default streaks or bloom"
    },
    {
      "id": "cooling",
      "at": 0.67,
      "look": "Emission stopped at frame 40 but existing particles continue aging, cooling, drifting upward and shrinking"
    },
    {
      "id": "fade",
      "at": 1,
      "look": "Only a few dim older embers remain before a transparent frame 89 and exclusive endpoint frame 90"
    }
  ],
  "layers": [
    {
      "id": "hot",
      "kind": "particles",
      "position": "emitter-relative-local",
      "purpose": "Independent hot particles, natural circles/stylized diamonds/magical star polygon"
    },
    {
      "id": "streaks",
      "kind": "geometry",
      "position": "emitter-relative-local",
      "purpose": "Optional short velocity-aligned tapered triangles, disabled by default and never forced on"
    },
    {
      "id": "bloom",
      "kind": "geometry",
      "position": "emitter-relative-local",
      "purpose": "Optional tiny 3-ring alpha feathering; not a global blur filter or refractive shader; disabled by default"
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
      "onMissing": "hide selected emitter and diagnose"
    },
    {
      "id": "bone",
      "space": "Spine-bone-local",
      "onMissing": "hide selected emitter and diagnose"
    },
    {
      "id": "slot",
      "space": "Spine-slot-local",
      "onMissing": "hide selected emitter and diagnose"
    },
    {
      "id": "attachment",
      "space": "Spine-active-attachment-centroid-local",
      "onMissing": "hide selected emitter and diagnose"
    }
  ],
  "parameters": [
    {
      "key": "rate",
      "type": "number",
      "default": 35,
      "min": 0,
      "max": 240,
      "step": 1,
      "unit": "particles-per-second",
      "controlGroup": "Emission envelope and time",
      "exportPath": "settings.rate"
    },
    {
      "key": "particleSize",
      "type": "number",
      "default": 3,
      "min": 1,
      "max": 12,
      "step": 0.25,
      "unit": "logical-pixels",
      "controlGroup": "Motion, speed and particle style",
      "exportPath": "settings.particleSize"
    },
    {
      "key": "spreadAngle",
      "type": "number",
      "default": 30,
      "min": 0,
      "max": 180,
      "step": 1,
      "unit": "degrees",
      "controlGroup": "Motion, speed and particle style",
      "exportPath": "settings.spreadAngle"
    },
    {
      "key": "launchSpeed",
      "type": "number",
      "default": 110,
      "min": 0,
      "max": 600,
      "step": 1,
      "unit": "logical-pixels-per-second",
      "controlGroup": "Motion, speed and particle style",
      "exportPath": "settings.launchSpeed"
    },
    {
      "key": "gravity",
      "type": "number",
      "default": -50,
      "min": -500,
      "max": 500,
      "step": 1,
      "unit": "logical-pixels-per-second-squared",
      "controlGroup": "Motion, speed and particle style",
      "exportPath": "settings.gravity"
    },
    {
      "key": "lifetimeSeconds",
      "type": "number",
      "default": 0.8,
      "min": 0.1,
      "max": 4,
      "step": 0.05,
      "unit": "seconds",
      "controlGroup": "Emission envelope and time",
      "exportPath": "settings.lifetimeSeconds"
    },
    {
      "key": "emissionFrames",
      "type": "integer",
      "default": 40,
      "min": 1,
      "max": 600,
      "step": 1,
      "unit": "frames-at-60fps",
      "controlGroup": "Emission envelope and time",
      "exportPath": "settings.emissionFrames"
    },
    {
      "key": "durationFrames",
      "type": "integer",
      "default": 90,
      "min": 6,
      "max": 900,
      "step": 1,
      "unit": "frames-at-60fps",
      "controlGroup": "Emission envelope and time",
      "exportPath": "settings.durationFrames"
    },
    {
      "key": "exportFrames",
      "type": "integer",
      "default": 90,
      "min": 1,
      "max": 3600,
      "step": 1,
      "unit": "frames-at-60fps",
      "controlGroup": "Emission envelope and time",
      "exportPath": "settings.exportFrames"
    },
    {
      "key": "intervalJitter",
      "type": "number",
      "default": 0.15,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "fraction-of-interval",
      "controlGroup": "Emission envelope and time",
      "exportPath": "settings.intervalJitter"
    },
    {
      "key": "burstCount",
      "type": "integer",
      "default": 3,
      "min": 1,
      "max": 40,
      "step": 1,
      "unit": "events-per-burst",
      "controlGroup": "Emission envelope and time",
      "exportPath": "settings.burstCount"
    },
    {
      "key": "burstDelay",
      "type": "number",
      "default": 0.04,
      "min": 0,
      "max": 2,
      "step": 0.01,
      "unit": "seconds",
      "controlGroup": "Emission envelope and time",
      "exportPath": "settings.burstDelay"
    },
    {
      "key": "spatialSpacing",
      "type": "number",
      "default": 10,
      "min": 0.25,
      "max": 100,
      "step": 0.25,
      "unit": "logical-arc-length-pixels",
      "controlGroup": "Motion, speed and particle style",
      "exportPath": "settings.spatialSpacing"
    },
    {
      "key": "spatialJitter",
      "type": "number",
      "default": 0.2,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "fraction-of-distance",
      "controlGroup": "Motion, speed and particle style",
      "exportPath": "settings.spatialJitter"
    },
    {
      "key": "minGapSeconds",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 2,
      "step": 0.01,
      "unit": "seconds",
      "controlGroup": "Emission envelope and time",
      "exportPath": "settings.minGapSeconds"
    },
    {
      "key": "streakLength",
      "type": "number",
      "default": 14,
      "min": 1,
      "max": 120,
      "step": 0.5,
      "unit": "logical-pixels",
      "controlGroup": "Motion, speed and particle style",
      "exportPath": "settings.streakLength"
    },
    {
      "key": "bloomRadius",
      "type": "number",
      "default": 8,
      "min": 1,
      "max": 60,
      "step": 0.5,
      "unit": "logical-pixels",
      "controlGroup": "Motion, speed and particle style",
      "exportPath": "settings.bloomRadius"
    },
    {
      "key": "seed",
      "type": "integer",
      "default": 131,
      "min": -2147483648,
      "max": 2147483647,
      "step": 1,
      "unit": "int32",
      "controlGroup": "Emission envelope and time",
      "exportPath": "settings.seed"
    },
    {
      "key": "loop",
      "type": "boolean",
      "default": false,
      "unit": "enabled",
      "controlGroup": "Emission and spatial distribution",
      "exportPath": "settings.loop"
    },
    {
      "key": "burstMode",
      "type": "boolean",
      "default": false,
      "unit": "enabled",
      "controlGroup": "Emission and spatial distribution",
      "exportPath": "settings.burstMode"
    },
    {
      "key": "spacingCurveEnabled",
      "type": "boolean",
      "default": false,
      "unit": "enabled",
      "controlGroup": "Emission and spatial distribution",
      "exportPath": "settings.spacingCurveEnabled"
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
      "controlGroup": "Emission and spatial distribution",
      "exportPath": "settings.spatialMode"
    },
    {
      "key": "emissionMode",
      "type": "enum",
      "default": "time",
      "choices": [
        "time",
        "distance",
        "both"
      ],
      "unit": "enum",
      "controlGroup": "Emission and spatial distribution",
      "exportPath": "settings.emissionMode"
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
      "controlGroup": "Preset and export",
      "exportPath": "settings.style"
    }
  ],
  "controlGroups": [
    "Emission envelope and time",
    "Motion, speed and particle style",
    "Emission and spatial distribution",
    "Independent emitters (up to 4)",
    "Selected emitter anchor",
    "Selected emitter layers",
    "Editable hot-to-cool RGBA gradient and style",
    "Editable timeline curves",
    "Preset and export"
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
      "id": "emission-rate",
      "key": "emissionRateCurve",
      "domain": "emitterTime",
      "contract": "curves"
    },
    {
      "id": "size",
      "key": "sizeCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "temperature",
      "key": "temperatureCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "opacity",
      "key": "alphaCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "physical-spacing",
      "key": "spacingCurve",
      "domain": "pathPosition",
      "contract": "curves"
    }
  ],
  "spacing": {
    "enabledByDefault": true,
    "contract": "spacing",
    "modes": [
      "time-35-per-second-default-stationary-allowed",
      "distance-10px-moving-only",
      "both-time-gated-by-physical-distance"
    ],
    "note": "Emitter rateCurve is emissionRate/emitterTime, not global effectTime. Spatial placement uses one cubic Bézier and actual FxSpacing arc length; stationary distance and both require movement and emit zero, with an explicit UI diagnostic. Rate/burst/time jitter, physical distance/cluster jitter and launch velocity remain independent, seeded and budgeted. No pathGeometry contract: optional motion streaks are direct triangles."
  },
  "palettes": [
    {
      "id": "embers-cooling",
      "key": "palette",
      "domain": "particleAge",
      "contract": "colors",
      "defaultStops": [
        "#FFE7A3",
        "#FF9D3D",
        "#B74D27"
      ],
      "alpha": "Full editable per-stop opacity; cool end alpha zero by default"
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "Independent emitter ID and seed are included in stable hash, with per-event and per-feature independent streams. Changing/reordering/removing sibling emitters never changes surviving event/particle hashes. No Math.random or ticker-driven PRNG."
  },
  "rendering": {
    "approach": "particles",
    "strategy": "Numerical particle positions evaluated analytically at absolute time; owned layer Graphics draw hot circles/diamond-stars, motion-aligned tapered triangles, optional 3-ring localized bloom. No shared scene filters, screen-space rays, fake refractive heat haze or ParticleContainer required. Four independent emitters, Spine/world anchors.",
    "backends": [
      "webgl1",
      "webgl2",
      "webgpu"
    ],
    "runtimePins": {
      "pixi": "8.22.0",
      "spine": "4.2.120"
    },
    "fallback": "Demand actual renderer backend in browser proof; do not silently claim a requested backend or hardware performance. Export fails on clipped geometry; explicit Fit checks every exported frame.",
    "shaderStatus": "No new GLSL/WGSL. Optional ParticleContainer is intentionally future benchmarking only because experimental runtime props are not guaranteed."
  },
  "qualityBudgets": {
    "low": {
      "maxParticles": 60,
      "maxPrimitives": 96
    },
    "balanced": {
      "maxParticles": 150,
      "maxPrimitives": 256
    },
    "high": {
      "maxParticles": 300,
      "maxPrimitives": 512
    }
  },
  "tests": {
    "verified": true,
    "evidence": [
      "scripts/test_embers_core.cjs",
      "scripts/test_embers_editor.cjs",
      "scripts/test_embers_evidence.cjs",
      "scripts/test_embers_lifecycle.cjs",
      "scripts/test_embers_export.cjs",
      "scripts/test_embers_developer.cjs"
    ],
    "required": [
      "All five age/time/physical-spacing curves independently change numeric state and actual pixels, retaining Bezier handles, keys and domains",
      "All 25 exported artist-facing root parameters and every per-emitter/layer control either changes visible output/numeric state or is explicitly gated by an enabled mode",
      "Default 35/s emission taper for first 40 frames and full 0.8s cooling tail in 90 frame bake; transparent terminal frame, optional explicit loop",
      "Ballistic px/s and px/s² independent of emitter movement and absolute frame seek; 30/60/120fps equality",
      "One-to-four independent stable emitter IDs, add/duplicate/delete, world/local/Spine animated bone/slot/attachment; missing hides only one emitter",
      "Distance 10px/cluster jitter only on moving path, accuracy <=0.25px; stationary distance has no events and diagnostic; temporal rate and jitter affect timestamps",
      "Individual hot/streak/bloom layers can be disabled and repositioned independently; all disabled means alpha-zero; no hidden rays",
      "Hot-to-cool editable RGBA with no PMA fringes, screenshot and decoded PNG differences with real WebGL1/WebGL2/WebGPU context",
      "Offline, camera zoom 50/100/200% parity, PNG 512x512 1-3600 straight-alpha, isolated time and no silent cropping, full cancellation rollback",
      "Both Vite developer ZIPs include identical core/runtime and optional Spine JSON/SKEL textures; ESM parity, real browser execution",
      "FX-CORE-07 phase/parameter/backend validated screenshot SHA256 reports tied to main commit; protect all existing FIRE editors"
    ]
  },
  "outOfScope": [
    "No generic effect graph, no modifications to Torch/Explosion/Fireball/Burn core source or pins",
    "No global shader blur/true heat-refraction; bloom is a local owned soft 3-ring halo",
    "No experimental PixiJS ParticleContainer in first slice; benchmark future optional optimization separately",
    "No physical mobile GPU performance certification from SwiftShader/headless Chrome",
    "No dishonest 40-frame clipped emission; default is 40 frames source plus decay in 90-frame sequence",
    "No automatic introduction of streak/ray/postprocessing layers when disabled or when other layers are toggled",
    "No unreleased Spine versions and no automatic coupling to projectile/explosion events"
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "rate": "settings.rate",
      "particleSize": "settings.particleSize",
      "spreadAngle": "settings.spreadAngle",
      "launchSpeed": "settings.launchSpeed",
      "gravity": "settings.gravity",
      "lifetimeSeconds": "settings.lifetimeSeconds",
      "emissionFrames": "settings.emissionFrames",
      "durationFrames": "settings.durationFrames",
      "exportFrames": "settings.exportFrames",
      "intervalJitter": "settings.intervalJitter",
      "burstCount": "settings.burstCount",
      "burstDelay": "settings.burstDelay",
      "spatialSpacing": "settings.spatialSpacing",
      "spatialJitter": "settings.spatialJitter",
      "minGapSeconds": "settings.minGapSeconds",
      "streakLength": "settings.streakLength",
      "bloomRadius": "settings.bloomRadius",
      "seed": "settings.seed",
      "loop": "settings.loop",
      "burstMode": "settings.burstMode",
      "spacingCurveEnabled": "settings.spacingCurveEnabled",
      "spatialMode": "settings.spatialMode",
      "emissionMode": "settings.emissionMode",
      "quality": "settings.quality",
      "style": "settings.style"
    },
    "preview": "assets/Embers_Sparks_Lab.html",
    "pngBake": "EmbersExports.bake: isolated full 512x512 RGBA8 PNG sequence sampled at frameIndex/60, 1-3600 frames, no silent cropping",
    "developerZip": "EmbersExports.buildPackage('webgl'|'webgpu'): pinned Vite PixiJS+Spine modules and exact shared FxEmbers source",
    "invariant": "Pure FxEmbers sample drives preview, PNG bake and both extracted Vite developer packages; all four emitter settings retained"
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject",
    "policy": "Strict schema/preset versions; reject unknown fields and unsupported versions; migration requires separate tests"
  },
  "implementation": {
    "status": "reference-implementation",
    "sourceFiles": [
      "assets/embers-sparks/src/embers-core.js",
      "assets/embers-sparks/src/embers-runtime.js",
      "assets/embers-sparks/src/embers-editor.js",
      "assets/embers-sparks/src/embers-export.js",
      "assets/embers-sparks/src/zip-core.js",
      "assets/embers-sparks/src/ui.html",
      "assets/Embers_Sparks_Lab.html",
      "scripts/build_embers_editor.py"
    ],
    "notes": "One-to-four multi-emitter standalone Emissions & Sparks Lab; strictly separate from existing FIRE editors"
  }
}
```

## Build and validate

Run `python scripts/build_embers_editor.py --output assets/Embers_Sparks_Lab.html`, then `node scripts/test_embers_core.cjs`, backend-selectable `node scripts/test_embers_editor.cjs --backend webgl1|webgl2|webgpu --output OUT` and `node scripts/test_embers_evidence.cjs OUT` followed by `python scripts/effect_validation.py OUT/effect-evidence.json --require-pass`. Both Vite ZIPs require ESM parity, build and real browser smoke.
