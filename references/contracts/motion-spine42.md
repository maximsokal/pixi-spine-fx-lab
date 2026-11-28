# MOTION-M05a — Explicit Spine 4.2 slot alpha timeline

Standalone opt-in authoring adapter, not an existing effect export mode. Requires the pinned Spine runtime 4.2.120 and a loaded matching 4.2.x SkeletonData. No changes to the existing 64-key FxCurves limit, effect settings, renderer, PNG or developer ZIP. No .spine file editing, automatic import, or other Spine version certification.

## Usage

Load motion-core.js before motion-spine42.js in a browser, or use the CommonJS module. The caller supplies the actual pinned runtime namespace and original target SkeletonData. The runtimeVersion field is an explicit caller declaration, not a cryptographic version detector. The adapter validates the expected pinned runtime timeline layout and refuses incompatible data.

```js
const result = FxMotionSpine42.convert({
  schemaVersion: 1, type: 'pulse', durationFrames: 60,
  center: .5, amplitude: .4, cycles: 5, phaseCycles: .137
}, {
  runtimeVersion: '4.2.120',
  slotName: 'halo',
  tolerance: .001,
  protectedSeconds: [.25, .75]
}, spine, existingSkeletonData);
```

The slot must already exist. The result is a Spine JSON animation fragment containing only slots[slotName].alpha. Merge into an animation deliberately; the adapter does not replace other properties or edit the target skeleton. Alpha is absolute in [0,1], not the Electric Aura glowPulse multiplier in [0,2]. Spring, bounce, bone transforms, layered composition, events and editor UI/export integration are outside M05a. Other timelines, attachment alpha, parent transforms, animation blending and rendering may affect final pixels.

## Timing and error

- Authored duration is durationFrames/60 seconds, with both endpoint keys. Protected times and endpoints stay in the JSON, duplicate times are deduplicated, and Float32 collapse is rejected. Native runtimeDurationSeconds may differ from authored durationSeconds by Float32 rounding. For native Spine looping use the actual runtime duration and explicit loop=true; the JSON fragment itself does not enable looping. No change to exclusive PNG frame sampling.
- Adaptive cubic Hermite handles use absolute seconds and alpha values, with exact extrema and endpoint phase. Independent maximum 256 keys; if the tolerance, range or representable time grid cannot be satisfied the adapter throws, rather than dropping keys or silently relaxing the tolerance.
- The initial subdivision budgets analytic Hermite truncation (A*w^4*h^4/384) and ten-piece linear approximation (A*w^2*(h/10)^2/8), with seam and numerical allowances.
- The adapter serializes a minimal rig, parses it with the supplied runtime, checks Float32 frame/curve storage and strict monotonicity and alpha range of every stored point, then calculates a conservative engineering error estimate from the actual piecewise-linear intervals: max endpoint residual + A*w^2*interval^2/8, seam/numerical allowance and final rounded endpoint hold. It subdivides again if necessary. It additionally runs 4097 actual Animation.apply samples against FxMotion, refusing any measured error above the estimate or requested tolerance. This is not interval-certified floating point mathematics or a visual/rendering certificate. The bound applies to standalone alpha at unit mix over the authored window, not long-running loop drift, modified runtimes, or other properties.
- Internal layout checks deliberately depend on the pinned runtime's CurveTimeline storage (nine interior points for ten linear intervals); a different layout is unsupported. See [official 4.2 parser](https://github.com/EsotericSoftware/spine-runtimes/blob/4.2/spine-ts/spine-core/src/SkeletonJson.ts) and [timeline interpolation](https://github.com/EsotericSoftware/spine-runtimes/blob/4.2/spine-ts/spine-core/src/Animation.ts). No upstream code copied.

## Verification

From repository root: `node --test scripts/test_motion_spine42.cjs`. Uses the actual vendored Pixi 8.22.0 and Spine 4.2.120, minimal CPU-only skeletons and independent cosine comparison, including the eight previously failing five-cycle configurations, full alpha range, phase seams, protected keys, constant alpha, target/version and invalid input rejection, key budget and repeatability. No GPU test in this suite. Issue #91 M05a tracks measured evidence; M05 editor integration and complete visual acceptance are separate.
