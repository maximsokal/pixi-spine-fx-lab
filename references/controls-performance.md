# Artist control and performance contract

## Meaningful maximum control

Inventory every parameter that materially changes the requested visual result. For each, define key, label, type, range, step, default, units, tooltip, reset behavior, animation/timeline mapping and serialized/export mapping. Include conditional controls and expert groups rather than exposing irrelevant implementation constants.

Choose relevant groups from geometry/origin/direction, intensity/radius/softness, colors/gradient/alpha, procedural scale/seed/evolution, particles/spread/lifetime/gravity, source textures/maps, time/duration/easing/reverse, and quality. Do not invent a filter setter unsupported by its exact version. Validate finite numbers, colors, enum values and required resources at both import and runtime boundaries.

Make each slider demonstrably affect output. Add a repeatable reset and preserve all artist choices in the preset. Keep effect-specific resources in developer exports. Do not expose low-level buffer alignment, internal render-target formats or shader compilation details in artist UI.

## Performance

Keep Low/Balanced/High explicit. The seed limits filter resolution, shader sampling steps, halo taps, spark count, emission and emitter sampling. Budget the whole chain, not each filter in isolation. Avoid unbounded pass counts, per-frame shader recompilation, full-resolution intermediates when unnecessary, per-frame allocation and live GPU readback.

Track the effect's influence region and use conservative expansion for animated meshes, glow, distortion and particles. Use full-frame fallback if a bound cannot be proved safe. Do not silently clip to gain FPS.

Prefer WebGL 1 + Low for older mobile targets. Check precision, texture limits and actual extensions. Supply an equivalent implementation or reviewed fallback if the desired effect needs unsupported features. Preserve backend-specific tests; WebGPU must not silently execute a no-op.

Record device, browser, backend, output/viewport size, quality and active layers when reporting performance. Do not promise stable FPS from a phone model year. Physical-device performance is unverified until measured.
