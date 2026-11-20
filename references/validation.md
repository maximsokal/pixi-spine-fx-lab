# Acceptance matrix

| Area | Required evidence |
| --- | --- |
| Runtime | Exact pins and protected hashes unchanged; approved upgrades tested separately. |
| Blueprints | [FX-CORE-06 versioned schema](contracts/blueprint.md): unique stable effect IDs, FIRE/ICE/GAME routing, exact progressive contract loads, validated default/range/unit/preset mappings, explicit unknown-version rejection, spec-only ICE/GAME nonimplementation, no unrelated Burn controls and small SKILL router. Tests validate document/tool semantics, **not** actual LLM tool calls or unbuilt shaders. |
| FX-CORE-07 evidence | [Effect-specific visual/numerical validation contract](contracts/effect-validation.md): start/peak/end screenshots and real encoded PNGs, one measured change per artist parameter, per-emitter XY and no ghost layers, numeric spacing/curve/gradient oracles, SHA256-backed browser/device/backend reports; truthful per-effect PASS/FAIL/NOT RUN. Source-only ICE/GAME specs must not claim verified images. |
| Offline | Open final HTML with network disabled; no HTTP(S) requests while loading/editing/baking sample/local files. |
| Loading | JSON and SKEL, multipage atlas, staged texture addition, missing-page errors, failed load retains preview, repeated replacements. |
| UI | English labels/errors; every meaningful parameter changes output and survives preset export/reset; all controls accessible in sidebar. |
| Layout | Desktop viewport uses available height; sidebar scrolling/wheel do not move or zoom it; narrow-screen controls remain accessible. |
| Camera | Buttons, percentage, Fit/100%, wheel anchor; matching canvas/frame/handles; inverse crop and center drags at 50%,100%,200%. |
| Bake invariance | Same-backend PNG bytes and sequence metadata identical before/after zoom or hiding guides, with identical settings/seed. |
| Timing | Seconds/frames agree at 60 FPS; inverse easing correct; live duration independent of rendering FPS; deterministic fixed-step bake samples. |
| Timeline | [FX-CORE-05 absolute-time replay](contracts/timeline.md): independent Spine/effect clocks, owned seed, nonempty particles on 30→10→30 seek, 30/60/120 FPS, reverse playback, loop/reset, max 64 checkpoints, 6/40/3600 frame boundaries, identical consecutive PNG bytes/metadata and unchanged live state after cancellation/success/failure. |
| Curves | Versioned [FX-CORE-01 schema](contracts/curves.md), deterministic numerical oracle, key/handle manipulation, invalid JSON rejection, 30/60/120 FPS and preview/bake/developer ZIP parity for custom easing. |
| Spacing | [FX-CORE-02 temporal/spatial spacing](contracts/spacing.md): emission timestamps independent of 30/60/120 FPS; seed/interval/burst reproducibility; ≤0.25 px arc-length tolerance; stationary/teleport/reverse handling; preview/PNG/developer ZIP parity, no hidden guide lines. |
| Path geometry | [FX-CORE-08 path/taper/branching contract](contracts/path-geometry.md): shared ≤0.25 px arc-length oracle, start/middle/end widths, separately testable end tapers, bounded miters, smooth joins, closed seams, zero-length and self-intersecting paths, stable branch IDs and cycles rejection, independent random seeds, leaf/branch arc-distance gaps, Low/Balanced/High caps, real isolated Pixi MeshGeometry WebGL1/2/WebGPU and transparent camera-independent PNG. Does not prove Vine Growth/Chain Lightning/Sword Slash are complete. |
| Emitters | [FX-CORE-03 independent emitter/layer contract](contracts/emitters.md): 2–16 independently positioned and seeded emitters; every rendered layer can be hidden/moved; bone/slot/attachment anchors; camera drag 50/100/200%; parent slot ownership and selective teardown; crop-local PNG differences and dual developer ZIP runtime imports. |
| Colors | [FX-CORE-04 gradient and lifetime contract](contracts/colors.md): sRGB/linear RGB stops, alpha 0/255, one-stop/duplicate rejection, four independent lifetime curves, real flame/glow PNG against light/dark/checkerboard, PMA correctness and preview/bake/WebGL/WebGPU package parity. |
| PNG | Every IHDR has exact W/H; RGBA transparency, no guides/background, animation changes over time, no per-frame trimming/recentering. WebGL PNG bytes must be **straight-alpha RGBA8**, not premultiplied RGB written as straight RGB; decode PNG independently and test partial-alpha colors. |
| Effect | Defined endpoints, intermediate look, disabled/reverse/loop behavior; reference images; no unintended alpha holes/opaque edges. |
| GPU | Actual WebGL 1 compatibility path, WebGL 2 and actual WebGPU where available; no JS/shader validation errors. |
| Exports | Both ZIPs contain preset/assets/shared module/shaders/example/English README; extracted projects build and run; WebGPU fallback works. |
| Resources | Cancel before completion downloads no partial archive; live pose/settings retained; repeated exports/loads/backend switches clean up. |
| Performance | Measured target devices/quality/viewport; no year-based FPS assertion; controlled intermediate memory and pass/sample budget. |

