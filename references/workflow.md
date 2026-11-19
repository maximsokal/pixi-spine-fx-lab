# Review and task workflow

1. For a new effect, first resolve the [small FX Blueprint index](fx/index.md) and [draft schema](contracts/blueprint.md) without loading unrelated effect docs; distinguish a real Burn reference from spec-only ICE/GAME. Inspect supplied source, applicable repository instructions, tests, architecture, actual lockfiles and the baseline capabilities. Consult Graphify/Obsidian only if available and relevant; verify any remembered claims against current source. Never invent their availability.
2. Specify the requested look, input, start/end appearance, progression/loop policy, alpha, extra textures/layers, controls and device/backend constraints. Ask 1–3 focused questions only where a meaningful choice is unresolved.
3. Invoke grill-me for unresolved requirements and grill-with-docs for a completed implementation plan if installed. If absent, name the absence and perform the equivalent manual audit; do not claim an invocation succeeded.
4. Compare existing filter, custom shader and composed-effect approaches. Check exact official APIs, WebGL 1/2 and WebGPU, alpha, coordinate frames, sampling budget, lifecycle, resource files, export parity and tests. Do not modify application source during review.
5. Present a reviewed plan with acceptance criteria and remaining issues. Obtain explicit approval before implementing the proposed software slice. Do not treat “continue reviewing” as implementation approval.
6. If spec-kit exists, follow its repository constitution and actual commands/templates. Organize spec, clarification, research/plan, tasks, analysis and checklist in the host convention. If unavailable, use the same traceability in ordinary documents without pretending commands ran. Do not install tools implicitly.
7. Make small tasks: objective; prerequisite; exact files/anchors; changes; forbidden regressions; verification command; expected evidence; stop condition. Include real paths found in the working copy, not this skill's original machine paths.
8. Implement only the approved slice, run focused terminal tests, fix failures and stop at scope completion. Do not deploy or push production unless requested. Respect the host's branch and publication policy.
9. Deliver the artifact and evidence. A validated baseline does not prove a newly invented shader is correct; run effect-specific visual checks.

Packaging this existing editor and instructions is distinct from implementing a new effect. The user's request to create the skill authorizes its reusable package and installation in this skill workspace.
