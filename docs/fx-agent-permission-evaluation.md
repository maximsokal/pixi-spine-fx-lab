# FX-AGENT-02 (#70) — permission research: NO-GO for an agent mutation interface

Reviewed 2026-11-27, baseline [7d615df](https://github.com/maximsokal/pixi-spine-fx-lab/commit/7d615dfc7115d6e5aa2f23ff7849c10169f566ef), upstream [655c279 / 0.1.0-beta.18](https://github.com/vercel-labs/ui/tree/655c279a07aea370fc2890d3ba564070f204ce4a). Conditional research, not a security certificate or implementation approval. #68 concluded NO-GO; keep agent discovery, mutation and WebMCP registration absent. No SDK, dependency or editor runtime change.

## Alternatives and source review

Select native editor without agent execution now. Future narrowly typed domain commands are preferable to DOM-driven actions; any SDK or WebMCP adapter is presentation/transport only. Upstream pinned [agent.ts](https://github.com/vercel-labs/ui/blob/655c279a07aea370fc2890d3ba564070f204ce4a/packages/core/src/page/agent/agent.ts) checks options.allow and callerAllow, refuses marked confirm without an allow callback, checks disabled state before calling component APIs, and requires allow for registerTools, which checks document.modelContext. A callback returning true does not establish genuine human consent. [agent-ready guide](https://github.com/vercel-labs/ui/blob/655c279a07aea370fc2890d3ba564070f204ce4a/packages/core/skills/ui-sdk/references/agent-ready.md) shows data-agent-hidden/secret and label-based addressing; these are presentation/redaction features, not a security boundary or persistent ID. [guard.ts](https://github.com/vercel-labs/ui/blob/655c279a07aea370fc2890d3ba564070f204ce4a/packages/core/src/page/agent/guard.ts) uses a WeakMap for guarded actions, not a host authorization store.

Local sources: [#68 evaluation](ui-sdk-agent-bridge-evaluation.md), AGENTS.md, assets/template/src/{emitter-core,emitter-ui,emitter-runtime}.js and ui.html, references/contracts/parameters.md, references/product-contract.md, scripts/{feedback.cjs,agent_scope.py,test_emitter_editor.cjs}, references/feedback/README.md. Feedback digest binds exact content; genuine consent/dedup/permission/receipt remain trusted host responsibilities. Never expose approve to a model. agent_scope.py audits Git commits, not client authorization. No actual host identity or native callback dispatcher established. Grill executables unavailable; manual requirements/source review disclosed.

## Future proposed permissions (not enabled)

| Operation | Decision | Boundary |
|---|---|---|
| Inspect allowlisted settings and diagnostics | Deny today; read only after user enables local session | Exact effect instance, revision, stable emitter/layer IDs; exclude raw assets, paths, secrets, hidden/private content |
| Set one bounded parameter, explicitly set visibility, set emitter XY | Deny today; reversible edit only in explicitly enabled scoped session | Validate domain type/range and logical coordinates; atomic commit, one undo receipt |
| Curves, bulk edits, add/remove/reorder, undo/redo | Deny initial prototype | Separately reviewed commands and authorization; revision checks |
| Import/replace assets, presets, files; destructive action | Deny initial prototype | Future exact target/content approval, staged load, decode/budget validation |
| Bake PNG, download ZIP, expensive operations | Deny initial prototype | Future exact settings, dimensions, count, backend, resource budget, output destination approval and cancel/cleanup |
| Upload, publish, GitHub issue/comment, deploy | Deny from editor | #67 trusted-host-only exact disclosure and genuine fresh user approval; no automatic publication |
| Unknown tool/alias, raw DOM/canvas/script mutation, cross-project access, saved graph authority | Deny | No fallback or privilege escalation |

A future transport-neutral envelope carries schemaVersion, operationId, trusted host actor/session (not self-attested), effect/instance, base revision, target stable IDs, desired value and operation class. Bound read snapshots (proposed 64 KiB, existing domain caps 16 emitters/64 layers); page by revision-bound stable IDs, not labels/indices. Reject stale targets/cursors, invalid or nonfinite values, unknown fields, busy/revoked/cancelled state, missing capability, timeout or unexpected response. Identity, session duration, undo UX and exact budgets require approval.

Recheck permission, revision and target after awaiting confirmation; stage normalized candidate and renderer, then publish accepted settings/selection/history once. Reject preserves prior accepted state or marks irrecoverable renderer broken and hides owned output. Manual and agent use same domain command. Receipt records operationId, source, accepted revision, outcome and changed keys, never GPU proof. Same ID/same payload returns known receipt without reexecution; same ID/changed payload rejects; uncertain result reconciles actual state before retry. In-memory receipts do not survive restart. A saved graph is a proposal; reauthorize each edge. Consent belongs to trusted host, not automatic SDK true; cancellation before commit invalidates permit. WebMCP absent or denied preserves native editor; optional future registration invokes same dispatcher and unregisters on revoke/dispose. No native model callback bypass claim.

For #72/#73: no raw executable SVG/HTML, remote asset URLs, unbounded decoded data, unsafe paths, stale graph endpoints, cycles or cross-project access. Any separately approved local server binds loopback, checks host/origin/content-type/CSRF and per-project permissions; no unauthenticated public asset mount. No server introduced.

## Reproduced blocker: existing editor transaction

Exact blobs emitter-ui.js 81b0013907c70982e47f5502736bc43469230063, emitter-core.js 742f07114bec49d5236bb170301ce06892437e7d, curve-core.js 474772af160d764096f1c04d39a852a841e6c382 and color-core.js 3a00fce950d18d4c7325d182a17a79c9e4eddcc2 executed together in isolated V8. Minimal DOM fixture, no-op color widget, onChange throws before accepted host document changes. Not a real browser/GPU test. Seven rejected actions FAIL, two controls PASS. Each rejection called callback once and left host accepted state unchanged, but UI document changed.

| Action | UI doc preserved | Selection preserved |
|---|---|---|
| Rejected X edit | no | yes |
| Rejected drag | no | yes |
| Rejected add emitter | no | no |
| Rejected delete emitter | no | no |
| Rejected duplicate emitter | no | yes |
| Rejected add layer | no | no |
| Rejected delete layer | no | no |
| Locked drag (zero callbacks) | yes | yes |
| Valid X edit (one callback, intended update) | intentionally changed | yes |

Source: emitter-ui commit assigns doc=next before onChange(next); add/delete alter selection before commit. ui.html assigns cfg.multiEmitters before multiFx.configure. Runtime configure sets doc=next before setup/seek after partial filter preflight. Latter two are source observations, not actual injected Pixi failures. These are existing manual-editor problems independent of an agent.

### Next repair proposal — separate implementation approval required

Q1: moving only UI assignment is insufficient; swallowing error is rejected; prefer staged UI/host/runtime transaction. Q2: review actual setup/seek ownership, protected Burn builder/manifest and pinned Pixi disposal APIs before coding. Q3: after approval add seven RED rejection tests plus controls, then native renderer allocation/setup/seek failure injection. Separate slices: UI doc/selection publication and rerender rejected controls; host cfg publication; renderer rollback/cleanup or explicit broken state. No new globals, dependencies or agent surface. Preserve protected generated Burn HTML unless independently approved regeneration. Q4: partial renderer mutation, reentrancy, stale DOM controls, invalid selection, undo receipt, postcommit failure. Q5: stop after existing editor repair and independently review any optional agent work.

## Future implementation proof matrix (NOT RUN)

| ID | Required RED → GREEN |
|---|---|
| P01 | No registration by default; WebMCP absent preserves native UI; approved discovery bounded, duplicate labels unambiguous, hidden/secret/raw asset data excluded. |
| P02 | Manual/agent equivalent edit at same revision → normalized settings, exactly one configure, accepted revision and undo receipt, actual UI and sample witness. |
| P03 | Invalid type/range/unknown alias, removed target, stale revision/cursor, busy renderer or spoofed actor → zero writes/disclosure. |
| P04 | Denied/silent/timed-out confirm, revoked session or cancelled proposal → no mutation; approved exact current operation executes once. |
| P05 | Duplicate/reordered operations, changed payload same ID, renderer failure, uncertain receipt → no divergence/replay; reconcile actual state. |
| P06 | Asset replace/export/upload/GitHub command denied initially; #67 host authorization independently verified for future publishing; injected logs/issues treated as data. |
| P07 | WebMCP present/absent, revoke/unregister, no duplicate consent, no network, editor works without bridge. |
| P08 | Actual WebGL1/2/WebGPU, correct backend, real PNG alpha/zoom/repeat and both developer ZIPs, no receipt substituted for render proof. |
| P09 | Optional graph/import rejects unsafe paths, oversized decoded data, SVG/remote input, cycles and stale IDs; cancellation and clean PNG alpha checked. |
| P10 | Host/hook failure fails closed; no CCS certificate without demonstrated native callback and dispatcher. |

Decision: conditional research complete, NO-GO for SDK/WebMCP and agent mutation now. No approved implementation exists; future agent functionality requires separately approved work. #67 host consent, #71 independent QA and #69 artist UI research remain open. Actual browser, GPU, full native checkout and architecture NOT RUN (chat VM Git DNS unavailable). No owner PC access, manual CI, new branch, deployment or runtime edits.
