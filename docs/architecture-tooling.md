# Architecture tooling

## Scope

The repository root is an Agent Skill, not a TypeScript/Vite application. Its authored runtime is classic browser JavaScript in `assets/template/src/` and the 13 effect-specific `assets/*/src/` directories. Python builders assemble that source into standalone HTML; effect code also registers APIs on `globalThis`. The `template.json` manifests, HTML assembly, emitted developer ZIP modules, and version contracts therefore matter as runtime references even when a module analyzer cannot see them.

There is no TypeScript project, root application package, type-check command, package test command, or production app build. The root npm manifest added here is private and exists only to pin and run analysis tools. Generated HTML, fixtures, and vendored minified PixiJS/Spine runtimes are not dependency-cruiser inputs. The statik index excludes the vendored runtime explicitly; its database is ignored, while reviewed rules remain tracked.

## Tools and commands

Verified with Node.js `v24.22.3` and npm `11.19.1`:

| Tool | Version | Scope |
|---|---:|---|
| dependency-cruiser | 18.9.0 | Static `assets/*/src/` and `scripts/` JS/CJS dependencies |
| Knip | 6.48.0 | Script and browser-source entry/project inventory |
| statik | 0.1.0, source revision `288c7620db48aab04192cdd87f84307d318edb38` | External Rust binary; index excludes `assets/template/vendor/**` |

Run `npm ci`, then:

```powershell
npm run arch:deps
npm run arch:graph
npm run arch:unused
npm run arch:unused:production
$env:STATIK_BIN = 'C:\path\to\statik.exe'
npm run arch:statik:index
npm run arch:statik:summary
npm run arch:statik:cycles
npm run arch:statik:dead-code
npm run arch:statik:impact -- assets/template/src/curve-core.js
npm run arch:statik:test
npm run arch:statik:health
npm run arch:check
```

`npm run arch:graph` writes [architecture-dependency-graph.dot](./architecture-dependency-graph.dot). Graphviz is optional; the DOT graph itself is the analyzer output.

Install statik separately from its official source, because it has no npm package dependency:

```powershell
git clone https://github.com/lauripiispanen/statik.git C:\tools\statik
Set-Location C:\tools\statik
git checkout 288c7620db48aab04192cdd87f84307d318edb38
cargo build --release
$env:STATIK_BIN = 'C:\tools\statik\target\release\statik.exe'
```

## Interpretation and baseline

- dependency-cruiser analyzed 236 modules and 686 dependency edges with no violations. Its checked-in rules reject cycles, dependencies from shared template core to effect implementations, and browser runtime imports from repository scripts. A deliberate cycle fixture also confirmed that the cycle rule fails.
- Knip 6.48.0 returned `{"issues":[]}`. This is not evidence that every file is reachable: all browser source files are explicit entries because HTML/Python assembly and `globalThis` registration are dynamic, and all CJS scripts are entry points or test/build helpers. Knip cannot infer runtime consumers from those generated strings.
- statik indexed 229 authored JS/CJS/config files (11,836 symbols and 33,334 references), excluding the two vendored runtimes; 22 non-JS files were skipped. It reported zero cycles, but `deps` and `impact` returned no edges even for known `require('../../template/src/curve-core.js')` references. The parser recognizes ESM import statements but does not resolve these CommonJS `require()` calls. `.statik/rules.toml` declares the dynamic browser/test entry patterns and informational boundary candidates, but this Windows run still reports 0 entry points and 229/229 dead files; likely extended-length Windows paths do not match the configured relative globs. Treat those dead-file and empty-cycle/impact results as false positives, not as evidence of unreachable effects or no runtime coupling. Linux behavior for these source-set patterns was not verified.
- The effect registry and PixiJS/Spine pins are verified by `scripts/test_blueprints.py` and `assets/template/template.json`. This checkout has no separate version-specific runtime adapter tree; compatibility contracts are documentation, not executable adapters.
- `statik` currently has no trustworthy dependency-cycle or blast-radius baseline for this CJS/globalThis architecture. dependency-cruiser is the authoritative file-edge graph for imports it can statically resolve; neither tool models every generated ESM string or registration.

## Validation status

The 11 blueprint tests and 9 effect-validation tests passed. Full Python discovery also attempted two archive-verification modules, but those require absent external files `discover/steam-baked.zip` and `discover/wind-burst.zip`; these are not tracked fixtures in this checkout. Six targeted Node checks passed (curves, wind, waterfall, torch, PNG parsing, and bubble alpha); additional package-export tests require extracted ZIP arguments that were not present. Browser/PNG smoke tests were not run because Playwright is not installed. The template built to a temporary HTML and `verify_project.py` passed (8 protected files, 30 controls, HTML checked). There is no TypeScript type check or conventional production app build to run here.

### Local discovery and browser archive QA (#74)

Run `python -m unittest discover -s scripts` for Python discovery. The Steam Jet and Wind Gust package validators are explicit CLI checks; importing them must not inspect archives or invoke npm. For real browser-generated archives, separately run `python scripts/test_steam_packages.py <steam-qa-directory>` and `python scripts/test_wind_packages.py <wind-qa-directory>`. Missing or invalid archives remain errors. Do not treat successful unit discovery as evidence of real PNG, ZIP or offline Vite build parity.

