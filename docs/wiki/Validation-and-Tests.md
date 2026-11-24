# Validation and Tests

Verification is **evidence-driven** and **effect-specific**. A generated HTML file or passing structural test is not proof of correct rendering. Run focused checks first; expand to multi-backend/visual/integration tests when the changed behavior requires them.

## Environment

- Python **3.10+** for builders and Python tests.
- Node.js and Playwright with a compatible Chromium browser for renderer-dependent checks.
- The generated Vite examples need Node.js **20.19+ or 22.12+**.
- Optional environment variables: `PLAYWRIGHT_MODULE` (module location), `BROWSER_EXECUTABLE` (Chromium executable), `FX_SOFTWARE_GPU=1` (software-GPU flags). Backend availability is machine-dependent.

## Small, targeted commands

From repository root:

~~~sh
# Blueprint registry, schema and routing
python scripts/test_blueprints.py

# Protected baseline and manifest checks
python scripts/verify_project.py

# Burn reference: browser infrastructure, offline loading, PNG, developer ZIPs
node scripts/smoke_editor.cjs --html assets/Spine_Burn_Lab.html --backend both --output /path/to/qa-results

# One specialized editor: Torch in a real WebGL 2 context
node scripts/test_torch_editor.cjs --html assets/Torch_Flame_Lab.html --backend webgl2 --output /path/to/torch-qa

# WATER-05: focused offline editor smoke
node scripts/test_bubbles_smoke.cjs

# AIR-01: positional backend argument (not the Torch CLI shape)
node scripts/test_wind_editor.cjs webgl2
~~~

The last two examples use **different test command interfaces**; do not assume all `test_*` scripts accept identical flags. Read the script before launching it. Some browser tests generate captures or ZIPs; use a disposable output folder.

## What to verify for each changed effect

1. **Asset and UI contract:** Sample loads offline, complete atlas pages/skins/animations, meaningful controls, no console errors or network requests.
2. **Visual behavior:** Defined start/middle/end and loop seam; correct opacity/color, no discontinuities, unintended holes, cuts, or fake/no-op layers.
3. **Camera/interaction:** Try 50%, 100% and 200% zoom; handles and crop align while exported pixels remain independent of camera.
4. **PNG:** Decode actual ZIP images independently; exact pixel dimensions, straight alpha and partial-alpha RGB, correct count and timing, no guides/background unless a specific compositing mode calls for it.
5. **Determinism and lifecycle:** Same settings/seed and backend produce repeatable outputs; cancellation and repeated exports do not leak or corrupt preview.
6. **Real backends:** Assert the actual WebGL1, WebGL2 or WebGPU backend, not merely the requested selector value. Test each required backend individually.
7. **Developer packages:** Extract the appropriate ZIP, check complete assets, matching implementation/preset and build/run the generated integration project.

## PNG alpha regression

~~~sh
node scripts/test_png_pma.cjs --unit
node scripts/test_png_pma.cjs --html assets/Spine_Burn_Lab.html --backend webgl --output /path/to/pma-webgl2
node scripts/test_bake_lifecycle.cjs --html assets/Spine_Burn_Lab.html --backend webgl --output /path/to/lifecycle
~~~

For real WebGL1, add `--webgl1` to `test_png_pma.cjs`. For WebGPU use `--backend webgpu` and record availability/actual renderer. Do not turn backend failures into silent passes.

## Evidence and reporting

Record source commit SHA, changed effect, command line, operating system/browser, actual renderer, whether software GPU was used, test result and artifact paths. Mark tests **NOT RUN** if no browser/GPU is available; distinguish source-level inspection from executed passes.

[Complete validation contract](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/validation.md) · [Effect-specific test scripts](https://github.com/maximsokal/pixi-spine-fx-lab/tree/main/scripts)
