# Working with Spine Assets

## Supported input

The current runtime supports **exports from Spine Editor 4.2.x**, using either a skeleton `.json` or binary `.skel`, an `.atlas` file, and **all** referenced texture pages. It supports multi-page atlases, meshes, clipping, skins and sequence attachments within the pinned 4.2 runtime.

A Spine Editor project file (`.spine`) is not a runtime export and cannot be loaded in place of JSON/SKEL. Other Spine export versions are **not** automatically supported by changing a filename or JSON version field.

## Loading workflow

1. Open an editor (for example `assets/Spine_Burn_Lab.html`).
2. In **Spine assets**, select a skeleton export and an atlas.
3. Select every image file referenced by the atlas, including additional pages and page-specific textures.
4. Inspect the selected files and click **Load preview**.
5. Choose an available animation and skin after loading succeeds.

The loader retains the prior preview when a new model fails to load. Correct the missing/ambiguous asset or version error rather than replacing the working data with a partial set.

## Sample assets

The bundled sample is **Doctor head**: `assets/template/sample/Doctor_head.json`, `Doctor_head.atlas` and two texture pages (`Doctor_head.png` and `Doctor_head_2.png`). Its manifest entry is in [template.json](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/assets/template/template.json). The manifest is the authoritative list; a builder rejects missing atlas pages.

## Spatial rules

- **Camera zoom / Fit / 100%** changes the editing view only, never output crop, animation scale or PNG pixels.
- **Skeleton scale** is separate from camera zoom.
- **Effect origins, anchors, and crop handles** use the matching inverse camera mapping for interaction.
- Effects with world/local/bone/slot/attachment anchors must define behavior when an anchor disappears; see the effect's Blueprint.

## Export safety

Include all required skeleton/atlas/texture files in developer packages. Never upload licensed customer character assets to a service without authorization. The editor itself is designed to run offline.

Read [the preserved product contract](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/product-contract.md) and [[Runtime-Compatibility]] for exact scope.
