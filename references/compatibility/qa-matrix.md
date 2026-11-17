# Runtime Compatibility — RED→GREEN / Verification Matrix

> This is an acceptance specification, not a report that all versions already pass.

## Per-pair evidence table
| ID | Check | Required proof |
|---|---|---|
| VC-01 | Correct target selection | profile `Pixi major + Spine export major.minor + exact package patch` logged; mismatches rejected with actionable error |
| VC-02 | JSON skeleton | reads valid matching-version JSON and rejects wrong major.minor |
| VC-03 | Binary `.skel` | correct binary loader works; corrupt/unknown version fails closed |
| VC-04 | Multi-page `.atlas` | every atlas image resolves with correct alpha/PMAs and textures; missing-page error retains previous preview |
| VC-05 | Attachments | region, weighted/unweighted mesh, deform, linked mesh and clipping work or have explicit feature gate |
| VC-06 | Advanced features | skins, events, draw order, animation mixing, two-color tint, physics constraints, sequence attachments per version; do not mark unsupported as passed |
| VC-07 | Time/pose | deterministic manual skeletal updates, reset, skin and animation selection, exact 60-FPS bake timestamps |
| VC-08 | Renderer | WebGL 1, WebGL 2, true WebGPU (where supported) with detected backend, NOT RUN where impossible |
| VC-09 | Filters | compiles shader against actual Pixi API, nonzero visible effect, correct blending/alpha, resource cleanup |
| VC-10 | Pixels | RGBA straight-alpha PNG at alpha 0,64,128,255; no double PMA or black fringes; correct orientation and crop |
| VC-11 | Export package | correct package dependencies and installation instructions; no incompatible alias; exported example runs |
| VC-12 | Offline | single-file packaged resources load with networking disabled; no untrusted live CDN |
| VC-13 | Camera/bake | identical output same backend/seed/camera variants, independent of zoom and guide visibility |
| VC-14 | Failure and cancel | no partial ZIP, error includes selected profile, original scene restored, no resource leaks |
| VC-15 | Resource guards | hard cap on texture size, GPU buffers, per-effect particles and renderer cache; limits in Low/Balanced/High |
| VC-16 | Regression | baseline pinned Pixi 8.22 + Spine 4.2.120 remains byte-identical in dependency manifest and unchanged behavior |

## RED→GREEN gates
1. Before an adapter is implemented, run at least one genuine failing feature/compatibility test against a selected incompatibility; merely failing because of missing runtime installation is insufficient evidence of a product bug.
2. Make focused loader tests pass first, then render, custom filters, PNG export, developer ZIP, reuse/cleanup. Record expected and actual data bytes and selected backend.
3. Positive fixtures: one valid JSON and one valid binary export for each supported Spine major.minor; multi-page atlas; mesh+clipping; features that exist for that release. Negative fixtures: wrong version, missing texture, corrupt binary, forbidden WebGPU.
4. Test WebGL 1 explicitly if claimed; Pixi 7 and earlier must NOT be labeled WebGPU. Pixi 8 and 4.3 require independent compatibility proof. Do not infer cross-runtime equality of render bytes.
5. Run existing smoke_editor.cjs in baseline environment and an adapted version of tests per profile. A path that cannot run must be `NOT RUN` with reason, not `PASS`.

## Release evidence record (proposed)
```json
{
  "profileId": "spine4.3-pixi8-example",
  "status": "NOT_RUN",
  "runtime": {"pixi": "PIN_REQUIRED", "spine": "PIN_REQUIRED"},
  "assetExport": "4.3",
  "backendActual": null,
  "environment": {"browser": null, "GPU": null},
  "checks": {"VC-01": "NOT_RUN", "VC-02": "NOT_RUN", "VC-10": "NOT_RUN"},
  "sourceCommit": null,
  "limitations": ["Documentation only; no adapter implemented"]
}
```

## Interop/security/license
Record upstream repository, exact artifact patch, SHA256 and Spine Runtime licensing/redistribution terms. Avoid shipping copies of third-party runtimes without proper licenses/notices; do not remove or weaken the current editor's spine licensing requirements.

Sources: https://esotericsoftware.com/spine-pixi · https://esotericsoftware.com/spine-versioning · https://pixijs.com/8.x/guides/migrations/v8 · https://github.com/pixijs-userland/spine