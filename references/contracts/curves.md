# FX-CORE-01 — Universal curve contract (v1)

Reusable numerical curve evaluation and optional authoring UI for **specialized** FX Labs. This does not create a monolithic all-effects editor. The public format is independent of Pixi, Spine and browser DOM.

## Source and integration

- `assets/template/src/curve-core.js` defines `FxCurves`: `normalize`, `evaluate`, `createPreset`, `serialize`, `deserialize`, and `sample`. It can be loaded as a browser global, a CommonJS module, or via the generated `FxCurves.mjs` developer module.
- `assets/template/src/curve-editor.js` defines optional SVG `FxCurveEditor.mount()` (browser only). Each specialized editor may mount it on a declared parameter; do **not** expose unrelated controls globally.
- `assets/template/src/effect-core.js` uses the same evaluator for the Burn Lab's `easing=4` ("Custom curve") in live playback and developer integration. Legacy easing values 0–3 preserve their original polynomial formulas.
- The PNG bake samples `SpineBurnFx.ease(t, 4, settings.timeCurve)` with `t=(frameIndex/60)/settings.duration` (clamped to 1), so the output contains exactly the preview's timing curve. PNG `sequence.json` and both developer `preset.json` exports embed the canonical curve.
- The generated developer ZIP includes `FxCurves.mjs`; `BurnTransition.mjs` imports it before evaluating the shared effect. No CDN or extra runtime dependencies.

## Public JSON schema, version 1

```json
{
  "schemaVersion": 1,
  "parameterKey": "transitionProgress",
  "domain": "effectTime",
  "inputUnit": "normalized-duration",
  "valueUnit": "normalized",
  "inputRange": [0, 1],
  "valueRange": [0, 1],
  "defaultValue": 0,
  "clamp": "hold",
  "monotonic": true,
  "keys": [
    {"id": "start", "x": 0, "y": 0, "mode": "bezier", "out": [0.42, 0]},
    {"id": "end", "x": 1, "y": 1, "mode": "linear", "in": [0.58, 1]}
  ]
}
```

- `parameterKey`: stable ID, not a UI position or label. `domain`: `effectTime`, `emitterTime`, `particleAge`, or `pathPosition`. No implicit rebinding is allowed.
- `inputUnit`: `seconds` or `normalized-duration` for effect/emitter time; `seconds` or `normalized-lifetime` for particle age; `pixels` or `normalized-path` for distance. Normalized inputs always have range [0, 1]. Simulation time uses seconds, not render ticks.
- `valueUnit`: parameter-specific unit. `valueRange` and `defaultValue` are explicit. `clamp="hold"` retains the first/last value outside the input domain; `clamp="default"` uses `defaultValue` outside it. All included key/handle values must lie in range.
- Keys are sorted by strictly increasing x, have unique stable `id`, and number 2–64. First/last x must cover the declared inputRange exactly. Duplicate positions and nonfinite values are errors.
- `mode` is the **outgoing segment** type: `linear`, `stepped` (holds previous y until next key), or `bezier`. Bezier segments require an `out: [x,y]` on the left key and `in: [x,y]` on the right key. Both handles must be inside the segment with ordered x values; vertical tangents at endpoints are allowed.
- Cubic Bézier inversion uses 36 fixed binary-search iterations on x(t), not naïve interpolation of t. Evaluations are independent of preview/backend/frame rate. A value curve can be nonmonotonic; `monotonic: true` rejects descending key/Bezier handles. `transitionProgress` must start at y=0 and end at y=1.
- An unknown version, unknown property, unsupported unit/domain combination, invalid handle, nonfinite number, or malformed JSON is rejected, never quietly repaired during preset import. Any future v2 must use an explicit reviewed migration; v1 serialization round-trips without UI state.

## Editor behavior

Use `FxCurveEditor.mount(root, {curve, onChange, onScrub, getFrameCount})`. Returned methods: `setCurve`, `getCurve`, `refresh`. UI state (selected key, pointer capture, frame-snap toggle, view transform, status text) **is not serialized**. Curves are immutable snapshots for callbacks.

Authoring tools: preset selection, Add/Copy/Delete key, Reset, numeric key frame/value, outgoing interpolation selection, numeric handle editing, SVG key/handle dragging and graph-click scrubbing. Frame snapping is `frame / durationFrames`, with 60 authoring frames per second. Screen and camera zoom never enter the public curve or bake math. The reusable editor maps arbitrary declared input/value ranges to SVG coordinates; distance curves use pixel positions, second-based curves snap to 1/60 second, and normalized curves snap to whole authoring frames. A nonmonotonic value-curve editor exposes Slow Decay, Pulse and Burst, while the timing-curve editor intentionally omits them.

Available pure presets: Linear, Ease In, Ease Out, Ease In/Out, Fast Attack, Slow Decay, Pulse, Burst. **Only increasing presets** are selectable for the Burn Lab's time-warp; decreasing/pulsing presets are valid as nonmonotonic **value curves** for later effect-specific editors, but cannot be silently applied to time-warp. This restriction is intentional.

## Acceptance / RED→GREEN

```sh
node scripts/test_curves.cjs
node scripts/test_curve_editor.cjs --html assets/Spine_Burn_Lab.html --backend webgl --output curve-webgl
node scripts/test_curve_editor.cjs --html assets/Spine_Burn_Lab.html --backend webgpu --output curve-webgpu
node scripts/smoke_editor.cjs --html assets/Spine_Burn_Lab.html --backend both --output curve-smoke
```

Numerical assertions cover all eight presets, deterministic endpoints/midpoints, steep/vertical Bézier handles, monotonic enforcement, invalid keys, duplicate frame positions, 30/60/120 FPS, and JSON round-trips. Browser integration asserts actual editable UI operations, real preview-vs-bake numerical parity across 40 frames, correct `sequence.json`, successful Node ESM imports from **both** developer ZIPs, and no network access.

Always preserve original PixiJS/spine-pixi-v8 pins, 60 FPS bake rules, exporter ZIP schema, offline sample/loading, alpha readback and smoke verifiers. Do not expand this first integration into spacing, emitters, gradients, or independent effect editors without their own approvals.
