# FX-CORE-06 — Stable artist parameters (draft v1)

A common contract for **specialized** effect editors, not a global control panel. Read it only after selecting the relevant Blueprint. This issue does not change existing Burn Lab controls.

## Parameter contract

Each item requires:
- `key`: stable effect-local ID, independent of array index, display order, file path, label or translation.
- `type`: `number`, `integer`, `boolean`, `color` (#RRGGBB), or `enum`.
- `default`: working reference default for implemented effects, clearly proposed default for spec-only ones.
- `unit`: physical/logical unit, e.g. `seconds`, `logical-pixels`, `normalized-0-1`, `rgb-hex`, `strength-multiplier`, `int32`, `particles-per-second`.
- `controlGroup`: visible only in this effect-specific editor, not an inherited Burn UI section.
- `exportPath`: exactly `settings.<key>` for this draft's preset mapping. No silent rename or array-position ID.

Number/integer parameters require finite `min` and `max`, positive `step` and an inclusive range-valid default. All integer values must be integers. Enums need nonempty unique `choices` containing the default. Boolean defaults are actual booleans. Color defaults are valid six-digit RGB. For alpha and independently authored RGBA stops use [Colors](colors.md), retaining RGB even when alpha is zero. Validate settings at import and runtime boundaries; unknown fields and versions are not silently repaired.

## Artist UX and no ghost controls

A parameter must demonstrably change the relevant effect output or be explicitly disabled by another authored control. Give controls comprehensible labels, tooltips and reset behavior in their **own** specialized editor, not in this common contract. Keep invisible glow, strokes, rays and postprocess layers independently controllable when implemented.

ICE must never inherit Burn-only `desaturation`, `charStrength`, `fireColor` or `sparks` by default. GAME hit flash must not inherit an unrelated burn mask. Keep current Burn editor untouched until a separate, effect-specific implementation is approved.

## Rendering and export mapping

Map each parameter to a verified concrete Pixi/Spine filter property, shader uniform, layer runtime or external resource in the effect's implementation plan. Check actual pinned PixiJS 8.22.0 and Spine Runtime 4.2.120 APIs before coding. Logical effect coordinates must be independent from camera CSS zoom and PNG resolution.

Use the same validated values in preview, fixed-step isolated PNG bake and both developer ZIP presets. A slider that only affects one backend is not complete. Test endpoints, intermediate values, defaults, reset, JSON round-trip, alpha, camera invariance, backend behavior and resource ownership.

## Versioning

Blueprint schema, effect semantics and preset format are **three independent versions**. Unknown versions reject until an explicit, independently tested migration exists. Versioned PixiJS/Spine compatibility adapters are optional documents, not runtime guarantees, and are not automatically enabled.

See [Blueprint contract](blueprint.md) for exact metadata and dependency requirements.
