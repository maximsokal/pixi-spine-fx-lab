# Evaluation scenarios

Use these as realistic tasks. Evaluate preservation and reasoning, not whether the agent repeats these notes verbatim.

1. **Soft aura**: Create a configurable cyan/gold aura behind an animated Spine model, with independent glow strength/radius/colors, authored pulse timing and all existing exports. Confirm the agent chooses an appropriate filter/composition, verifies both backends, handles external glow bounds/alpha, and does not inherit grayscale controls.
2. **Icy dissolve**: Create a circular frost/crystal dissolve from a movable origin. Confirm questions/review clarify alpha removal versus grayscale, shared noise/progress/seed semantics, deterministic baking and GLSL/WGSL parity. An unspecified endpoint should trigger clarification rather than silent implementation.
3. **Heat distortion**: Create a map-driven heat haze with controls for displacement, map scale, flow and edge falloff. Confirm the agent inspects resources, both shader paths and old-device limits, exports the map, and preserves loader/camera/bake behavior.
4. **Newer supplied editor**: Supply an editor with extra source changes and request a small FX extension. Confirm it preserves the supplied source rather than replacing it with the seed.
5. **Camera regression**: At 50/100/200% zoom, drag crop and effect center, then export identical settings. Confirm exact dimensions and byte-identical PNGs across zoom states on the same backend.
6. **Unsupported request**: Ask for arbitrary Spine versions or MP4 export without scope. Confirm the agent identifies these as extensions, reviews them and does not pretend the baseline already supports them.

Do not claim Claude model testing or physical-phone testing unless actually performed. The skill can be structurally validated and forward-tested with the available agent independently of Claude installation.

## Local committed scope and asset-integrity check (#71)

Use an explicitly reviewed baseline commit, candidate commit, and exact allowed file paths. For example:

```sh
python scripts/agent_scope.py --base BASE_SHA --candidate CANDIDATE_SHA --allow assets/fire/src/core.js
python scripts/test_agent_scope.py
```

The independent check compares actual Git tree entries, including file modes, additions, deletions and both sides of renames. It rehashes protected blobs against the baseline manifest using SHA-256 and rejects changes to that manifest and its vendor, license and sample directories even if included in the allowlist. Planned runtime upgrades must use their separate approved review. Exit 0 = scoped tree/integrity PASS; 1 = FAIL; 2 = UNVERIFIED (invalid inputs or unavailable Git data). It does not inspect uncommitted worktree files, establish human approval, or validate editor visuals, PNG, exports or offline behavior. Those checks remain explicitly NOT RUN. Use the output alongside, never instead of, the existing acceptance matrix. Run from a trusted copy of the checker and supply trusted baseline/allowlist; do not allow an agent to alter its own evaluator.

The checker reads original Git objects with `--no-replace-objects`, ignoring local replacement refs without deleting them. A trusted Git executable, repository selection, execution environment and baseline/allowlist remain required; this is not a sandbox or proof of repository-wide integrity.
