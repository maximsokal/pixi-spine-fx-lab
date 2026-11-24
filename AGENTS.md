# Repository Agent Guidance

This repository is an offline PixiJS/Spine effect-editor skill, not a TypeScript application. Read the relevant effect contract and builder before changing runtime code. Preserve the supported effects, runtime pins, offline behavior, and PNG/developer exports; do not infer that global runtime registrations are unused from static reports.

## Architecture and validation

- Identify changed modules and their actual HTML/Python builder entry points.
- For shared code, run `npm run arch:statik:impact -- <repo-relative-file>` and check the direct/transitive import graph with `npm run arch:deps`.
- Run `npm run arch:unused` after changes to imports, exports, packages, or public entry points.
- Run `npm run arch:check` locally with dependencies installed; configure `STATIK_BIN` if it is not on `PATH`. Its Statik health gate reports exit 2 for DEGRADED/UNVERIFIED coverage; do not treat that as an architecture violation or PASS. Dependency-cruiser remains authoritative for static CommonJS edges. Use `npm run arch:statik:test` for synthetic gate regressions and raw Statik commands for diagnosis.
- Run the relevant Python and Node tests, then `python scripts/verify_project.py assets/template`. Browser tests additionally require Playwright and Chromium.
- Confirm each effect remains in the registry and its offline editor, PNG sequence, and developer ZIP paths remain reachable. Preserve the PixiJS/Spine version contract unless an upgrade is explicitly approved.
- Report analyzer warnings and known dynamic-reference limitations. Do not blanket-ignore source directories or remove code solely from an analyzer report.
