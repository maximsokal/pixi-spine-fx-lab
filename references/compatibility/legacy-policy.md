# Legacy PixiJS / Spine bridge policy (Pixi 5–7; Spine 3.7–4.1)

## Status
Community bridging is a **research path**, not built-in certified compatibility. `pixijs-userland/spine` describes `pixi-spine` v3.x for PixiJS v5/v6 and v4.x for PixiJS v7, with support for Spine export series 3.7, 3.8, 4.0, 4.1. There is no official `spine-pixi-v8` adapter for those older editor formats. The repository history and exact package patch MUST be audited at implementation time.

## Safe opt-in steps
1. Read relevant `pixi/{5|6|7}.md` and `spine/{3.7|3.8|4.0|4.1}.md`; inspect `https://github.com/pixijs-userland/spine` README, compatible branch/tag and published npm metadata.
2. Determine whether to use the aggregate `pixi-spine` package or a narrower version bundle. `@pixi-spine/all-3.8` is documented; other `@pixi-spine/*` loaders may need custom adapter work, not an assumed drop-in. Exact compatible patch is unknown until verified.
3. On an isolated working copy only, install pinned Pixi version and compatible `pixi-spine` major. Verify loader registration and the precise import/constructor for that package (community examples use `new Spine(resource.spineData)`).
4. Re-export user assets with matching old Spine Editor if assets are mismatched. Do not rewrite `.skel` headers or assume JSON field rename is equivalent to re-export.
5. Reimplement the Pixi 8-specific UI loader, texture-source/PMA, `Filter/GlProgram`, mesh/clipping, WebGPU readback, PNG extraction and example packaging as explicit version adapter seams. Do not copy v8 shader code unchanged.
6. Document unsupported/changed features rather than silently flatten meshes, discarding sequences/physics or faking tint-black. If core visual fidelity cannot be maintained, mark adapter unsupported.

## What changes versus baseline
- Older app init is typically synchronous, textures may use BaseTexture, filters have older constructors and no PixiJS 8 WGSL shader path.
- Community runtimes do not necessarily expose the same parser, geometry or lifecycle APIs as official 4.2/4.3 packages.
- WebGPU is not a legacy path. Preserve offline WebGL runtime, meaningful fallback and true PNG straight alpha.
- Cross-version multi-model display needs isolated rendering contexts or a separately reviewed complex host; not automatically supported.

## Tests / rejection
Must pass VC-01..VC-16 as applicable plus old-version golden fixtures and multi-page atlas. Stop if license/peer dependency/loader source cannot be pinned or if user requires unverified advanced Spine features. Never claim a version is supported based on package README alone.

References: https://github.com/pixijs-userland/spine · https://esotericsoftware.com/spine-versioning · https://pixijs.com/8.x/guides/migrations/v8