# MOTION-M03 — Authored cues and independent secondary motion (v1)

Pure authoring helper, not a new simulation clock, emitter scheduler, or compositor.
Load motion-core.js before motion-choreography.js in a browser, or require the latter in Node.
This module is not loaded by any existing editor yet.

## Example

```js
const H = require('../../assets/template/src/motion-choreography.js');
const compiled = H.compile({
  schemaVersion: 1,
  durationFrames: 120,
  anticipationFrame: 12,
  releaseFrame: 24,
  peakFrame: 36,
  seed: 73,
  style: H.profile('power', {lagFrames: 4, jitterFrames: 0}),
  elements: [
    {id: 'trail', depth: 0, seed: 11, enabled: true, weight: 1, phaseCycles: 0},
    {id: 'ribbon', depth: 2, seed: 17, enabled: true, weight: .7, phaseCycles: .25}
  ]
});
const pose = compiled.sample(48 / 60);
```

## Contract

- All settings are explicit. Duration is an integer 4–3600 authored frames at 60 FPS. Cue frames obey 0 < anticipation < release < peak < duration. Four intervals require at least four frames. No profile changes cue frames. Cues are immutable seconds. The release is a timestamp for the caller, not an event dispatch.
- Primary output is a signed, normalized displacement and its velocity per second: 0, negative anticipationAmplitude, 0 at release, positive peakAmplitude, 0 at end. Intervals use cubic smoothstep with zero velocity at each cue. Outside the finite window the terminal result is zero.
- Up to 64 elements, matching the existing total layer budget. Stable IDs are unique within this configuration. Explicit depth 0–63 is not array position. Both seeds are signed int32. Weight 0–10; enabled is boolean; base phaseCycles in [0,1). Disabled elements remain in the sample with zero displacement and velocity; siblings never inherit their seed or depth.
- Secondary starts at (peakFrame + depth*lagFrames + keyedJitter)/60. Delay jitter is nonnegative, bounded by jitterFrames and derived separately from phase jitter. Nonzero-gain plans whose onset is at or after the end are rejected even when disabled, so enabling a saved element cannot silently truncate the movement. Zero-gain plans have no motion.
- Reuse the analytic unit-velocity spring in FxMotion. Gain is secondaryAmplitude * 2*pi*frequencyHz * weight * attenuation^depth. This is an artistic launch gain, not a guarantee of a specified maximum displacement or physical drag coefficient. At onset velocity is right-sided; the intentional impulse has zero displacement. A cubic terminal fade over the remaining recovery window multiplies the spring value; velocity includes the product derivative. The pose and velocity reach exact zero at the end even for undamped springs.
- Phase metadata is (base phase + keyed phase variation) modulo 1. It can be passed to the existing FxMotion pulse sampler by a future caller. It is not an implicit shift of the primary timeline or a periodic secondary spring. Both random channels are keyed by global seed, element ID, element seed and channel, with no mutable PRNG or array index. This is deterministic artistic variation, not a cryptographic hash.
- Sample at arbitrary finite nonnegative seconds. No cumulative dt, frame rounding, event catch-up, ticker, DOM or GPU state. The caller retains responsibility for timeline snapping and exclusive PNG endpoints. Settings, cue and element metadata snapshots are immutable.

## Style parameters

Profiles calm, elegant, power, playful, joy, urgent and energy supply editable suggestions, not measured emotion models. Each parameter can be overridden independently with profile(name, overrides) or provided explicitly. No hidden duration or release ratios.

| Field | Range / unit |
|---|---|
| anticipationAmplitude, peakAmplitude, secondaryAmplitude | 0–10, normalized |
| lagFrames, jitterFrames | 0–60, authored frames, fractional allowed |
| attenuation | 0–1, per depth |
| frequencyHz | 0.1–20 Hz |
| dampingRatio | 0–4 |
| phaseJitterCycles | 0–1 cycles |

The primary output is signed; do not bind it directly to an opacity or monotonic transitionProgress. A caller must choose an appropriate parameter mapping and range.

## Provenance and acceptance

Original numerical implementation motivated by the upstream MIT-licensed [anticipation](https://github.com/dylantarre/animation-principles/blob/83597134ba8ff59838270f94d7ac7282ffa3b54d/skills/11-by-principle-focus/anticipation-mastery/SKILL.md), [follow-through](https://github.com/dylantarre/animation-principles/blob/83597134ba8ff59838270f94d7ac7282ffa3b54d/skills/11-by-principle-focus/follow-through-overlapping/SKILL.md) and [continuous loops](https://github.com/dylantarre/animation-principles/blob/83597134ba8ff59838270f94d7ac7282ffa3b54d/skills/05-by-animation-type/continuous-loops/SKILL.md). No upstream text, code, assets or fixed timing prescriptions copied. Reuses existing FxMotion and repository emitter hash/mix convention. See issue #91 for the scope review and remaining upstream coverage audit.

Run from repository root: node --test scripts/test_motion_choreography.cjs scripts/test_motion_curve.cjs. Numerical acceptance is not renderer certification. M04 must bind one approved specialized editor, expose artist controls, protect existing defaults and test preview/bake/ZIP parity. M05 must review Spine timeline conversion and runtime support independently. No existing effect or exporter consumes this module yet.
