# Troubleshooting

## Blank viewport or skeleton refuses to load

Check that the skeleton file is an **export**, not a `.spine` project; use a **Spine 4.2.x** JSON/SKEL. Select the atlas and every referenced texture page and click **Load preview**. Start with the bundled Doctor head sample to separate runtime problems from asset problems. Missing or ambiguous atlas names should produce a loading error rather than a half-loaded skeleton.

## Effects render but PNG edges are dark

Investigate premultiplied alpha at the **PNG encoding boundary**. The WebGL extraction path must unpremultiply its pixel readback exactly once; WebGPU must not receive the same second conversion. Compare decoded PNG pixels with real partial alpha and composite over light/dark backgrounds. See [FX-PNG-PMA-01](https://github.com/maximsokal/pixi-spine-fx-lab/issues/2).

## Export changes when the camera zooms

Camera zoom must be display-only. Compare bake at identical settings at 50%, 100% and 200%, and verify crop handles are transformed through the same camera mapping. See [the product contract](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/product-contract.md).

## WebGPU is unavailable or a test cannot start

Verify your browser, actual GPU context and command line, not just a backend drop-down. Use a compatible Chromium with Playwright; optional `FX_SOFTWARE_GPU=1` helps headless environments but is **not** a physical-device performance test. Mark an unavailable backend NOT RUN, not PASS. Some tests require `FX_ENABLE_UNSAFE_WEBGPU=1` or actual flags supported by their own scripts.

## Browser tests cannot find Playwright/Chromium

Install the test dependencies in your own environment, or point `PLAYWRIGHT_MODULE` to an existing Playwright package and `BROWSER_EXECUTABLE` to a Chromium executable. Run one targeted smoke script to distinguish missing tooling from broken renderer code.

## Generated developer example does not build

Use Node.js **20.19+ or 22.12+**, extract the complete ZIP, preserve its relative skeleton/atlas/texture paths and verify package versions. Check that the exported effect logic matches the authoring source, not only the bundled README.

## Performance is poor or a layer is clipped

Try the Low quality preset, reduce effect-specific sampling/particles and inspect actual GPU/texture limits. Offscreen glow, distortion and emitter layers require conservative influence bounds. Never gain FPS by silently clipping a requested visual element; document the trade-off. Record device/browser/backend/resolution/active layers.

## An agent picked the wrong effect

Ask for an effect with a specific visual outcome, such as “Torch Flame” rather than generic “fire”. Use `python scripts/blueprint_router.py --route "torch flame"` to inspect selection. Two independent effects should have separate designs. Specification-only ICE/GAME entries are not executable editors.

## Where to file a reproducible bug

Use [GitHub Issues](https://github.com/maximsokal/pixi-spine-fx-lab/issues). Include: editor HTML/effect ID, commit hash, steps, expected vs actual result, renderer/browser/version, Spine export version, input assets (if redistributable), console logs and sanitized screenshots/PNG evidence. Do not attach customer-licensed artwork without permission.
