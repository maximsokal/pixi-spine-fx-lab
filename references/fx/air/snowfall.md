# AIR-02 — Snowfall

**Status:** implementation candidate pending real-GPU and export acceptance (machine-readable lifecycle remains specification-only until the evidence gate passes). Issue #24.

Build the independent editor from the full repository with `python scripts/build_snow_editor.py --output Snowfall_Lab.html`. Numerical core, native particle runtime, editor, isolated PNG bake and developer ZIP source paths are present under `assets/snowfall/src/`. The assembly and CPU contracts have been tested; actual browser startup, WebGL1/2/WebGPU raster, pixel-alpha parity, PNG ZIP and both Vite builds still require real-runtime verification. The fixed 512×512 field intentionally clips flakes entering/leaving its bounds. Run `node --test scripts/test_snow_core.cjs scripts/test_snow_schedule.cjs scripts/test_snow_runtime.cjs scripts/test_snow_editor.cjs` and `python scripts/test_snow_builder.py` before browser acceptance.

Run `node --test scripts/test_snow_zip.cjs` for the independent ZIP-store regression suite. The writer rejects raw unsafe names, case-insensitive file collisions, file/directory prefix conflicts, invalid UTF-8 names and classic ZIP filename-length overflow. The 256 MiB bound includes headers, names and central directory; cancellation during asset reads rejects rather than returning a partial archive. These checks do not certify raster pixels or cross-platform extraction of arbitrary-length names.

## Visual and numerical contract

