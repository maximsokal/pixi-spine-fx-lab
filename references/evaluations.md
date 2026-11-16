# Evaluation scenarios

Use these as realistic tasks. Evaluate preservation and reasoning, not whether the agent repeats these notes verbatim.

1. **Soft aura**: Create a configurable cyan/gold aura behind an animated Spine model, with independent glow strength/radius/colors, authored pulse timing and all existing exports. Confirm the agent chooses an appropriate filter/composition, verifies both backends, handles external glow bounds/alpha, and does not inherit grayscale controls.
2. **Icy dissolve**: Create a circular frost/crystal dissolve from a movable origin. Confirm questions/review clarify alpha removal versus grayscale, shared noise/progress/seed semantics, deterministic baking and GLSL/WGSL parity. An unspecified endpoint should trigger clarification rather than silent implementation.
3. **Heat distortion**: Create a map-driven heat haze with controls for displacement, map scale, flow and edge falloff. Confirm the agent inspects resources, both shader paths and old-device limits, exports the map, and preserves loader/camera/bake behavior.
4. **Newer supplied editor**: Supply an editor with extra source changes and request a small FX extension. Confirm it preserves the supplied source rather than replacing it with the seed.
5. **Camera regression**: At 50/100/200% zoom, drag crop and effect center, then export identical settings. Confirm exact dimensions and byte-identical PNGs across zoom states on the same backend.
6. **Unsupported request**: Ask for arbitrary Spine versions or MP4 export without scope. Confirm the agent identifies these as extensions, reviews them and does not pretend the baseline already supports them.

Do not claim Claude model testing or physical-phone testing unless actually performed. The skill can be structurally validated and forward-tested with the available agent independently of Claude installation.
