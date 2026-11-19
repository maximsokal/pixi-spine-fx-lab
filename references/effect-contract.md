# Shared effect contract

Use one implementation in live preview, both developer ZIPs and isolated baking. For custom and reusable parameter curves, read the versioned [curve contract](contracts/curves.md) and reuse the same `FxCurves` evaluator across all three outputs. For seeded temporal event scheduling and spatial placement use [FX-CORE-02](contracts/spacing.md); it treats particle speed, emission interval, actual distance travelled and arc-length spacing as separate variables. For independently positioned/anchored effect layers, use the versioned [FX-CORE-03 emitter contract](contracts/emitters.md), its identity-transform host and selective ownership. For reusable RGBA gradients and ordered particle-age envelopes use [FX-CORE-04](contracts/colors.md); send straight RGB/alpha to Pixi and preserve the single-pass WebGL PNG unpremultiplication. For deterministic absolute-time playback, bidirectional seek, independent Spine time, CPU checkpoints and repeatable PNG exports use [FX-CORE-05](contracts/timeline.md) with one shared clock for preview/bake/developer examples. Define a concrete, JSON-serializable settings type. The following is an interface design, not an already shipped universal adapter:

```ts
interface EffectInstance {
  configure(settings: EffectSettings): void;
  setBounds(bounds: {x: number; y: number; w: number; h: number}): void;
  setProgress(progress: number): void;
  update(elapsedSeconds: number): void;
  setEnabled(enabled: boolean): void;
  play(): void; pause(): void; reset(): void; destroy(): void;
}
```

## Ownership and time

Pass Pixi/Spine namespaces, application/stage, identity-transform host, model, settings and fixed authoring bounds into the factory. Move/scale the model inside the host. Give instances independent filters, uniforms and RNGs.

Restore pre-existing filters/area on destroy. Dispose owned graphics, filters, render textures, listeners and caches, but not caller-owned atlas/model data. Put extra layers on the supplied stage so the isolated bake includes them. Preserve/update diagnostics deliberately; do not fake successful rendering.

Update the skeleton first and effect once per tick. Keep animation time, effect time, raw phase and eased progress separate. Use real elapsed time live and fixed steps for baking. Seed procedural work per instance; never reset global Math.random. Define endpoint, reverse, paused and disabled semantics for each effect.

## Shaders and alpha

Provide both GLSL and WGSL, or use a pinned filter documented/tested on both. Test WebGL 1 separately. Preserve premultiplied-alpha math inside Pixi and straight-RGBA PNG output. Avoid zero-alpha division, opaque rectangles and unintended black flattening. Document final normal/additive compositing.

Keep color/alpha/blend/texture-channel interpretation consistent across preview and handoff. Include an influence envelope for glow/displacement/particles, then apply the exact final crop. Never cut effects off at an accidental intermediate bound.

Do not read GPU pixels every live frame. The seed emitter uses Spine geometry and source-texture alpha. Offline baking may read pixels explicitly.

## Regressions already discovered

- Keep the pinned backend texture-count initialization: Pixi 8.22 caches a default batch shader; the seed refreshes its texture limit through a version-specific helper. Revalidate an upgrade.
- Keep the view-frame refresh after logical size/resolution changes with unchanged physical canvas dimensions, or screen/crop coordinates can diverge.
- Keep explicit WebGPU texture-to-buffer PNG readback. Asynchronous toBlob on a transient WebGPU canvas produced empty images.
- Align GPU bytesPerRow to 256, await mapAsync, handle BGRA/RGBA, unpremultiply safely, unmap/destroy buffers and bound allocations.

Official references: [Pixi filters](https://pixijs.com/8.x/guides/components/filters), [pinned extraction API](https://pixijs.download/v8.22.0/docs/rendering.ExtractSystem.html), [community filters compatibility](https://github.com/pixijs/filters), [Spine Pixi](https://esotericsoftware.com/spine-pixi).
