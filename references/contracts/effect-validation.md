# FX-CORE-07 — Effect-Specific Visual and Numerical Validation (v1)

**Reusable verification contract, not a rendering implementation.** Load this only for a selected FX Blueprint. One effect = one dedicated editor. FIRE Burn, Torch Flame, Fire Explosion, Fireball Projectile and Embers & Sparks and Smoke Plume and Heat Haze and Water Splash and Rainfall and Water Ripples are distinct working references; ICE Frost and GAME Hit Flash are still specification-only, so their visual results are **NOT RUN** until independently built and tested.

## Completion criteria

A visible canvas, successful bundle or compiling shader does **not** prove an effect is complete. Every implemented Blueprint needs:

1. Visual goal and start/peak/end appearance (at authored 0/mid/end times). Record normal, paused, reverse, loop, reset and disabled behavior, including alpha and source skeleton preservation. Capture screenshots and actual decoded PNG bytes over light, dark and checkerboard backgrounds.
2. Every artist slider, toggle, curve, color picker, emitter, and layer has a verifiable effect on image pixels **or** numerical state. If intentionally inactive under a documented dependency, test both states. No hidden lines/rays/glow or orphaned particles after turning all optional layers off. Controls must affect preview and bake/developer handoff, not just the UI.
3. Per-emitter XY movement in world/local coordinates, layer movement and alpha/tint/size controls, independent per-instance seed and sibling isolation, camera drag at 50/100/200%. Diagnose missing bone/slot/attachment and confirm owned resources are disposed. Width taper at both ends is mandatory for ribbon/rope effects, not for unrelated shader-only effects.
4. Numerical oracles: monotonic distinct emission timestamps; seeded reproducibility across 30/60/120 FPS; spatial spacing within **0.25 logical px** of true cumulative Bézier arc length; curve segment and gradient interpolation with explicit domain/epsilon; alpha values 0, partial and 255; RGB/alpha-channel tolerances (normally ±2 for RGBA8); bounded 60-Hz effect time, backward seek, cancellation, reinitialization and cleanup.
5. Regression checks for matching-version Spine JSON/SKEL, multi-page atlas, missing/invalid input, camera-invariant crop, true straight-alpha and untrimmed PNG, both developer ZIPs, offline behavior and real WebGL1, WebGL2 and WebGPU execution. Existing [PNG PMA](../validation.md) and [timeline](timeline.md) obligations remain; if those suites are not executed in a given run, record **NOT RUN**, never silently claim a PASS.

## Evidence protocol: PASS / FAIL / NOT RUN

The report is versioned JSON v1 ([machine-readable schema](../validation/evidence-schema-v1.json)), validated against the actual catalog, PNG files and claims by `python scripts/effect_validation.py path/to/report.json`. The JSON Schema describes structure; the Python validator enforces actual SHA-256/CRC/decoded PNG validity and calculated statuses. Required fields:

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Exactly 1. Unknown versions rejected. |
| `effectId`, `effectVersion`, `sourceCommit` | Exact catalog match and full 40-hex Git SHA under test. |
| `environment` | Browser version, device/OS, requested backend, **actual** WebGL1/2/WebGPU renderer, GL version where applicable, GPU identification or explicit unavailable label, offline flag and zero HTTP requests. |
| `fixture` | Seed, complete settings JSON, asset, encoded output width/height, 60 authoring FPS and start/mid/end sample times in seconds. |
| `checks` | Stable IDs with kind (`visual`, `numeric`, `backend`, `asset`, `export` or `lifecycle`), expected, actual, explicit tolerance, status and PNG evidence paths + SHA-256. `NOT RUN` has a reason and no fabricated measurement. |
| `status` | Calculated from all checks: any FAIL → FAIL; otherwise any NOT RUN → NOT RUN; only all PASS → PASS. |
| `warnings` | Caveats, hardware limits and rejected/unsupported features. |

