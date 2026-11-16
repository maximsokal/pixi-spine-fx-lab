# Acceptance matrix

| Area | Required evidence |
| --- | --- |
| Runtime | Exact pins and protected hashes unchanged; approved upgrades tested separately. |
| Offline | Open final HTML with network disabled; no HTTP(S) requests while loading/editing/baking sample/local files. |
| Loading | JSON and SKEL, multipage atlas, staged texture addition, missing-page errors, failed load retains preview, repeated replacements. |
| UI | English labels/errors; every meaningful parameter changes output and survives preset export/reset; all controls accessible in sidebar. |
| Layout | Desktop viewport uses available height; sidebar scrolling/wheel do not move or zoom it; narrow-screen controls remain accessible. |
| Camera | Buttons, percentage, Fit/100%, wheel anchor; matching canvas/frame/handles; inverse crop and center drags at 50%,100%,200%. |
| Bake invariance | Same-backend PNG bytes and sequence metadata identical before/after zoom or hiding guides, with identical settings/seed. |
| Timing | Seconds/frames agree at 60 FPS; inverse easing correct; live duration independent of rendering FPS; deterministic fixed-step bake samples. |
| PNG | Every IHDR has exact W/H; RGBA transparency, no guides/background, animation changes over time, no per-frame trimming/recentering. |
| Effect | Defined endpoints, intermediate look, disabled/reverse/loop behavior; reference images; no unintended alpha holes/opaque edges. |
| GPU | Actual WebGL 1 compatibility path, WebGL 2 and actual WebGPU where available; no JS/shader validation errors. |
| Exports | Both ZIPs contain preset/assets/shared module/shaders/example/English README; extracted projects build and run; WebGPU fallback works. |
| Resources | Cancel before completion downloads no partial archive; live pose/settings retained; repeated exports/loads/backend switches clean up. |
| Performance | Measured target devices/quality/viewport; no year-based FPS assertion; controlled intermediate memory and pass/sample budget. |

Run smoke_editor.cjs for a portable infrastructure check. It does not replace all rows above or validate the appearance of an arbitrary new effect. Use the same browser/backend for byte-identity tests; do not require identical rasterization across unrelated GPUs.

When automation is unavailable, state the missing check rather than marking it passed. Do not repeatedly rerun broad suites without a change, failure or unresolved risk that justifies it.
