# FX-CORE-02 — Temporal and Spatial Spacing (v1)

This is a shared, pure numerical contract for independent specialized FX editors. It is not a general-purpose compositor. The Burn Lab integrates it **optionally** for path-based sparks; by default its existing Spine-surface spark emitter is unchanged.

## Sources and wiring

- `assets/template/src/spacing-core.js` exposes `FxSpacing` (CommonJS, browser global, `FxSpacing.mjs` in exported projects). It requires `FxCurves` v1 from [curves.md](curves.md).
- `assets/template/src/spacing-ui.js` mounts the optional artist UI. It reuses the SVG curve editor with a distinct ID prefix and a target selector for normalized rate, interval and spatial pixel-spacing curves.
- `assets/template/src/effect-core.js` builds one instance-specific numerical schedule and consumes exact event timestamps via `createCursor()`. Neither Pixi Ticker FPS nor the number of render calls changes event *times*.
- `assets/template/src/ui.html` places path guides in a **DOM-only** SVG overlay of the same logical preview plane. Guides are disabled by default, never added to Pixi's scene graph or PNG/ZIP, and never alter crop, camera or output resolution.
- The WebGL and WebGPU developer exports include the same `FxSpacing.mjs` source. PNG `sequence.json.spacing` records ordered time, path distances, anchor positions, logical coordinate space and cap status. Preview and isolated baker use one `SpineBurnFx` code path.

## Temporal settings and precedence

`createTemporalSchedule({ schemaVersion:1, mode, frequencySource, baseRate, interval, duration, minInterval, jitter, burstCount, burstDelay, seed, maxEvents, rateCurve, intervalCurve })`.

- Units: **seconds** and **events per second**, never events per frame. `baseRate` is not particle movement speed; `interval` is not spatial placement distance.
- `frequencySource: 'rate'` uses baseRate. `'interval'` uses 1/interval. Only the selected frequency source's custom curve is active; this avoids multiplying independent curves unpredictably.
- For uniform, accelerating, decelerating, clustered, and custom modes, integrate the intensity `N(t)=∫rate(t) dt` on a fixed 4,096-step midpoint grid, then invert each integer count threshold by binary search/interpolation. Inactive custom curve behaves like uniform. Custom rate curve value is a nonnegative normalized **rate multiplier**; custom interval value is a positive **interval multiplier**, inverted to events/sec.
- `burst` uses a stream of trigger times (1/frequency, 2/frequency, …), each with `burstCount` events separated by `burstDelay`. Tail events beyond duration are omitted; burst count and delay do not secretly change speed or paths.
- Seeded time jitter is bounded to ±0.45 of the local nominal interval, applied before minimum-spacing enforcement. The same config/seed always reproduces identical ordered events; the minimum interval is a hard lower bound. Events cannot be queued indefinitely after duration.
- `maxEvents` ≤ 4,096; reaching it sets `capped: true`. Zero duration or zero active rate returns no events. No per-frame quota guarantees or lost frame-driven events. The cursor consumes all due events, including multiple between successive frames; seek/reset requires a new cursor or an explicit cursor reset.

## Spatial settings and arc length

`buildArcTable(path,{tolerancePx:.25,maxDepth:16,maxPoints:8192})` and `createSpatialPlacement({path,baseSpacingPx,minSpacing,maxSpacing,spacingCurve,mode,jitter,seed,maxPoints,alignToTangent,pathFollow,reverse})`.

Path JSON is `{schemaVersion:1, closed:false, segments:[{p0:[x,y],p1:[x,y],p2:[x,y],p3:[x,y]}]}`; segments must connect exactly, and up to 256 are supported. `closed:true` adds a deterministic straight cubic closure when required. A repeated seam anchor is never placed. Zero length yields zero anchors. Segment count is not path length.