To require a complete release PASS, run `python scripts/effect_validation.py OUT_DIR/report.json --require-pass`: exit 0 only if all required checks PASS, exit 2 for a structurally valid incomplete/failed result. For specification-only ICE/GAME, report every check NOT RUN with a specific reason, no screenshots or fabricated measurements, and `requestedBackend`, `actualBackend`, `browser`, `device`, `gpu`, `glVersion`, `offline`, `networkRequests` all null. In an implemented Low-quality WebGL1 build, unavailable halo checks are NOT RUN rather than fabricated PASS. The browser harness exits 2 for that incomplete audit; `--allow-not-run` permits an explicit nonblocking evidence collection run while the saved report remains NOT RUN.

The validator requires `phase.<id>` for each Blueprint phase, `parameter.<key>` for every artist parameter and `backend.actual`. Duplicates, unknown versions, inconsistent summaries, unsafe file paths, absent screenshots, incorrect hashes and WebGPU→WebGL fallback are rejected. Visual PASS needs nonzero measured change in independently decoded pixel data, not merely file size, canvas visibility or alpha extrema. The structural validator verifies evidence metadata; it cannot prove how an agent or browser created a screenshot. Real Playwright/PNG tests remain mandatory.

Different physical GPU vendors are **not** required to create byte-identical pixels; use recorded per-channel tolerances and a domain-specific numerical oracle. Same backend/device/seed repeated bake must be identical unless a documented nondeterministic path exists. Report real WebGL context version via `gl.getParameter(gl.VERSION)`. Browser SwiftShader execution **does not certify physical GPU performance**.

## Burn Lab reference test

Run offline Playwright against the unchanged baseline:

    node scripts/test_effect_visual.cjs --html assets/Spine_Burn_Lab.html --backend webgl --output OUT_DIR
    node scripts/test_effect_visual.cjs --html assets/Spine_Burn_Lab.html --backend webgl --webgl1 --output OUT_DIR
    node scripts/test_effect_visual.cjs --html assets/Spine_Burn_Lab.html --backend webgpu --output OUT_DIR

The harness captures three real PNG phase screenshots, 61 isolated baked RGBA PNG frames (samples 0, 30 and 60), individual before/after visual evidence for all **nine currently declared Burn Blueprint parameters**, independent emitter XY and all-optional-layers-off numerical tests. It saves a `report.json` and screenshot hashes to the requested output folder. It decodes Chromium RGB screenshot PNG and straight RGBA8 bake PNG with independent `fx_visual_png.cjs`, checking actual channels and not relying on alpha extrema alone. **Scope limit:** this harness audits the nine Burn Blueprint-declared parameters, not every built-in and dynamically generated UI control in the mature Burn editor. Its PASS refers to those declared checks **only**, not certification that all remaining controls were tested. A full editor acceptance must inventory actual exposed controls, expand the Blueprint and prove each slider/toggle/curve/emitter, or explicitly report those outstanding checks NOT RUN; never infer whole-editor acceptance from the 18-check reference report.

Then validate the report with:

    python scripts/effect_validation.py OUT_DIR/report.json

Keep screenshot, ZIP and report outputs out of the source tree; do not commit temporary runs. Empty / missing / unavailable contexts yield **NOT RUN** or FAIL, not false backend PASS. The same applies to ICE and GAME until actual implementations exist. To independently confirm backend-specific resource handling, run `test_png_pma.cjs` and `test_bake_lifecycle.cjs` and the focused Curve, Spacing, Emitters, Colors, Timeline browser suites (report exactly those executed).

## RED→GREEN discipline

A new validation feature may demonstrate RED because the required validator/proof is missing and GREEN after implementing the test. A newly found application bug requires a real before/after failing fixture and targeted fix. Already-working backend features should be regression guards; **never fabricate a RED result** to meet process requirements.

This Issue #9 only adds specification and QA tooling. It does not modify the pinned PixiJS 8.22.0 / Spine Runtime 4.2.120, shaders, baseline HTML, protected assets or developer ZIP runtime.