Soft falling flakes with three independent layers: near flakes, far flakes and optional wind swirls (off by default). Natural, Stylized and Magical are separate editable palettes; default straight-alpha white to pale blue (#FFFFFF to #D6EAFB). Preserve transparent pixels and vary snowflake silhouettes rather than reusing rain streaks.

At 60 authored FPS the default 60-frame loop is one second, while a 512 px crossing at 50 px/s takes 10.24 seconds. Use a periodically tiled, pre-rolled field: repeat birth signatures every period and reconstruct earlier cycles. Flakes continue moving at the seam; never reset the entire field or hide the seam with a mass fade. This repeats motifs at short periods; offer 600–960 frame scenic loops. A separate 40-frame one-shot has a stop fade, not a discontinuous loop.

22 births/s is the **shared** baseline per emitter across near/far (approximately 35/65); disabling a layer does not reassign its events. Four emitters maximum. Depth Variation changes speed, size and opacity independently by layer. Drift and rotation curves shape integrated velocity with normalized mean (zero speed freezes that axis); alpha follows actual flight age, not the UI loop. Rate changes birth timestamps; horizontal spacing changes launch distances without changing birth count. Use the FX-CORE-02 horizontal cubic arc-length schedule, 0.25 px maximum error, independent seeded jitter. Reject configurations exceeding the full-effect particle budget before allocating pools; no silent dropping. Proposed caps below are engineering limits, not GPU measurements.

Every layer owns its enable/visibility, XY, rotation, seed, timing offset, opacity, blend and anchor. Anchors support world, skeleton, bone, slot and active attachment, with layer inheritance; missing anchors hide only the affected layer. Use pooled native PixiJS ParticleContainer groups per layer/shape with three reusable white-RGB antialiased alpha masks. Pinned PixiJS 8.22.0 and Spine 4.2.120. No new dependencies or CDN.

## Machine-checkable Blueprint

```json
{
  "blueprintSchemaVersion": 1,
  "effectId": "fx.air.snowfall",
  "effectVersion": "0.1.0",
  "presetSchemaVersion": 1,
  "category": "air",
  "styles": ["natural", "stylized", "magical"],
  "visualGoal": "A soft transparent pre-rolled field of varied snowflake silhouettes with slow descent, independent near/far depth and optional wind swirls.",
  "phases": [
    {"id":"start","at":0,"look":"Already populated snowfield in loop mode; initial one-shot pose"},
    {"id":"middle","at":0.5,"look":"Flakes fall and drift continuously with individual age fades and near/far variation"},
    {"id":"seam","at":1,"look":"Loop matches the start exactly with continuous trajectories; one-shot ends transparent"}
  ],
  "layers": [
    {"id":"near","kind":"particles","position":"front","purpose":"Larger near flakes; independently enabled and anchored"},
    {"id":"far","kind":"particles","position":"behind","purpose":"Smaller slower far flakes; independently enabled and anchored"},
    {"id":"windSwirls","kind":"particles","position":"front","purpose":"Optional subtle wind swirls; disabled by default"}
  ],
  "emitterAnchors": [
    {"id":"near","space":"world/local/Spine","onMissing":"hide-only-this-layer"},
    {"id":"far","space":"world/local/Spine","onMissing":"hide-only-this-layer"},
    {"id":"windSwirls","space":"world/local/Spine","onMissing":"hide-only-this-layer"}
  ],
  "parameters": [
    {"key":"flakesPerSecond","type":"number","default":22,"unit":"events-per-second","controlGroup":"Snow","exportPath":"settings.flakesPerSecond","min":0,"max":120,"step":1},
    {"key":"flakeSize","type":"number","default":7,"unit":"logical-pixels","controlGroup":"Snow","exportPath":"settings.flakeSize","min":2,"max":20,"step":0.5},
    {"key":"fallSpeed","type":"number","default":50,"unit":"logical-pixels-per-second","controlGroup":"Motion","exportPath":"settings.fallSpeed","min":5,"max":240,"step":1},
    {"key":"windDrift","type":"number","default":24,"unit":"logical-pixels-per-second","controlGroup":"Motion","exportPath":"settings.windDrift","min":-120,"max":120,"step":1},
    {"key":"rotationSpeed","type":"number","default":45,"unit":"degrees-per-second","controlGroup":"Motion","exportPath":"settings.rotationSpeed","min":-180,"max":180,"step":1},
    {"key":"depthVariation","type":"number","default":0.45,"unit":"normalized-0-1","controlGroup":"Snow","exportPath":"settings.depthVariation","min":0,"max":1,"step":0.01},
    {"key":"horizontalGapPx","type":"number","default":24,"unit":"logical-pixels","controlGroup":"Spacing","exportPath":"settings.horizontalGapPx","min":4,"max":100,"step":1},
    {"key":"spatialMode","type":"enum","default":"even","unit":"mode","controlGroup":"Spacing","exportPath":"settings.spatialMode","choices":["even","random","clustered","stratified"]},
    {"key":"spatialJitter","type":"number","default":0.12,"unit":"normalized-0-1","controlGroup":"Spacing","exportPath":"settings.spatialJitter","min":0,"max":0.45,"step":0.01},
    {"key":"fieldWidth","type":"number","default":512,"unit":"logical-pixels","controlGroup":"Spacing","exportPath":"settings.fieldWidth","min":64,"max":2048,"step":1},
    {"key":"seed","type":"integer","default":7321,"unit":"int32","controlGroup":"Advanced","exportPath":"settings.seed","min":-2147483648,"max":2147483647,"step":1},
    {"key":"mode","type":"enum","default":"loop","unit":"mode","controlGroup":"Timing","exportPath":"settings.mode","choices":["loop","oneShot"]},
    {"key":"durationFrames","type":"integer","default":60,"unit":"frames-at-60fps","controlGroup":"Timing","exportPath":"settings.durationFrames","min":40,"max":960,"step":1,"help":"40 for oneShot; 60 or 600–960 for loop"},
    {"key":"exportFrames","type":"integer","default":60,"unit":"frames-at-60fps","controlGroup":"Timing","exportPath":"settings.exportFrames","min":1,"max":3600,"step":1},
    {"key":"quality","type":"enum","default":"balanced","unit":"profile","controlGroup":"Advanced","exportPath":"settings.quality","choices":["low","balanced","high"]},
    {"key":"style","type":"enum","default":"natural","unit":"style","controlGroup":"Color","exportPath":"settings.style","choices":["natural","stylized","magical"]}
  ],
  "controlGroups": ["Snow","Motion","Spacing","Timing","Color","Advanced"],
  "requiredContracts": ["parameters","curves","spacing","emitters","colors","timeline"],
  "curves": [
    {"id":"drift","key":"driftCurve","domain":"effectTime","contract":"curves","keys":[[0,0.3],[0.5,0.8],[1,0.3]]},
    {"id":"flake-alpha","key":"flakeAlphaCurve","domain":"particleAge","contract":"curves","keys":[[0,0],[0.15,1],[0.85,1],[1,0]]},
    {"id":"rotation","key":"rotationCurve","domain":"particleAge","contract":"curves","keys":[[0,0],[1,1]]},
    {"id":"emission-rate","key":"emissionRateCurve","domain":"effectTime","contract":"curves","keys":[[0,1],[1,1]]},
    {"id":"horizontal-spacing","key":"horizontalSpacingCurve","domain":"pathPosition","contract":"curves","keys":[[0,1],[1,1]]}
  ],
  "spacing": {"enabledByDefault":true,"contract":"spacing","modes":["even","random","clustered","stratified"],"note":"Independent integrated birth times and horizontal cubic arc-length launch distances; no frame-driven births"},
  "palettes": [{"id":"snow-color","key":"palette","domain":"particleAge","contract":"colors","stops":[[0,"#FFFFFF",1],[1,"#D6EAFB",1]]}],
  "rng": {"policy":"seeded-per-instance","seedParameter":"seed","streamPolicy":"Stable emitter/layer/event streams; no global Math.random"},
  "rendering": {"approach":"particles","strategy":"Proposed native pooled ParticleContainer groups with reusable straight-alpha flake masks","backends":["webgl1","webgl2","webgpu"],"runtimePins":{"pixi":"8.22.0","spine":"4.2.120"},"fallback":"Explicit WebGL fallback; no silent missing layer","shaderStatus":"not implemented or tested"},
  "qualityBudgets": {"low":{"particles":512,"eventsPerEmitter":4096},"balanced":{"particles":2048,"eventsPerEmitter":4096},"high":{"particles":4096,"eventsPerEmitter":4096}},
  "tests": {"verified":false,"evidence":[],"required":["Shared 22/s birth count and independent rate/spacing curves","Nonempty pre-roll and continuous exact loop seam","Near/far depth and independent missing-anchor isolation","Bounded events and particle memory; reject over-budget settings","True transparent PNG, alpha fringe checks and camera-invariant bake","Real WebGL1/2/WebGPU and both offline developer ZIP builds"]},
  "outOfScope": ["3D volumetric clouds","Weather simulation","Unverified renderer or export claims"],
  "exportMapping": {"presetSchemaVersion":1,"settingsRoot":"settings","parameterMap":{"flakesPerSecond":"settings.flakesPerSecond","flakeSize":"settings.flakeSize","fallSpeed":"settings.fallSpeed","windDrift":"settings.windDrift","rotationSpeed":"settings.rotationSpeed","depthVariation":"settings.depthVariation","horizontalGapPx":"settings.horizontalGapPx","spatialMode":"settings.spatialMode","spatialJitter":"settings.spatialJitter","fieldWidth":"settings.fieldWidth","seed":"settings.seed","mode":"settings.mode","durationFrames":"settings.durationFrames","exportFrames":"settings.exportFrames","quality":"settings.quality","style":"settings.style"},"preview":"not-implemented","pngBake":"not-implemented","developerZip":"not-implemented","invariant":"One shared numerical and rendering implementation for preview, isolated bake and both ZIPs"},
  "migration": {"from":[],"unknownVersion":"reject","policy":"Reject unknown versions; explicit migration only"},
  "implementation": {"status":"specification-only","sourceFiles":[],"notes":"T01 contract and routing only; runtime, editor and export require their own evidence."}
}
```