- Arc length: recursively subdivide cubic Bézier by De Casteljau while the difference between the control polygon length and the end chord exceeds an allocated global error budget. The **sum of remaining polygon-minus-chord bounds is ≤0.25 logical px**, not merely 0.25 per generated segment. Exceeding max depth or point count throws an explicit error, never silently lowers accuracy. A cumulative distance table maps distance to curve parameter and analytic tangent.
- Default coordinates are logical authoring px in a 512×512 field centered on the Spine bounds; no view/camera zoom or raster output size appears in the spacing formula. Developer integration may use independent scene transforms.
- `spacingCurve` is `FxCurves` v1 with `parameterKey:'spacingPx', domain:'pathPosition',inputUnit:'normalized-path',valueUnit:'px'`. It overrides base spacing when present. All physical intervals are clamped between `minSpacing` and `maxSpacing` (absolute minimum 0.25 px), and are regenerated from the same path origin after each geometry change.
- `even`: exact arc-length spacing without jitter. `random`, `stratified` and `clustered`: seeded deterministic interval modulation; optional bounded seeded spacing jitter applies independently. Each generates anchor distance, x/y, normalized length, tangent and optional launch angle. `alignToTangent` never changes arc distances.
- Open path follow policies: `clamp` (hold at end), `wrap` (repeat), `mirror` (reverse at ends). `reverse:true` in `pointAtDistance` reverses orientation. Closed paths wrap without duplicate seam objects.

## Combined time/distance precedence

`combineSchedule({schedule,placement,motion,mode:'time'|'distance'|'both',teleportThresholdPx,maxEvents})`.

- `time`: the temporal timetable is authoritative; each event selects the next ordered anchor (cycles on wrap). The emitter may be stationary without suppressing these events.
- `distance`: cumulative physical movement crosses anchor distance thresholds. The event timestamp **and position** are interpolated within the continuous physical motion segment. Stationary movement never emits; reversal counts real distance travelled, not net displacement, with emitted points following the returning emitter.
- `both`: each **time event** may emit only when enough cumulative real movement has been recorded to cross the next distance threshold. It does not add two streams or spawn catch-up bursts. The emitted position comes from the emitter's position at the qualifying time; temporal anchors still determine spacing thresholds.
- Motion jumps longer than `teleportThresholdPx` are treated as teleportations: they update the baseline, but contribute **zero** traveled distance and no catch-up emissions. Mark a motion record with `teleport:true` for a wrapped open path even if the jump is shorter than the numeric threshold. Closed/open/reversed movement shares one deterministic distance policy. Invalid tracks, duplicate timestamps, and nonfinite geometry are rejected.
- The first Burn Lab integration derives a fixed motion track from the independently adjustable **emitter travel speed (px/s)** along the path; the original **spark launch speed (px/s)** changes particle trajectory only. While the path emitter is enabled, particle position is computed analytically from event birth time, velocity and gravity to avoid frame-step drift. Existing legacy sparks remain unchanged.
- The Burn quality profile still caps active particles and emission; disabled controls create no new FX layers. Turning the path mode on/off resets owned emission state, not shared Spine data. `sparkTrails` disables all optional particle streaks; `spacingGuides` affects only the DOM preview. No extra lines are baked into a PNG.

## Verification and exclusions

Run `scripts/test_spacing.cjs` for pure event/arc/mode/cap/seed/frequency/zero-motion tests. Run `scripts/test_spacing_editor.cjs --html assets/Spine_Burn_Lab.html --backend webgl|webgpu --output OUT` for real browser settings, curve editing, guide visibility, 40-frame PNG metadata and both developer ZIP imports; include `--webgl1` to demand an actual WebGL1 renderer. Verify true 30/60/120 FPS timestamp equality via `createCursor`, not a mocked frame counter. Re-run existing `test_curves.cjs`, `test_curve_editor.cjs`, `smoke_editor.cjs`, `test_png_pma.cjs`, `test_bake_lifecycle.cjs` and Vite builds on the two exported projects.

Allowable numerical tolerance is ≤1 ms for intensity inversion versus an independently computed reference, and ≤0.25 logical px for arc length. Cross-backend metadata must contain the same event times, anchor distances and seed; GPU raster bytes are not required to match across unrelated GPUs. Retain exact versions PixiJS 8.22.0 / spine-pixi-v8 4.2.120.

**Scope boundary:** This contract implements timestamp and arc-distance spacing, not ribbon meshes or branches. The separately approved optional [FX-CORE-08 Path Geometry](path-geometry.md) adds bounded ribbon tessellation, tapered widths and branch graphs using this same `buildArcTable` / `createSpatialPlacement` oracle. Neither module alone creates a complete effect-specific editor or generic FX graph.
