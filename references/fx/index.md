# FX Blueprint index — progressive disclosure

The small [index.json](index.json) is the machine-readable routing index. Each effect has its own independent Blueprint. Do **not** duplicate all specs into SKILL.md.

| Category | Selected Blueprint | Status | Contracts |
| --- | --- | --- | --- |
| FIRE | [Burn transition](fire/burn-transition.md) | **Reference implementation**, original Burn Lab | parameters, curves, spacing, emitters, colors, timeline |
| FIRE | [Torch Flame](fire/torch-flame.md) | **Reference implementation**, separate offline Torch Flame Editor | parameters, curves, spacing, emitters, colors, timeline |
| FIRE | [Fire Explosion](fire/fire-explosion.md) | **Reference implementation**, independent one-shot Explosion Editor | parameters, curves, spacing, emitters, colors, timeline |
| FIRE | [Fireball Projectile](fire/fireball-projectile.md) | **Reference implementation**, moving Bezier-head projectile with motion-tracking tail | parameters, curves, spacing, pathGeometry, emitters, colors, timeline |
| FIRE | [Embers and Sparks](fire/embers-sparks.md) | **Reference implementation**, hot-to-cool particles with one-to-four independent sources | parameters, curves, spacing, emitters, colors, timeline |
| FIRE | [Smoke Plume](fire/smoke-plume.md) | **Reference implementation**, soft organic looping plume, stop fade and burst | parameters, curves, spacing, emitters, colors, timeline |
| FIRE | [Heat Haze](fire/heat-haze.md) | **Reference implementation**, actual Pixi background-aware masked refraction; R/G/B data map + optional glow + background-baked composite | parameters, curves, spacing, emitters, colors, timeline |
| WATER | [Water Splash](water/water-splash.md) | **Reference implementation**, instant radial impact, cubic tapered crown, ballistic droplets/mist, optional ripple; repeat-impact loop and straight-alpha PNG | parameters, curves, spacing, pathGeometry, emitters, colors, timeline |
| WATER | [Rainfall](water/rainfall.md) | **Reference implementation**, seamless 60-frame periodic pooled rain, wind, actual ground contacts and optional near/far parallax | parameters, curves, spacing, emitters, colors, timeline |
| WATER | [Water Ripples](water/water-ripples.md) | **Reference implementation**, independently anchored 40-frame one-shot or cyclic concentric elliptical ring waves, optional arc-length highlights, alpha-aware pooled Pixi MeshSimple | parameters, curves, spacing, emitters, colors, timeline |
| WATER | [Waterfall](water/waterfall.md) | **Reference implementation**, seamless 60-frame flowing water ribbons, detached causal droplets, independently movable sparse base foam, optional 40-frame shutdown; pure path arclength and pooled Pixi MeshSimple/particles | parameters, curves, spacing, pathGeometry, emitters, colors, timeline |
| WATER | [Rising Bubbles](water/rising-bubbles.md) | **Reference implementation**, seamless 60-frame buoyant translucent bubble rim, independently positioned highlights and optional lifetime pop rings; 40-frame shutdown and true cubic nozzle arc spacing | parameters, curves, spacing, emitters, colors, timeline |
| WATER | [Steam Jet](water/steam-jet.md) | **Reference implementation**, independent white vapor pipe jet with dense/wisps/optional droplet layers, 60f loop + 40f stop | parameters, curves, spacing, emitters, colors, timeline |
| AIR | [Wind Gust](air/wind-gust.md) | **Reference implementation**, independent tapered curved 40-frame wind surge + optional dust, 60-frame loop | parameters, curves, spacing, pathGeometry, emitters, colors, timeline |
| AIR | [Snowfall](air/snowfall.md) | **Implementation candidate (acceptance pending)**, independently anchored pre-rolled near/far snow and optional wind swirls | parameters, curves, spacing, emitters, colors, timeline |
| ICE | [Frost dissolve](ice/frost-dissolve.md) | **Specification only**, not a shipped editor | parameters, curves, colors, timeline |
| GAME | [Hit flash](game/hit-flash.md) | **Specification only**, not a shipped editor | parameters, curves, timeline |

## Deterministic route for an agent

1. Match a **specific effect intent**, not a broad category. "Burn transition with sparks" selects the Burn Lab, while "torch flame" / "факел" selects [Torch Flame](fire/torch-flame.md). "Icy crystal frost" selects ICE and "damage hit flash" selects GAME. Plain "flame" routes to Torch, not the Burn transition mask. "Fireball projectile" routes to the independently draggable motion-aware [Fireball Projectile](fire/fireball-projectile.md). "Wind gust" / "порыв ветра" selects [Wind Gust](air/wind-gust.md). "Snowfall" / "снегопад" / "снігопад" selects the implementation candidate [Snowfall](air/snowfall.md). "Rising embers and sparks" routes to [Embers and Sparks](fire/embers-sparks.md). "Smoke plume" routes to [Smoke Plume](fire/smoke-plume.md). "Heat haze" routes to [Heat Haze](fire/heat-haze.md). "Water splash" routes to [Water Splash](water/water-splash.md). "Rainfall" routes to [Rainfall](water/rainfall.md). "Expanding water ripple rings" routes to [Water Ripples](water/water-ripples.md). "Cascading waterfall with streams" routes to [Waterfall](water/waterfall.md). "Fire explosion" / "взрыв" routes to [Fire Explosion](fire/fire-explosion.md).
2. If Burn, Torch, Fire Explosion, Fireball Projectile and/or Embers & Sparks / Smoke Plume / Heat Haze are requested together, or FIRE and ICE, or multiple candidate effects are mentioned, do **not** silently select one. Ask for the intended target or plan independent effects.
3. Read the chosen Blueprint and [schema](../contracts/blueprint.md). Then read **only** `requiredContracts` in the documented dependency order, skipping unrelated modules and Blueprints.
4. Inspect actual source and pins, [adaptation map](../adaptation-map.md) and official docs before any proposed implementation. For spec-only effects obtain a separate reviewed/approved plan; they do not already export PNG or developer ZIPs.

Run `python scripts/blueprint_router.py --route "hit flash damage"` to inspect a route, and `python scripts/test_blueprints.py` for regression tests. This router only validates/suggests relevant documents; it does not actually read documents on an AI agent's behalf.

## Optional geometry contract for specialized future effects

Vine Growth (#33), Chain Lightning (#38), Sword Slash (#42), ribbons and trails may depend on [FX-CORE-08 Path Geometry](../contracts/path-geometry.md) after Curves and Spacing. It is an **implemented reusable geometry library**, not a ready-made effect. Do not load it for unrelated FIRE/ICE/GAME variants; future Blueprints explicitly include `pathGeometry` in `requiredContracts` when applicable.

## Future issue catalog

Each new GitHub effect issue must be self-contained: goal, inputs, start/end look, timing/loop, alpha, artist controls, required renderer and GPU budgets, dependencies and concrete acceptance tests. Index issues by category/status/dependencies, **not** by pasting 41 full specifications into SKILL.md.

## Optional versioned adapters — specifications in main

The [PixiJS 5–8 / Spine Runtime 3.7–4.3 compatibility specifications](../compatibility/README.md) are now part of main. These Markdown files are **optional, documentation-only** and are not functioning adapters. Default remains PixiJS 8.22.0 and Spine Runtime 4.2.120 until separate review and tests approve a compatibility change.