Run smoke_editor.cjs for a portable infrastructure check. It does not replace all rows above or validate the appearance of an arbitrary new effect. Use the same browser/backend for byte-identity tests; do not require identical rasterization across unrelated GPUs.

When automation is unavailable, state the missing check rather than marking it passed. Do not repeatedly rerun broad suites without a change, failure or unresolved risk that justifies it.

## FX-PNG-PMA-01 — WebGL PNG byte correctness

The pinned PixiJS 8.22.0 WebGL `extract.canvas()` route writes premultiplied readback RGB directly to Canvas, which accepts straight RGBA. The reference bake therefore uses `extract.pixels(target)`, applies `unpremultiplyRgba8InPlace()` to raw bytes **exactly once**, and only then uses `ImageData` and `toBlob('image/png')`. WebGPU already performs its own unpremultiplication: never apply the WebGL conversion to its output.

With Node.js and Playwright/Chromium available, from the repository root (set `PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE` if Playwright or Chrome is installed outside the default lookup paths):

```sh
node scripts/test_png_pma.cjs --unit
node scripts/test_png_pma.cjs --html assets/Spine_Burn_Lab.html --backend webgl --output fx-pma-webgl2
node scripts/test_png_pma.cjs --html assets/Spine_Burn_Lab.html --backend webgl --webgl1 --output fx-pma-webgl1
node scripts/test_png_pma.cjs --html assets/Spine_Burn_Lab.html --backend webgpu --output fx-pma-webgpu
node scripts/test_bake_lifecycle.cjs --html assets/Spine_Burn_Lab.html --backend webgl --output fx-lifecycle-webgl
node scripts/test_bake_lifecycle.cjs --html assets/Spine_Burn_Lab.html --backend webgpu --output fx-lifecycle-webgpu
```

The synthetic test runs through the actual PNG bake and independently decodes **encoded PNG RGBA bytes**, checking PMA `(64,32,0,64)` → straight `(255,128,0,64)`. The WebGL1 path switches the editor to its real low-quality WebGL1 renderer and confirms the context version; no fallback counts as a backend pass. The lifecycle test verifies a 40-frame sequence, cancellation, failure handling, resource/UI recovery and ZIP metadata. `smoke_editor.cjs` additionally covers 6-frame bake, camera invariance, offline loading, transparency and developer ZIPs.

To confirm the effect on real flame/glow content rather than only a fixture, run `smoke_editor.cjs` on the original release and on the rebuilt editor under the same browser/backend, then compare their WebGL PNG ZIPs with:

```sh
node scripts/compare_png_pma.cjs ORIGINAL_WEBGL_ZIP FIXED_WEBGL_ZIP
```

The comparison checks exact alpha equality and opaque RGB equality, counts brightened partially transparent pixels, and rejects systematic additional darkening. Compare light/dark/checkerboard compositing separately when producing visual acceptance samples. Record actual renderer versions and mark any genuinely unavailable backend **NOT RUN**.

Source of truth is `assets/template/src/ui.html`, not the bundled HTML. Rebuild with `scripts/build_editor.py` to a temporary path **outside** the skill directory, copy the verified output to `assets/Spine_Burn_Lab.html`, update `baselineHtmlSha256` in `assets/template/template.json`, and run `scripts/verify_project.py`. Keep all vendor and sample hashes unchanged.
