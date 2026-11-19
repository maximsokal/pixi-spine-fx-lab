# FX-CORE-04 — RGBA gradients and particle-age envelopes (v1)

This is an optional, reusable color contract for **specialized** FX editors, not a monolithic FX graph. Existing Burn Lab colors and smoke/spark fade formulas remain unchanged until the artist enables a new palette or lifetime envelope.

## Sources, compatibility, ownership

- `assets/template/src/color-core.js` exports `FxColors`: `normalize`, `sample`, `serialize`, `deserialize`, `createPreset`, `defaultLifetime`, `normalizeLifetime`, `sampleLifetime`, `multiplierCurve`, `hex`, `composite`. Pure, no DOM/Pixi dependency; requires previously loaded `FxCurves`. It is embedded unchanged as `FxColors.mjs` in both developer ZIPs.
- `assets/template/src/color-ui.js` is a reusable, optional authoring surface with stop add/copy/delete, numeric position, RGB picker, independent alpha, palette presets, interpolation mode, reset, and four `FxCurveEditor` lifetime curves. ID prefixes are unique per mounted editor; UI-only state is never serialized.
- `assets/template/src/emitter-core.js` validates a `lifetime` object on every layer (default disabled), computes gradient color/alpha on each primitive's normalized age, then passes the **straight** RGB hex and final alpha to `emitter-runtime.js`, which lets Pixi perform its own premultiplied compositing. Never premultiply the RGB manually before calling Graphics.
- `assets/template/src/effect-core.js` uses exactly the same `FxColors` contract for legacy sparks if `sparkLifetime.enabled` is true, and for GLSL/WebGL1/2 and WGSL/WebGPU flame palettes when `fireGradientEnabled` is true. The flame shader contains eight `vec4` color stops, two position vectors, and a metadata vector; it interpolates all stops in the selected RGB space. The previous two-color shader is used unmodified *in meaning* when the feature is disabled.
- The isolated 60 FPS PNG bake uses this same effect+layer runtime. Presets, `sequence.json.effectSettings`, WebGL developer ZIP and WebGPU developer ZIP all preserve the color and envelope documents. No external CDN or Pixi upgrades.

## Strict JSON gradient contract

```json
{
  "schemaVersion": 1,
  "parameterKey": "colorOverLife",
  "domain": "particleAge",
  "inputUnit": "normalized-lifetime",
  "space": "linear-rgb",
  "clamp": "hold",
  "stops": [
    {"id": "start", "position": 0, "rgba": [255, 0, 40, 0]},
    {"id": "end", "position": 1, "rgba": [60, 90, 255, 1]}
  ]
}
```

- Up to eight uniquely identified stops, minimum **one**. Positions must be finite, in [0,1], **strictly increasing**. Duplicate positions, unknown fields, NaN, Infinity, unknown version/domain/space, or malformed JSON are errors, not silent repairs. A single stop is a constant color at all inputs.
- RGB is three numerical sRGB channel values in **[0,255]** (not premultiplied); alpha is in **[0,1]**. RGB can be nonzero when alpha=0. Such RGB is retained exactly in serialized JSON for later edits; it produces no composited contribution when alpha=0. The output PNG is straight-alpha RGBA8, with the WebGL readback unpremultiplied **exactly once** per the [PNG PMA regression](../validation.md).
- `space:'srgb'` linearly interpolates encoded sRGB channels, while `space:'linear-rgb'` applies the standard sRGB transfer to each endpoint, linearly interpolates scene-linear channels, and converts back to encoded sRGB. Alpha always interpolates linearly, **not** gamma-corrected. Example: opaque red/blue midpoint is RGB approximately [128,0,128] in sRGB and [188,0,188] in linear RGB.
- Inputs before/after the first/last stop hold their nearest stop's RGBA. Transparent bright glow must never darken from accidentally applying premultiplication twice.
- `domain:'particleAge'` requires `inputUnit:'normalized-lifetime'`; `domain:'effectTime'` requires `normalized-duration`. Flame palette uses a separate independent domain `flameIntensity` and `normalized-intensity` so a shader's ember/hot intensity is never falsely described as particle age. These are different spatial/temporal quantities.
- Editable starting palettes: **Natural**, **Stylized**, **Magical**. They are taste presets, not physically calibrated constants or immutable values.

