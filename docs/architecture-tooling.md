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

## CI proposal

Start with an informational GitHub Actions job: use `actions/setup-node` with Node 24, `npm ci`, install Rust stable, check out statik at the recorded revision into a temporary tools directory, build it with `cargo build --release`, then run `npm run arch:check` and upload the DOT/JSON reports. Do not fail the job for Knip/statik findings until their dynamic-entry baseline has been reviewed. The current dependency-cruiser baseline is clean and its rules have a passing negative test; promote that step to blocking only after maintainers approve the rules. Add browser test dependencies separately rather than pretending the current checkout has a TypeScript build or a configured Playwright suite.
