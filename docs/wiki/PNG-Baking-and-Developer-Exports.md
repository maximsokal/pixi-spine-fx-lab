# PNG Baking and Developer Exports

## Transparent PNG sequences

The baseline bake creates a ZIP containing `frames/frame_00000.png` onward, `sequence.json` and English integration instructions. Each PNG uses the requested **full, untrimmed** width and height with transparent RGBA pixels: no editor checkerboard, controls, crop guides or HTML are included.

The documented baseline samples frames at **60 FPS** using exact times `i / 60` seconds for `i = 0..N-1`. A 90-frame export spans 1.5 seconds with the last sample at 89/60; the endpoint is exclusive. Do not insert an unexplained duplicate ending frame.

Baseline bounds from [product-contract.md](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/product-contract.md):
- Dimensions: 1–4096 pixels per axis, subject to actual GPU limits.
- Frames: 1–3600.
- Encoded frame budget: at most 192 MiB.

Effect-specific editors can constrain default dimensions, duration, repeat/stop behavior, or isolated/composited output differently; **check the selected Blueprint** instead of assuming every effect has the same 60-frame loop. In particular a repeat-impact splash is not a seamless loop, and some water/air editors offer separate stop sequences.

## Determinism and ownership

The bake must freeze input parameters, crop, transforms and seed, reconstruct from fixed simulation time, and preserve the user's live preview pose and settings. Camera zoom and the visibility of editing guides must not affect exported bytes for the same settings/backend.

Cancelling should leave no partial ZIP and must release temporary GPU/CPU resources. Retrying a bake must not leak filters, render targets or scene layers.

## Alpha and color correctness

Pixi's rendering pipeline uses premultiplied alpha internally. For encoded **WebGL PNG bytes**, the reference uses readback + **exactly one** RGBA unpremultiplication before writing straight-alpha PNG data. WebGPU already handles its own conversion; applying the WebGL correction to WebGPU bytes again is incorrect.

Dark fringes around flame/glow are a symptom worth testing with partially transparent orange pixels on light and dark backgrounds, not proof that an artist must change their texture. See [FX-PNG-PMA-01](https://github.com/maximsokal/pixi-spine-fx-lab/issues/2) and [[Validation-and-Tests]].

## Developer handoff ZIPs

Export WebGL and WebGPU-preferred integration packages **separately**. The documented package contract includes the current preset, matching Spine exports and texture pages, effect implementation, readable shaders where applicable, pinned dependencies, a runnable Vite example, English README, and required third-party notices. WebGPU-oriented output must specify its WebGL fallback and real backend limitations.

Building an exported Vite example needs Node.js 20.19+ or 22.12+.

Before shipping to a game, check: settings/seed/timing parity between preview and exported code; atlas paths; alpha blending; resize behavior; device renderer support; teardown and repeated creation; and correct license redistribution.

## What is not promised

The shipped baseline does not export MP4/WebM, import `.spine` projects, run arbitrary Spine versions, or automatically port every custom shader to every rendering backend.

Source: [validation requirements](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/validation.md).
