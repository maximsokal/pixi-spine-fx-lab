# FX-CORE-05 — Deterministic Timeline, Seek and PNG Baking (v1)

This is a shared time contract for specialized Spine/Pixi FX editors, not a general FX graph. Pinned runtime: PixiJS 8.22.0 and spine-pixi-v8 4.2.120. Offline HTML, developer modules and isolated PNG baking share one effect implementation.

## Dependency and clock ownership

1. FxCurves evaluates effect progress; FxSpacing evaluates time/distance placement; FxColors evaluates particle age. FxTimeline owns seconds-based transport, seed, fixed-step replay and CPU checkpoints.
2. FxEmitters / FxEmitterRuntime retain absolute-time sampling and independent per-emitter seed. Never share a mutable Math.random stream between emitters.
3. SpineBurnFx owns seeded PRNG and uses seek(seconds,{progressAt,poseAt}); both preview and bake call this API. The developer ZIP example imports FxTimeline.mjs.
4. Renderer elapsedMS advances the transport only. The actual number of ticker callbacks, encoding time, camera zoom and file download time never control the authored effect time.

**Five distinct domains:** effectTime is absolute seconds since the effect starts; emitterLocalTime is effectTime minus emitter.timeOffset (it may be negative before start); particleAge is clamp((effectTime - birthTime) / lifetime,0,1); pathPosition is normalized traveled arc length independent of time and emitter velocity; spineAnimationTime is independent absolute seconds applied to the pinned Spine state by FxTimeline.seekSpine(model,seconds). Do not conflate particle age, Spine time, emitter offset or path position.

Author in 60 FPS frames but compute in seconds. Canonicalize timestamps within 1 ns of an exact 60 FPS frame boundary to remove 30/60/120 FPS floating-point clock drift. Other fractional times remain valid.

## Absolute-time transport

FxTimeline.createTransport({duration,time,direction,loop,playing}) exposes seek, play, pause, reset, tick, setLoop, setDuration, state.

- Pause stops FX/particle physics, shader noise and progress, not an independently enabled Spine preview animation.
- Resume starts from the stored time without generating missed emissions. The new Play backward control decrements effect time; the previous Reverse direction checkbox still only reverses the geometric burn mask.
- Reset returns to zero and resets the owned PRNG; Loop wraps to the start/end without emitting duplicate seam events or accumulating missed frames. Non-looping transports stop exactly at their endpoints.
- Manual progress changes invert the selected easing curve to seek absolute effect time. For stepped or nonmonotonic easing where inversion is ambiguous, an explicitly authored absolute time must take priority over inverse progress.
- FxTimeline.createPrng(seed) owns a uint32 state with next, state, setState and reset. Never call Math.random to generate owned FX particles. The same seed, settings and pose history must reproduce the same particles.

## Fixed-step reconstruction and checkpoints

FxTimeline.createReplay({capture,restore,step,partial,render,fps:60,checkpointEvery:60,maxCheckpoints:64}) evaluates integer 1/60-second steps. It stores CPU-only snapshots at most once per 60 frames and retains at most 64 checkpoint states; frame zero remains even if old intermediate checkpoints are evicted. Snapshots contain particle age, position, velocity, emission counter, event history, progress and PRNG state, but no Pixi render textures, GPU buffers, filters or live attachment textures. Seek restores the nearest previous checkpoint and simulates forward to the target. A fractional remainder is applied to a temporary copy; the integer frame snapshot remains immutable. Never skip a physics step just because live FPS dropped.

Changing seed, bounds, parameters, animation selection or pose source invalidates the relevant instance replay state. Two calls to the same seek time, including after 30 -> 10 -> 30, produce the same ordered particles and pose. A per-instance seed avoids changes in other emitters when one is enabled/disabled.

## PNG bake and state preservation

- Bake between 1 and 3600 frames. The N samples are i / 60 seconds for i = 0..N-1. The endpoint at N/60 is exclusive. For 40 frames the final sample is 39/60 = 0.65 s; for 6 frames it is 5/60; for 3600 it is 3599/60. Add one more frame if an exact endpoint is required.
- Bake creates an isolated Spine skeleton, Burn FX, emitter layers and render target; seek each exact frame timestamp with the same effect evaluator. For the animation use FxTimeline.seekSpine with either the authored animationSpeed or zero when Animate skeleton is disabled. No repeated accumulation of dt or animated pose from a previous frame.
- Existing capture crop, filename, resolution, straight-RGBA PNG, WebGL single-pass unpremultiplication, WebGPU aligned texture-to-buffer conversion and per-backend pixel characteristics remain. Live preview never reads GPU pixels per frame. Metadata records renderer, seed, user settings, frame time formula and timeline clock/checkpoint policy. Do not add nondeterministic wall-clock timestamps.
- Keep the 192 MiB encoded PNG data bound, 256 MiB ZIP bound, and actual device GPU texture limits. Unmap/destroy temporary GPU staging resources on all paths.
- A failed or cancelled export never downloads a partial ZIP; both clear temporary resources and leave the live phase, pose, PRNG, particles, playback flags and UI usable. Do not unconditionally call layoutPreview()/fit() in the bake finally block: this used to clear live particles. Refit only if the actual viewport resized, then re-seek original time.
- Repeating bake with identical settings, backend, device and environment must produce byte-identical PNGs and metadata. Different GPUs are not required to generate identical raster bytes.

## Verification

- scripts/test_timeline.cjs: independent clock, pause, reverse, loop, frame-boundary rounding, seed, normalized time domains, fractional replay, checkpoint bounds and 30/60/120 FPS numerical oracle.
- scripts/test_timeline_editor.cjs: real Spine and nonempty particle state on 30 -> 10 -> 30 seek, repeated PNG bake equality, unchanged live pose/particles after bake, 40 frame i/60 metadata. Use --webgl1 to demand a real WebGL1 context.
- scripts/test_bake_lifecycle.cjs: cancellation, injected GPU/encoding failure, cleanup and no partial download. smoke_editor.cjs checks 6 frames, transparency, camera invariance, offline load and developer exports.
- Re-run color, curve, spacing, emitter, alpha and lifecycle regression suites, and build both developer ZIPs with pinned Vite and dependencies. Physical-device 4096px/3600-frame performance is not certified without hardware measurements.

## Scope

This module is intentionally shared without turning the burn sample into a universal FX graph. Per-FX specialized controls remain independently authored; modules are loaded on demand from SKILL.md.
