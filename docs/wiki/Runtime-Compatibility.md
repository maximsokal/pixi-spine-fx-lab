# Runtime Compatibility

## Tested/project baseline vs optional proposals

| Dimension | Supported source baseline | Other versions |
| --- | --- | --- |
| PixiJS engine | **8.22.0** | PixiJS 5/6/7 proposals are **specification only** |
| Spine integration | **spine-pixi-v8 4.2.120** | Other integration packages require independent development and validation |
| Spine export | **4.2.x** JSON or `.skel` + atlas + textures | 3.7, 3.8, 4.0, 4.1 and 4.3 are **not supported in the shipped editor** |
| GPU | WebGL and WebGPU-preferred handoff as supported by current effect/browser | Actual backend and fallback need per-effect verification |

The existence of a compatibility specification, a GitHub issue or an upstream runtime does **not** certify a particular Pixi/Spine combination in this project.

## Choosing an alternate version

1. Establish exact **Spine Editor export** version, **PixiJS major**, rendering backend and needed Spine features.
2. Review the [compatibility index](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/compatibility/README.md), the [compatibility contract](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/compatibility/contract.md), exact Pixi and Spine module, and [QA matrix](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/compatibility/qa-matrix.md).
3. Verify package APIs and licensing against official upstream docs; do not rewrite version markers as a substitute for matching runtimes.
4. Review the migration plan and get explicit approval. Run version-specific RED→GREEN fixture checks and actual graphical/export tests before changing support claims.

The optional [COMPAT-MASTER issue](https://github.com/maximsokal/pixi-spine-fx-lab/issues/65) and [COMPAT-CORE-01](https://github.com/maximsokal/pixi-spine-fx-lab/issues/53) track this work.

## Renderer subtleties

WebGPU support in PixiJS 8 does not automatically imply WebGPU support in old PixiJS families or in arbitrary effect shaders. WebGL1/2/WebGPU differ in shader language, filtering, texture format, precision, extraction and alpha behavior. WebGPU fallback must be documented; a successful WebGL fallback is not proof that WebGPU rendered.

## Explicitly outside current baseline

- Direct Spine Editor `.spine` project import/export.
- Guaranteed WebM/MP4 video export.
- Certified mobile FPS for a given device/year.
- A universal runtime that parses all Spine JSON/SKEL formats.

Official background: [Spine versioning](https://esotericsoftware.com/spine-versioning) · [Spine Pixi integration](https://esotericsoftware.com/spine-pixi) · [Pixi v8 migration](https://pixijs.com/8.x/guides/migrations/v8).