Targeted verification on Python 3.13.5: the three-file local snapshot (two original validators verified by Git blob SHA plus the new regression suite) produced 3 failures before the fix and 5/5 passing tests after it. Full repository discovery and real browser archives were not run in this environment because the full checkout and browser-generated fixtures were unavailable. The earlier baseline above is historical.

### Statik coverage gate (#75)

Run `npm run arch:statik:test` for dependency-free synthetic subprocess regression tests and `npm run arch:statik:health` for the real installed analyzer. The health command refreshes the index with the vendor exclusion, checks a nonempty index and entry-point set, then checks the direct Wind Gust → curve-core dependency in the pinned Statik JSON schema. Only if those checks pass does it run lint. Raw Statik commands remain available for diagnostic output, including lint, even if coverage is degraded. Exit 0 is a limited canary PASS, not proof of complete coverage; 1 is ERROR (invalid output or process failure); 2 is DEGRADED (missing coverage) or UNVERIFIED (executable unavailable). `arch:check` runs dependency-cruiser and Knip before the health gate and propagates its nonzero status. Statik remains advisory for architecture decisions: a degraded result is not an architecture violation and cannot justify code removal. Do not hide a failed or unavailable tool.

Local Node 22.16.0 verification: 11/11 synthetic regression tests passed; absent actual Statik reported UNVERIFIED and exit 2; full arch:check stopped at missing dependency-cruiser (exit 127). Full checkout, real pinned Statik on Linux/Windows, and runtime/browser tests were not available. This change guards against misleading success; it does not fix upstream CommonJS parsing or Windows path indexing.

### Statik response consistency regression

The pinned dead-code summary counts its returned dead-file list. The direct-only outbound deps response deduplicates file IDs and reports both import counters for the returned list. Contradictory counters or duplicate file IDs now fail as ERROR (exit 1), not PASS. These are structural checks, not a new claim about graph coverage. Four targeted synthetic cases failed before the correction; all 15 pass afterwards. The actual dependency-cruiser coverage tests (2/2), repository graph (327 modules / 1001 edges) and Knip passed on Windows Node 24.22.3.

### Real pinned Windows Statik reproduction (2026-11-25)

Built the unmodified upstream revision 288c7620db48aab04192cdd87f84307d318edb38 using Rust/Cargo 1.100.0 and cargo build --locked --release -j 2 in an isolated tools checkout. Actual Statik 0.1.0 on repository commit 504d2c155074a5e3ea8b677390366dc87baada43: 316 indexed graph files, 316 dead files, zero entry points, zero detected exports and unresolved ratio 0.0. Raw absolute paths retain the Windows verbatim prefix; the Wind Gust dependency query returns an empty imports array despite its literal require. This confirms the symptoms with the actual pinned executable, not their upstream root cause in isolation. The real health gate returns DEGRADED exit 2, without running lint; full arch:check passes dependency-cruiser and Knip before propagating exit 2. No deletion of runtime source, no false coverage PASS, no analyzer upgrade. Upstream path and CommonJS repair remain unverified. The compiler emitted one unused-dependency warning for upstream thiserror; build succeeded.

### Isolated Windows root/require reproduction and index consistency (2026-11-25)

Two identical temporary three-file projects with configured entry patterns for src/esm.js and src/cjs.cjs, both referencing src/dep.js, were analyzed by the unmodified pinned Statik executable. Explicit index . produced 3 files, 0 roots, 3 dead files and Windows verbatim paths; fresh auto-index through dead-code produced 3 files, 2 roots, 0 dead files and normal absolute paths. ESM import resolved to dep.js in both cases, while literal CommonJS require resolved to zero edges in both. Thus the path representation defect and missing CommonJS coverage can be reproduced independently, not repaired by merely changing indexing mode. Auto-index is not a production workaround because it does not preserve the explicit discovery exclusion and does not repair CommonJS. The health gate also rejects mismatched index/graph file counts in either direction as DEGRADED (exit 2); two new synthetic regressions fail before and pass after the correction, 17/17 total. Actual current repository: index=318, graph=318, roots=0; dependency-cruiser 329 modules/1010 dependencies, Knip pass, actual health remains DEGRADED. Counts matching is a necessary, not sufficient, condition. No upstream patch or pin change has been made.

## CI proposal

Start with an informational GitHub Actions job: use `actions/setup-node` with Node 24, `npm ci`, install Rust stable, check out statik at the recorded revision into a temporary tools directory, build it with `cargo build --release`, then run `npm run arch:check` and upload the DOT/JSON reports. Do not fail the job for Knip/statik findings until their dynamic-entry baseline has been reviewed. The current dependency-cruiser baseline is clean and its rules have a passing negative test; promote that step to blocking only after maintainers approve the rules. Add browser test dependencies separately rather than pretending the current checkout has a TypeScript build or a configured Playwright suite.