## Lifetime JSON and multiplication order

An enabled `lifetime` document is:

```json
{
  "schemaVersion": 1,
  "enabled": true,
  "colorOverLife": {"...": "full versioned RGBA gradient with particleAge domain"},
  "alphaOverLife": {"...": "FxCurves v1 with particleAge / multiplier"},
  "sizeOverLife": {"...": "FxCurves v1 with particleAge / multiplier"},
  "glowOverLife": {"...": "FxCurves v1 with particleAge / multiplier"},
  "opacityOverLife": {"...": "FxCurves v1 with particleAge / multiplier"}
}
```

All four scalar curves use `FxCurves` v1: `domain:'particleAge'`, `inputUnit:'normalized-lifetime'`, `valueUnit:'multiplier'`, `inputRange:[0,1]`, `valueRange:[0,4]`. Normalized life `age = clamp((absoluteSeconds - particle.birthSeconds)/particle.lifeSeconds,0,1)`. Independent emitter primitives with their own deterministic birth phase use their **individual** normalized age rather than the emitter's global age. Static glow/ray/postprocess shapes use normalized emitter age when there is no independent particle birth.

**Evaluation order:** sample straight RGBA at age → sample scalar curves → `finalAlpha = clamp(gradientAlpha × alphaOverLife × opacityOverLife × layerOpacity,0,1)` → `finalGeometrySize = originalGeometrySize × sizeOverLife` → `glowRadius = scaledRadius × glowOverLife` (only for glow/postprocess layers; sparks use a separate optional glow ring) → send straight RGB and final alpha to Pixi Graphics → Pixi premultiplies for normal/additive blending. When size or relevant glow reaches zero, the primitive contributes nothing. The **authored envelope replaces old hidden automatic fading** while enabled; it never gets multiplied by the legacy fade again. When disabled, keep legacy appearance exactly.

For Burn sparks, `sparkBlend` is `normal` or `add`, default additive. The optional glow halo runs only in non-low quality modes. Flame's mask and source image alpha still follow the reference shader's original premultiplied compositing; gradient alpha scales only new flame/halo emission, not the Spine input image.

## Tests

Run `node scripts/test_colors.cjs` for numerical gradient endpoints, sRGB/linear midpoint, alpha 0 and 1, one/8-stop/duplicates, nonfinite JSON rejection, palettes and 30/60/120 FPS. Run `node scripts/test_color_emitters.cjs` for per-layer alpha/size/glow, independent emitter RNG, disabled fallback and deterministic seeking. Run `node scripts/test_color_editor.cjs --html assets/Spine_Burn_Lab.html --backend webgl|webgpu --output OUT` for real artist controls, flame/glow pixel differences, light/dark/checkerboard composites, 40-frame straight-RGBA PNG, preset fidelity, and Node ESM imports of both developer packages; use `--webgl1` for an **actual** WebGL1 renderer.

Also rerun existing curve/spacing/emitter/PNG PMA and lifecycle smoke regressions and build extracted Vite developer ZIPs with pinned PixiJS 8.22.0 and spine-pixi-v8 4.2.120. Byte comparison across *different* GPU renderers is not required; settings and numerical sampled color must agree. Device-specific performance remains unverified until measured physically. The pinned Chrome/SwiftShader WebGL1 path logs `WebGL: INVALID_ENUM: texParameter: invalid parameter name` even on the unmodified preceding release (#5). The browser regression filters only that baseline warning (and the known software-fallback deprecation); all new shader compilation and other validation errors are still failures.
