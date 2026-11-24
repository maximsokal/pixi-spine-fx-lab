# Agent Workflow and Contracts

The skill should adapt **an existing, verified offline editor**, not invent a new viewer, baker or exporter for every effect. `SKILL.md` is a compact router; details are loaded from specific versioned contracts on demand.

## Procedure for a new FX request

1. **Inspect the current working source** and the host repo's AGENTS/instructions, architecture, tests and pinned dependencies. Preserve newer project changes; never replace an advanced editor with the older Burn seed.
2. **Route the intent** using [FX index.json](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/fx/index.json) and the selected Blueprint. Identify whether it is an existing implementation or a spec-only proposal.
3. **Review ambiguities** — desired visual start/end look, timing and loops, emission/anchors, alpha, textures, performance, output and target backend. Use `grill-me` only if actually available; otherwise perform and document the equivalent manual questions.
4. **Review against documentation** — current code, official APIs, dependency versions, platform restrictions, export parity, edge cases and tests. Use `grill-with-docs` if installed; if not, report the unavailable tool and perform a manual review. Do not claim invocation of a missing skill.
5. **Present an implementation plan** with exact file paths, acceptance criteria, minimal slice and evidence requirements; await explicit approval **before changing source code**.
6. **Implement only the approved slice**. Run targeted terminal tests (RED→GREEN for regressions), compare preview/PNG/developer ZIP behavior and audit resource lifetime.
7. **Report evidence**, limitations and changes. Never label a mobile GPU or another runtime as tested without running it.

## Progressive contract loading

| Need | Contract |
| --- | --- |
| Parameter types, IDs, bounds and export mapping | [parameters.md](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/contracts/parameters.md) |
| Animation/editable value curves | [curves.md](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/contracts/curves.md) — FX-CORE-01 |
| Temporal/spatial emission spacing | [spacing.md](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/contracts/spacing.md) — FX-CORE-02 |
| Ribbons/tapering/branch geometry | [path-geometry.md](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/contracts/path-geometry.md) — FX-CORE-08 |
| Independent emitters, anchors, visibility and ownership | [emitters.md](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/contracts/emitters.md) — FX-CORE-03 |
| Gradient colors and lifetime envelopes | [colors.md](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/contracts/colors.md) — FX-CORE-04 |
| Absolute time, seek, repeatable baking | [timeline.md](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/contracts/timeline.md) — FX-CORE-05 |
| Complete versioned effect specification | [blueprint.md](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/contracts/blueprint.md) — FX-CORE-06 |

Read only the contracts required by the chosen Blueprint, in dependency order. An effect's reference file is **not** a replacement for its current executable source.

## Protected behavior

Keep offline operation; complete Spine asset loading; camera/output independence; 60-FPS bake timing; isolated transparent PNG; deterministic seed/seek; cancellable jobs; separate working WebGL/WebGPU-oriented packages; license notices; and explicit performance/renderer constraints.

Do not attach mutable application state to `window`. Avoid editing vendor files or introducing runtime CDN dependencies. Maintain one effect behavior shared by preview, PNG and developer integration.

[Full workflow contract](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/workflow.md) · [Product contract](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/product-contract.md) · [[Architecture-and-Extension-Points]]
