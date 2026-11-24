# Effect Editors and Blueprint Library

The repository ships **14 independent reference editors**. Open the HTML file from `assets/`; inspect the Blueprint for effect-specific behavior, controls, bounds, timing and acceptance criteria. All implementations listed here target the pinned PixiJS 8 / Spine 4.2 baseline.

| Category | Effect | Ready-to-open HTML | Blueprint |
| --- | --- | --- | --- |
| FIRE | Burn transition | [Spine_Burn_Lab.html](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/assets/Spine_Burn_Lab.html) | [Burn](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/fx/fire/burn-transition.md) |
| FIRE | Torch Flame | [Torch_Flame_Lab.html](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/assets/Torch_Flame_Lab.html) | [Torch](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/fx/fire/torch-flame.md) |
| FIRE | Fire Explosion | [Fire_Explosion_Lab.html](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/assets/Fire_Explosion_Lab.html) | [Explosion](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/fx/fire/fire-explosion.md) |
| FIRE | Fireball Projectile | [Fireball_Projectile_Lab.html](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/assets/Fireball_Projectile_Lab.html) | [Projectile](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/fx/fire/fireball-projectile.md) |
| FIRE | Embers and Sparks | [Embers_Sparks_Lab.html](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/assets/Embers_Sparks_Lab.html) | [Embers](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/fx/fire/embers-sparks.md) |
| FIRE | Smoke Plume | [Smoke_Plume_Lab.html](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/assets/Smoke_Plume_Lab.html) | [Smoke](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/fx/fire/smoke-plume.md) |
| FIRE | Heat Haze | [Heat_Haze_Lab.html](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/assets/Heat_Haze_Lab.html) | [Haze](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/fx/fire/heat-haze.md) |
| WATER | Water Splash | [Water_Splash_Lab.html](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/assets/Water_Splash_Lab.html) | [Splash](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/fx/water/water-splash.md) |
| WATER | Rainfall | [Rainfall_Lab.html](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/assets/Rainfall_Lab.html) | [Rainfall](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/fx/water/rainfall.md) |
| WATER | Water Ripples | [Water_Ripples_Lab.html](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/assets/Water_Ripples_Lab.html) | [Ripples](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/fx/water/water-ripples.md) |
| WATER | Waterfall | [Waterfall_Lab.html](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/assets/Waterfall_Lab.html) | [Waterfall](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/fx/water/waterfall.md) |
| WATER | Rising Bubbles | [Rising_Bubbles_Lab.html](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/assets/Rising_Bubbles_Lab.html) | [Bubbles](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/fx/water/rising-bubbles.md) |
| WATER | Steam Jet | [Steam_Jet_Lab.html](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/assets/Steam_Jet_Lab.html) | [Steam](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/fx/water/steam-jet.md) |
| AIR | Wind Gust | [Wind_Gust_Lab.html](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/assets/Wind_Gust_Lab.html) | [Wind](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/fx/air/wind-gust.md) |

**Reference implementation** means a real source/editor/build/test path is recorded in the Blueprint. It does **not** mean every browser/device, export or visual reference was independently retested on the date of this Wiki update.

## Examples not yet shipped

- [ICE: Frost dissolve](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/fx/ice/frost-dissolve.md) — specification only.
- [GAME: Hit flash](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/fx/game/hit-flash.md) — specification only.
- The larger [41-effect issue catalog](https://github.com/maximsokal/pixi-spine-fx-lab/issues/52) is a roadmap/specification index, **not** 41 completed editors.

## Editor source and builders

The editors in this table have effect-specific sources under `assets/template/src/` (Burn) or `assets/<effect>/src/` (other effects), with matching `scripts/build_*_editor.py` builders. In particular the Rising Bubbles builder is `scripts/build_bubbles_editor.py`. Use [the adaptation map](https://github.com/maximsokal/pixi-spine-fx-lab/blob/main/references/adaptation-map.md) to avoid editing unrelated effects.

## Route requests without loading the whole library

~~~sh
python scripts/blueprint_router.py --route "underwater rising bubbles"
python scripts/test_blueprints.py
~~~

The router identifies a Blueprint and its required contracts; it does not implement the effect. For ambiguous multi-effect requests, select/approve the independent desired effects rather than silently merging them.

See [[Agent-Workflow-and-Contracts]] for safe adaptation.
