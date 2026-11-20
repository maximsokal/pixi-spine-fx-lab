# FX Blueprint index — progressive disclosure

The small [index.json](index.json) is the machine-readable routing index. Each effect has its own independent Blueprint. Do **not** duplicate all specs into SKILL.md.

| Category | Selected Blueprint | Status | Contracts |
| --- | --- | --- | --- |
| FIRE | [Burn transition](fire/burn-transition.md) | **Reference implementation**, current Burn Lab | parameters, curves, spacing, emitters, colors, timeline |
| ICE | [Frost dissolve](ice/frost-dissolve.md) | **Specification only**, not a shipped editor | parameters, curves, colors, timeline |
| GAME | [Hit flash](game/hit-flash.md) | **Specification only**, not a shipped editor | parameters, curves, timeline |

## Deterministic route for an agent

1. Match a specific effect intent, not a broad term like "game". "Flame burn sparks" selects FIRE; "icy crystal frost" selects ICE; "damage hit flash" selects GAME.
2. If both FIRE and ICE or multiple candidate effects are mentioned, do **not** silently select one. Ask for target or plan independent effects.
3. Read the chosen Blueprint and [schema](../contracts/blueprint.md). Then read **only** `requiredContracts` in the documented dependency order, skipping unrelated modules and Blueprints.
4. Inspect actual source and pins, [adaptation map](../adaptation-map.md) and official docs before any proposed implementation. For spec-only effects obtain a separate reviewed/approved plan; they do not already export PNG or developer ZIPs.

Run `python scripts/blueprint_router.py --route "hit flash damage"` to inspect a route, and `python scripts/test_blueprints.py` for regression tests. This router only validates/suggests relevant documents; it does not actually read documents on an AI agent's behalf.

## Optional geometry contract for specialized future effects

Vine Growth (#33), Chain Lightning (#38), Sword Slash (#42), ribbons and trails may depend on [FX-CORE-08 Path Geometry](../contracts/path-geometry.md) after Curves and Spacing. It is an **implemented reusable geometry library**, not a ready-made effect. Do not load it for unrelated FIRE/ICE/GAME variants; future Blueprints explicitly include `pathGeometry` in `requiredContracts` when applicable.

## Future issue catalog

Each new GitHub effect issue must be self-contained: goal, inputs, start/end look, timing/loop, alpha, artist controls, required renderer and GPU budgets, dependencies and concrete acceptance tests. Index issues by category/status/dependencies, **not** by pasting 41 full specifications into SKILL.md.

## Optional versioned adapters — specifications in main

The [PixiJS 5–8 / Spine Runtime 3.7–4.3 compatibility specifications](../compatibility/README.md) are now part of main. These Markdown files are **optional, documentation-only** and are not functioning adapters. Default remains PixiJS 8.22.0 and Spine Runtime 4.2.120 until separate review and tests approve a compatibility change.
