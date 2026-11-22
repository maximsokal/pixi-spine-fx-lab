# WATER-02 — Rainfall: deterministic continuous seamless 60-frame loop

WATER-02 is a dedicated **rain** effect, not the prior WATER-01 impact one-shot. It has continuous pre-rolled primary rain at frame0, mathematically periodic normalized mean 45/s emission, tilted wind-integrated trajectories and real optional ground-contact splashes; depth near/far are independently disabled/enabled. A per-layer Spine anchor follows the live pose, not historical world emission positions.

## Versioned Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.water.rainfall",
  "effectVersion": "1.0.0",
  "presetSchemaVersion": 1,
  "category": "water",
  "styles": [
    "natural",
    "stylized",
    "magical"
  ],
  "visualGoal": "A seamless, nonempty continuous rainfall field with deterministic long-lived drops entering above the viewport from previous one-second emission periods. Full 60-frame loop, +Y down, falling streaks at mean 45/s, wind-integrated x trajectory and rotation, optional independent actual ground-crossing impacts and near/far parallax layers. No reset/fade of all particles at phase boundary. PNG straight-alpha and exact same source in exported bundles.",
  "phases": [
    {
      "id": "start",
      "at": 0,
      "look": "Full ongoing streak rain from earlier emission cycles; no fake empty start or global alpha flash"
    },
    {
      "id": "middle",
      "at": 0.5,
      "look": "Falling drops continue and deterministic ground-contact rings appear, with wind and optional depth layers"
    },
    {
      "id": "seam",
      "at": 1,
      "look": "At exactly 60/60 seconds periodic state reproduces frame0, frame59 still shows rain, no global fade or density reset"
    }
  ],
  "layers": [
    {
      "id": "drops",
      "kind": "particles",
      "position": "emitter-relative-local",
      "purpose": "True pooled ParticleContainer primary rain streaks. Enabled by default, alpha/rotation/tint/width/length dynamic from pure core."
    },
    {
      "id": "far",
      "kind": "particles",
      "position": "emitter-relative-local",
      "purpose": "Optional independently toggled slow/small/fainter distant rain parallax with continuous timing. Off by default."
    },
    {
      "id": "near",
      "kind": "particles",
      "position": "emitter-relative-local",
      "purpose": "Optional independently toggled faster/larger foreground rain parallax with continuous timing. Off by default."
    },
    {
      "id": "impacts",
      "kind": "geometry",
      "position": "emitter-relative-local",
      "purpose": "Optional real contact-generated fading ground-ring visuals, probability .3. Enabled by default but never independent random hits."
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
      "key": "density",
      "type": "number",
      "default": 45,
      "min": 0,
      "max": 250,
      "step": 1,
      "unit": "particles-per-second-mean",
      "controlGroup": "Rain intensity and direction",
      "exportPath": "settings.density"
    },
    {
      "key": "streakLength",
      "type": "number",
      "default": 14,
      "min": 1,
      "max": 65,
      "step": 0.5,
      "unit": "px",
      "controlGroup": "Rain intensity and direction",
      "exportPath": "settings.streakLength"
    },
    {
      "key": "windAngle",
      "type": "number",
      "default": 10,
      "min": -75,
      "max": 75,
      "step": 0.5,
      "unit": "degrees",
      "controlGroup": "Rain intensity and direction",
      "exportPath": "settings.windAngle"
    },
    {
      "key": "fallSpeed",
      "type": "number",
      "default": 260,
      "min": 20,
      "max": 1200,
      "step": 1,
      "unit": "px-per-second",
      "controlGroup": "Rain intensity and direction",
      "exportPath": "settings.fallSpeed"
    },
    {
      "key": "dropWidth",
      "type": "number",
      "default": 2,
      "min": 1,
      "max": 8,
      "step": 0.25,
      "unit": "px",
      "controlGroup": "Rain intensity and direction",
      "exportPath": "settings.dropWidth"
    },
    {
      "key": "impactProbability",
      "type": "number",
      "default": 0.3,
      "min": 0,
      "max": 1,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Impact surface and contact physics",
      "exportPath": "settings.impactProbability"
    },
    {
      "key": "groundY",
      "type": "number",
      "default": 450,
      "min": 0,
      "max": 512,
      "step": 1,
      "unit": "world-Y-px",
      "controlGroup": "Impact surface and contact physics",
      "exportPath": "settings.groundY"
    },
    {
      "key": "groundBandHeight",
      "type": "number",
      "default": 10,
      "min": 1,
      "max": 60,
      "step": 1,
      "unit": "px",
      "controlGroup": "Impact surface and contact physics",
      "exportPath": "settings.groundBandHeight"
    },
    {
      "key": "impactSize",
      "type": "number",
      "default": 6,
      "min": 1,
      "max": 35,
      "step": 0.5,
      "unit": "px",
      "controlGroup": "Impact surface and contact physics",
      "exportPath": "settings.impactSize"
    },
    {
      "key": "impactLifetime",
      "type": "number",
      "default": 0.22,
      "min": 0.05,
      "max": 1.5,
      "step": 0.01,
      "unit": "seconds",
      "controlGroup": "Impact surface and contact physics",
      "exportPath": "settings.impactLifetime"
    },
    {
      "key": "spawnY",
      "type": "number",
      "default": -70,
      "min": -200,
      "max": 0,
      "step": 1,
      "unit": "logical-px",
      "controlGroup": "Emission spatial lanes",
      "exportPath": "settings.spawnY"
    },
    {
      "key": "fieldWidth",
      "type": "number",
      "default": 320,
      "min": 80,
      "max": 512,
      "step": 1,
      "unit": "px",
      "controlGroup": "Emission spatial lanes",
      "exportPath": "settings.fieldWidth"
    },
    {
      "key": "spatialGap",
      "type": "number",
      "default": 18,
      "min": 2,
      "max": 100,
      "step": 0.5,
      "unit": "arc-px",
      "controlGroup": "Emission spatial lanes",
      "exportPath": "settings.spatialGap"
    },
    {
      "key": "spatialJitter",
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 0.45,
      "step": 0.01,
      "unit": "fraction",
      "controlGroup": "Emission spatial lanes",
      "exportPath": "settings.spatialJitter"
    },
    {
      "key": "nearSpeed",
      "type": "number",
      "default": 1.45,
      "min": 0.1,
      "max": 4,
      "step": 0.05,
      "unit": "speed-multiplier",
      "controlGroup": "Parallax near/far planes",
      "exportPath": "settings.nearSpeed"
    },
    {
      "key": "farSpeed",
      "type": "number",
      "default": 0.68,
      "min": 0.1,
      "max": 4,
      "step": 0.05,
      "unit": "speed-multiplier",
      "controlGroup": "Parallax near/far planes",
      "exportPath": "settings.farSpeed"
    },
    {
      "key": "nearSize",
      "type": "number",
      "default": 1.4,
      "min": 0.25,
      "max": 3,
      "step": 0.05,
      "unit": "size-multiplier",
      "controlGroup": "Parallax near/far planes",
      "exportPath": "settings.nearSize"
    },
    {
      "key": "farSize",
      "type": "number",
      "default": 0.7,
      "min": 0.25,
      "max": 3,
      "step": 0.05,
      "unit": "size-multiplier",
      "controlGroup": "Parallax near/far planes",
      "exportPath": "settings.farSize"
    },
    {
      "key": "exportFrames",
      "type": "integer",
      "default": 60,
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
      "key": "spacingCurveEnabled",
      "type": "boolean",
      "default": false,
      "unit": "enabled",
      "controlGroup": "Emission spatial lanes",
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
      "controlGroup": "Emission spatial lanes",
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
      "controlGroup": "RGBA style and curve editors",
      "exportPath": "settings.style"
    }
  ],
  "controlGroups": [
    "Rain intensity and direction",
    "Impact surface and contact physics",
    "Emission spatial lanes",
    "Parallax near/far planes",
    "Timeline and quality",
    "Independent emitter transforms",
    "RGBA style and curve editors"
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
      "id": "rate-envelope",
      "key": "densityCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "periodic-wind",
      "key": "windCurve",
      "domain": "effectTime",
      "contract": "curves"
    },
    {
      "id": "droplet-opacity",
      "key": "dropAlphaCurve",
      "domain": "particleAge",
      "contract": "curves"
    },
    {
      "id": "optional-lane-spacing",
      "key": "spacingCurve",
      "domain": "pathPosition",
      "contract": "curves"
    }
  ],
  "spacing": {
    "contract": "spacing",
    "temporal": "FxSpacing.createTemporalSchedule integrates the 60-frame periodic densityCurve at 4096 midpoint steps. density=45 represents the MEAN arrivals/s; rate envelope normalized to unit mean; events at [0,1) seconds repeat with stable birth IDs and earlier cycles reconstructed until ground contact. No global burst reset or frame-count-driven emission.",
    "spatial": "FxSpacing.createSpatialPlacement maps cubic horizontal spawn path by numerical cumulative arc length (<=0.25 px tolerance); default nominal lane gap18px, fieldWidth320, jitter0; even/random/stratified/clustered modes and separately enabled spacingCurve (pathPosition, px) never overwrite densityCurve (effectTime, multiplier). Lane reuse for 45 arrivals does NOT require physical interparticle separation18px.",
    "impact": "Actual contact timing derived from falling drop crossing seeded ground band [groundY-groundBandHeight/2,groundY+groundBandHeight/2], default groundY450, height10; per-drop independent seeded Bernoulli impactProbability .3; impactLifetime .22s, size6; no impacts with density0 or drops disabled.",
    "wind": "Periodic windCurve is integrated from birth time to sample time for actual x drift; rotation matches x velocity. Absolute seek/randomized frame order yields identical output. Mean arrival modulation and motion are independent.",
    "caps": "Hard quality limits on cumulative main/near/far and impact particles across up to four emitters; budget overflow diagnosed rather than silently skipping extra particles."
  },
  "palettes": [
    {
      "id": "rain-color",
      "key": "palette",
      "contract": "colors",
      "domain": "particleAge",
      "defaultStops": [
        "#C7E9FF",
        "#619ECA"
      ],
      "alpha": "0.95→0.60 using editable straight RGBA; particle age multiplies independently editable 0→1→1→0 dropAlphaCurve"
    }
  ],
  "rng": {
    "policy": "seeded-per-instance",
    "seedParameter": "seed",
    "streamPolicy": "Stable per-emitter-id/seed with event index and explicit deterministic streams for lane jitter, ground-band contact, impact Bernoulli and optional near/far. All cached cycles repeat; no shared global Math.random; source reorder cannot perturb others."
  },
  "rendering": {
    "approach": "particles",
    "backends": [
      "webgl1",
      "webgl2",
      "webgpu"
    ],
    "runtimePins": {
      "pixi": "8.22.0",
      "spine": "4.2.120"
    },
    "strategy": "Fixed source in absolute loop seconds; emitter owns stable Pixi Container and separate drops/far/near ParticleContainer with reusable Particle and WHITE texture, dynamic x/y/rotation/tint/alpha/width/length. Impacts are independent owned Graphics rings, not random or separate Physics engine. Optional near/far off by default. A real Pixi8.22.0 browser canary verifies native ParticleContainer on all 3 backends.",
    "alpha": "Transparent isolated 512x512 straight-alpha RGBA8 PNG only, no CSS background or Spine source in bake; previous-period drops at frame0; frame59 nonempty; exact t1==t0.",
    "crop": "Intentional vertical entry from spawnY=-70 and bottom exit clipped; horizontal accidental spill diagnosed/rejected in bake.",
    "spine": "Live-follow bone/slot/attachment world matrix on absolute seek; not world-release of historically emitted drops from moving anchor",
    "hardware": "Headless Chromium API and pixels do not prove FPS/thermals on physical mobile GPUs."
  },
  "qualityBudgets": {
    "low": {
      "maxParticles": 260,
      "maxImpacts": 80,
      "maxEmitters": 4,
      "pooledSourceTextures": 1
    },
    "balanced": {
      "maxParticles": 950,
      "maxImpacts": 220,
      "maxEmitters": 4,
      "pooledSourceTextures": 1
    },
    "high": {
      "maxParticles": 2400,
      "maxImpacts": 480,
      "maxEmitters": 4,
      "pooledSourceTextures": 1
    }
  },
  "tests": {
    "verified": true,
    "evidence": [
      "scripts/test_rain_core.cjs",
      "scripts/test_rain_particles.cjs",
      "scripts/test_rain_editor.cjs",
      "scripts/test_rain_packages.cjs",
      "scripts/test_rain_export.cjs",
      "scripts/test_rain_png_zip.cjs",
      "scripts/test_rain_alpha.cjs",
      "scripts/test_rain_lifecycle.cjs",
      "scripts/test_rain_roi.cjs",
      "scripts/test_rain_spine.cjs",
      "scripts/test_rain_developer.cjs",
      "scripts/test_rain_evidence.cjs"
    ],
    "required": [
      "Exact 60-frame state periodicity, first frame already populated by earlier real events that remain active >1s, no global intensity flicker at 59→0.",
      "Integrated 45/s mean rain, independent actual time+arc-distance curve, per-emitter seed/reorder/30-60-120FPS, wind moves x AND tilts GPU streak.",
      "Ground impacts only from original drops crossing explicit stochastic band with chance; density0 and main disabled yield zero impacts; layer independence and no inert artist parameters.",
      "Native reusable Pixi ParticleContainer actual pixel test at WebGL1/WebGL2/WebGPU; bounded creation and lifecycle.",
      "Real 60 PNG frames, straight-alpha no PMA-dark edges, intentful vertical clip and rejected unintended horizontal crop, same backend zoom invariance.",
      "Two exact source ESM/Vite developer handoffs with pinned Pixi/Spine, real browser animation; JSON/SKEL/multipage support and absent-anchor isolation.",
      "FX-CORE-07 mandatory actual 0/0.5/1s renderer+PNG SHA and per-parameter phase evidence; post-push commit SHA bound; original Burn and other effects unchanged."
    ]
  },
  "outOfScope": [
    "No volumetric rain, CFD, wet surface shader or rain-on-arbitrary-mesh collision",
    "No one-shot 40-frame animation; WATER-01 owns 40-frame impact loop mode",
    "No world-history particle emission from moving Spine bones: source follows current bone transform (documented artist semantics)",
    "No experimental GPU feature that silently falls back while claiming real WebGPU",
    "No hardware phone FPS/thermal certifications or binary .skel sample if matching fixture unavailable",
    "No modifications to original protected Burn Lab, FIRE or WATER-01, upgrades or additional Pixi filters."
  ],
  "exportMapping": {
    "presetSchemaVersion": 1,
    "settingsRoot": "settings",
    "parameterMap": {
      "density": "settings.density",
      "streakLength": "settings.streakLength",
      "windAngle": "settings.windAngle",
      "fallSpeed": "settings.fallSpeed",
      "dropWidth": "settings.dropWidth",
      "impactProbability": "settings.impactProbability",
      "groundY": "settings.groundY",
      "groundBandHeight": "settings.groundBandHeight",
      "impactSize": "settings.impactSize",
      "impactLifetime": "settings.impactLifetime",
      "spawnY": "settings.spawnY",
      "fieldWidth": "settings.fieldWidth",
      "spatialGap": "settings.spatialGap",
      "spatialJitter": "settings.spatialJitter",
      "nearSpeed": "settings.nearSpeed",
      "farSpeed": "settings.farSpeed",
      "nearSize": "settings.nearSize",
      "farSize": "settings.farSize",
      "exportFrames": "settings.exportFrames",
      "seed": "settings.seed",
      "spacingCurveEnabled": "settings.spacingCurveEnabled",
      "spatialMode": "settings.spatialMode",
      "quality": "settings.quality",
      "style": "settings.style"
    },
    "preview": "assets/Rainfall_Lab.html",
    "pngBake": "RainExports.bake: 60 default 512px straight-alpha RGBA8 PNGs + sequence.json; frame59 visibly raining, t1 identical t0, cancellation/CRC and intentional vertical clip, explicit x crop rejection.",
    "developerZip": "RainExports.buildPackage webgl/webgpu: same FxRain.mjs and Rainfall.mjs plus versioned FxSpacing/FxCurves/FxColors/FxTimeline; exact pinned runtime Spine4.2 assets and licenses",
    "invariant": "Shared FxRain numeric source is embedded unmodified in offline editor and both ESM developer zips; no alternate physics or hidden burn-style controls."
  },
  "migration": {
    "from": [],
    "unknownVersion": "reject"
  },
  "implementation": {
    "status": "reference-implementation",
    "sourceFiles": [
      "assets/rainfall/src/rain-core.js",
      "assets/rainfall/src/rain-runtime.js",
      "assets/rainfall/src/rain-editor.js",
      "assets/rainfall/src/rain-export.js",
      "assets/rainfall/src/zip-core.js",
      "assets/rainfall/src/ui.html",
      "assets/Rainfall_Lab.html",
      "scripts/build_rain_editor.py"
    ],
    "notes": "WATER-02 specialized deterministic continuous rain, 60Hz core, actual native pooled ParticleContainer renderer, 60f transparent export and two developer ZIPs. All verification must re-run after changes and SHA-bound reports after push."
  }
}
```

## Build and verification

Run `python scripts/build_rain_editor.py --output assets/Rainfall_Lab.html`, `node scripts/test_rain_core.cjs`, `node scripts/test_rain_particles.cjs webgl1|webgl2|webgpu`, `node scripts/test_rain_editor.cjs webgl1|webgl2|webgpu`, `node scripts/test_rain_packages.cjs` and specialist ZIP/Spine/ROI/lifecycle/dev/evidence tests. Never infer real hardware FPS or .skel proof from a JSON fixture. Every user control must have an oracle or explicitly disabled condition.
