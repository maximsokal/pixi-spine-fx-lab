# FX-CORE-06 — Versioned FX Blueprint and agent adaptation contract (draft v1)

**Specification only.** Not a shipped universal adapter, effect graph or new shader. An FX request maps to **one specialized configurable editor** after its own reviewed and approved implementation plan. Current runnable references are the protected Burn Lab, separate Torch Flame editor (FIRE-01) and independent Fire Explosion (FIRE-02) and Fireball Projectile (FIRE-03) and Embers & Sparks (FIRE-04) editors.

## Progressive disclosure: selection before loading

1. Inspect the user's actual work, relevant AGENTS.md, repo architecture, lockfiles, tests and runtime pins. Never overwrite a newer source editor with an old template.
2. Read the short SKILL.md router, then [index.md](../fx/index.md) or [index.json](../fx/index.json). Resolve a **specific** FIRE/ICE/GAME effect using intent phrases, not category labels. Ambiguous/multi-effect requests remain unresolved until the user chooses one or approves independent compositions.
3. Read **only the chosen** Markdown Blueprint and this versioned contract. Load its `requiredContracts` in declared order: parameters → curves → spacing → optional pathGeometry → emitters → colors → timeline, **skipping unused** modules. Never bulk-load all 41 issue specifications in SKILL.md.
4. Read [adaptation map](../adaptation-map.md) when adapting real code. Other PixiJS/Spine [versioned-adapter specifications](../compatibility/README.md) are available in main as optional documentation; they do not constitute working runtime support.
5. Perform grill-me for unresolved look, endpoints and constraints; perform grill-with-docs (or explicitly disclosed manual equivalent) against actual code and official APIs. Review first; implement only after approval of the reviewed slice.

The deterministic Python reference router runs `python scripts/blueprint_router.py --route "frost dissolve"` and validator runs `python scripts/blueprint_router.py`. These tools do **not** emulate agent tool-use or create an effect, and their routing tests are not proof that a remote LLM read the documents.

## Machine-readable document layout

Each `references/fx/{category}/{effect}.md` contains exactly one fenced JSON block whose object has **all** these fields:

| Field | Meaning |
| --- | --- |
| `blueprintSchemaVersion` | Draft schema v1; unknown versions rejected. |
| `effectId` | Stable `fx.<category>.<slug>`. Independent of file position, issue, title and location. |
| `effectVersion` / `presetSchemaVersion` | Independently versioned effect semantics and preset handoff format. |
| `category` / `styles` / `visualGoal` | Routing metadata and authored visual intent. |
| `phases` | Stable phase IDs and start/intermediate/end appearance policies. |
| `layers` / `emitterAnchors` | Stable layer/anchor IDs, renderer ownership, coordinate frames, missing-anchor policy. |
| `parameters` / `controlGroups` | [Artist parameter schema](parameters.md); no ghost controls. |
| `curves` / `spacing` / `palettes` | Explicit curve domains, event/arc-length policy and optional RGBA palettes. Empty or disabled where irrelevant. |
| `rng` | Seeded-per-instance or none; no shared global Math.random. |
| `rendering` | Deliberate filter/shader/particles/composition, exact pins, WebGL1/2/WebGPU, fallback and verification status. |
| `qualityBudgets` | Bounded Low/Balanced/High effect budgets. |
| `tests` | Required checks plus evidence files only for **actually implemented** references. |
| `outOfScope` | Explicit exclusions; no implicit feature creep. |
| `requiredContracts` | Ordered minimal subset; `parameters` always first, and `curves` needed for spacing/pathGeometry/colors/timeline. Optional `pathGeometry` also requires `spacing` and is loaded only for ribbon/branching effects. |
| `exportMapping` | Stable parameter map and preview, isolated PNG, both developer ZIP strategy. Spec-only effects mark these not implemented. |
| `migration` | `from` list (empty v1), `unknownVersion:"reject"`. Explicit approved migration required. |
| `implementation` | `reference-implementation` with real source/test evidence or `specification-only` with **no** source/export claim. |

No file rename changes `effectId`. Never infer stable IDs from order in an array. Unknown schema version, missing/duplicate keys, nonfinite values, mismatched export mappings, unsafe filesystem path or ungrounded implementation claims must be rejected.

## Agent adaptation and verification bridge

| Stage | Evidence expected before marking complete |
| --- | --- |
| Inspect | Actual pinned PixiJS 8.22.0, Spine Runtime 4.2.120, source, tests and official API/version constraints. |
| Design | Choose built-in Pixi filter, version-verified custom GLSL/WGSL or bounded layers; justify WebGL1 fallback and alpha/bounds. |
| Parameters | Stable key, type, default, range, units, reset, user-visible effect, export mapping for every requested artist control. |
| Source bindings | Trace exact source anchors in `ui.html`, runtime, `export-ui.js`, isolated `bakeSequence`. |
| Invariants | Preserve Spine JSON/SKEL/atlas/textures; identity-transform host and owned resources; camera/inverse dragging; offline dependencies; transparent PNG and cancellation. |
| Validation | RED→GREEN numeric oracle, effect-specific visual endpoints, real WebGL1/2/WebGPU, fixed-step PNG, developer ZIP Vite builds. |
| Delivery | Report what is actually tested, what is still speculative, physical-device limits and exact approved scope. |

For ICE and GAME demonstration Blueprints, everything described under rendering is **a proposal**, not an actual shader. The export mapping values must be `"not-implemented"` until a separately approved effect is built.

## Versioning and migration rules

- `blueprintSchemaVersion` determines the Blueprint document structure; v2 requires explicit migration and tests. Reject incompatible v1 fields rather than guessing.
- `effectVersion` tracks effect look/behavior, separate from Blueprint schema or underlying Pixi runtime.
- `presetSchemaVersion` tracks artist settings and developer ZIP format, separate from Blueprint version. This issue does **not** add Blueprint import to the Burn Lab preset.
- The independent PixiJS 5–8 / Spine 3.7–4.3 [compatibility specifications](../compatibility/README.md) are in main as optional documentation. They must not be loaded as default dependencies or misrepresented as verified support. Separate review, implementation and per-version compatibility tests are required.
- Existing Burn Lab pins and protected assets stay unchanged in this issue.

## Tests and scope

Before declaring an implemented effect complete, load [FX-CORE-07 effect-specific validation](effect-validation.md) for observable artist controls, start/peak/end images, independent pixel decoding, backend provenance and honest PASS/FAIL/NOT RUN reports. This validation contract is optional when only designing a Blueprint, not a default module for all requests.

Run `python scripts/test_blueprints.py` for specific FIRE/ICE/GAME routing and selective dependencies, incorrect IDs/versions/ranges, duplicate/unsafe paths, migration rejection, no fake ICE/GAME support and a small SKILL router. Then `python scripts/verify_project.py assets/template --html assets/Spine_Burn_Lab.html` and `git diff --check`.

This is **documentation + standard-library validation tooling**, no HTML, runtime, shader or new ZIP code. Existing #1–#7 browser passes are preserved but not claimed to have been freshly re-run just because specs changed.
