# Aether Drift 2.0 — agent conventions

This is a new standalone PlayCanvas Engine + strict TypeScript + Vite project. The original https://github.com/esteves7771/Aether-Drift is a read-only design reference. Never modify it, reuse its renderer, or deploy there.

## Architecture

- `src/main.ts`: sole AppBase owner, explicit gameplay state, fixed 120 Hz accumulator, interpolated transforms, renderer selection, resize/focus handling.
- `flight.ts`: allocation-free local-axis thrust and quaternion flight simulation; no DOM/render ownership.
- `collisions.ts`: seeded test field and swept ship-sphere/asteroid-sphere collision with separation, restitution, damage.
- `input.ts`: keyboard and pointer-lock mouse command sampling.
- `camera.ts`: interpolated chase target and exponential camera smoothing.
- `scene.ts`: procedural geometry, materials, lights, static batches, single-mesh stars.
- `audio.ts`: gesture-activated procedural engine sound. `ui.ts` / `style.css`: DOM HUD and menus.
- `config.ts`: central flight constants and persisted settings. `combat-config.ts`: weapons, shields, enemy tuning, pool limits, waves.

- combat.ts: fixed-step weapons, shields, score, safe wave spawning, nearest swept projectile hits.
- projectiles.ts: fixed projectile pool and relative-motion sphere sweep; enemy.ts / enemy-ai.ts: enemy state and deterministic state transitions/3D steering.
- combat-view.ts: preallocated enemy variants, bolts, muzzle flashes, impact/debris/shield effects; interpolation only, no gameplay damage.
- combat-ui.ts: target projection/off-screen markers, shield/wave/score HUD. No simulation state in DOM.

## Conventions

Right-handed +Y up, ship and camera forward -Z, metres/seconds, angle APIs in degrees. Never derive simulation orientation from Euler readings. Allocate scratch vectors/quaternions once. Keep simulation independent of frame rate and DOM. Gameplay pauses on blur, hidden document, pointer unlock, or Escape; clear input on every state transition. Phase 4 adds the Wave 5 capital encounter, missiles, EMP, elites, and squad orders. Shops, missions, multiplayer, and new environments remain out of scope.

Retain official `.agents/skills` and `.claude/skills`. Apply `build-app`, `apply-conventions`, `reuse-scripts`, `light-scene`, and `inspect-runtime` as relevant. Check installed `playcanvas/build/playcanvas.d.ts` for current APIs. Shipped camera/character controllers do not implement this game's inertial six-axis ship model.

## Verification

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:smoke`. Install browser once with `npx playwright install chromium`. Browser tests use production preview and inspect the app through the official devtools hook. Inspect captured PNGs for visual changes. Keep test instrumentation outside the shipped game. `?webgl` explicitly exercises the WebGL2 path.

Vite uses `base: './'`; no remote assets, CDN, editor, API, backend, or production deployment. Serve `dist/` through static HTTP (ES modules do not support direct file:// launch).

Position-only procedural meshes must use emission-only materials (`useLighting = false`, `useSkybox = false`, `useMetalness = false`, black specular). A normal-dependent shader on the stars or rings invalidates the whole WebGPU command buffer. Run `tests/render-visibility.spec.ts` after rendering changes: it reads actual canvas pixels, isolates the ship and stars, and checks both backends. HUD state, draw counts, and a quiet production console do not prove rendering succeeded.

## Phase 3 visual ownership

- `art-kit.ts`: shared surface/emission setup, merged model construction with normals/UVs, and boot-time attribute validation.
- `spacecraft-art.ts`: cached player/interceptor/heavy art; clones share geometry/materials. Player gun anchors are `(±1.35, -0.12, -2.8)`; do not move gameplay spawn positions for cosmetic changes.
- `procedural-textures.ts`: deterministic CPU texture generation at boot. Color textures are sRGB; normal-map data is linear. Equirectangular cloud noise must wrap without seams or angular degeneracy.
- `graphics.ts`: persisted Low/Medium/High presets, resolution/DPR caps, optional CameraFrame bloom (High only). Never enable expensive post effects by default without measuring.
- `scene.ts`: unchanged collision inputs, indexed rock variations, mineral textures, planet/rings/atmosphere, star layers, nebula, and prefiltered ship-lighting atlas. Camera excludes the atlas skybox layer. Directional key/rim masks are 1/2; ship mesh instances use mask 3. Clustered local lighting is disabled because there are no local lights.
- `combat-view.ts`: visual-only cached variants, pooled flares/shock fronts/debris/traces, and shader warmup on boot/preset changes. Effects use alpha-weighted additive blending where opacity masks are needed.

Gameplay simulation, flight tuning, AI transitions, projectile damage/speed/rate, and asteroid centers/radii remain Phase 2 behavior. Keep simulation changes outside visual milestones. Use `tests/visual-presets.spec.ts` in addition to combat and actual-canvas regression checks after changes to this rendering setup. Settings/preset changes may rebuild static batches while paused; the game loop must not generate geometry, textures, or materials.

## Audio ownership

- `music.ts`: lazy HTMLMediaElement MP3 streaming, bounded four-channel cache, gesture unlock, equal-power state crossfades, preserved playheads, pause/mute, guarded async play promises, and bounded one-shot death playback. All updates come from the app loop.
- `music-manifest.mjs`: Vite-only local asset presence manifest; no speculative MP3 fetches for missing files. Dev refresh/build picks up new assets. `death.mp3` is never a playback entry; only `death-cue.mp3` is.
- `main.ts`: menu/launch/pause/focus/death/reset soundtrack hooks and future `boss:spawn` / `boss:defeated` audio events. These hooks do not create bosses or alter wave/gameplay state.
- `audio.ts`: preserves existing synthesis and routes all SFX through one output gain. Effective SFX volume is Master × SFX; soundtrack volume is Master × Music. Settings retain legacy volume-to-SFX migration.
- `tools/create-death-cue.mjs`: offline MP3 edit/provenance helper; preserve original sources. Credit all sources in `MUSIC_CREDITS.md` and retain available license evidence/hashes. `.local-tools/` is ignored and never bundled.

Use `src/music.test.ts` and `tests/music.spec.ts` for soundtrack changes. Generated silent MP3s are test fixtures only, never replacement music. Verify real supplied-track decoding when assets are present, and retain explicit missing-file coverage. Phase 4 gameplay remains separate.

## Phase 4 gameplay ownership

- `evolution-config.ts`: ability, elite, boss and encounter balance; `wave-director.ts`: bounded squad groups, breaks, Wave 5 boss, and harder subsequent waves.
- `boss.ts`: component damage gates and telegraphed phases; `boss-view.ts`: cached capital geometry and visual-only phase/arrival cues.
- `missiles.ts`: twelve reusable guided missiles; Combat applies the same nearest relative-motion sweeps as lasers, including armor and asteroid cover.
- `squadron.ts`: formation, flank, regroup orders and rotating attack budget; EnemyAI retains local avoidance and state transitions.
- Actual boss lifecycle emits the existing `boss:spawn` / `boss:defeated` events. The approved music implementation remains unchanged.
- `npm run test:phase4` builds a test-only driver into ignored `.local-tools/phase4-preview`, starts port 5181 and runs the live game on both renderers. A deterministic pilot advances Waves 1–6 without changing enemy health, director state, or cover. It isolates boss canvas pixels, tests inputs/pause/death/restart, samples rendered frames and asserts stable render-entity counts. No driver or simulation globals are included in the ordinary production build.

## Phase 5 milestone A ownership

- `arcade-config.ts`: authoritative point values, Flow thresholds/window and optional challenge tuning. CombatFlow is the sole score owner; legacy score config fields alias it.
- `combat-flow.ts`: confirmed-hit accuracy, clean/boost awards, chained kills, damage penalties and bounded score feedback. Combat freezes its clock outside targetable encounters and observes external asteroid hull damage.
- `wave-challenge.ts`: deterministic opt-in per-wave goals, one completion award and no spawn dependency. Preferences are sampled at the start of a wave.
- `records.ts`: versioned, validated local records, best-run summaries and graceful storage failure. `main.ts` finalizes a run once; no persistence belongs in the fixed-step loop.
- `menu.ts` / `menu.css`: presentation states and DOM navigation; reuse existing settings elements/listeners. `UI` retains flight telemetry; `CombatHUD` owns score/Flow and minimal target markers. Flight state never lives in DOM.
- Home showcase changes render transforms/camera only. Flight rotation and simulation stay untouched; chase state is reset when launching. Audio presentation uses the existing MusicManager states; do not refactor the approved music module.
- `npm run test:arcade`: test-only preview driver plus arcade/persistence and retained Phase 4 encounters on both backends. Keep driver globals out of the ordinary bundle. Phase 5B below owns the follow-up spectacle work and limited atmosphere additions.

## Phase 5B ownership

- `spectacle-config.ts`: shared capital part anchors/radii, hull proxies, standoff/tactics/patterns, fixed destruction beats, speed/camera envelopes, effect counts and decorative quality limits. Legacy boss timing fields alias it. Do not independently rescale the visual capital away from its targets.
- `boss.ts`: bank selection, locked-aim warnings, physical patterns, rotating coolant exposure and death clock. Health/projectile damage remain unchanged. `boss-view.ts`: modular visual geometry, apertures, radiators, engine exhaust, heat damage, aim lines and drifting wreck state. Never allocate geometry/materials in render.
- `Combat`: existing score authority awards the confirmed fatal hit once. Death beats emit VFX/SFX only; victory/music notification waits for final detonation. The director treats wreck clearance as encounter occupancy, while Flow stays frozen and HUD reports a secured sector instead of a live hostile.
- `combat-view.ts`: shared effect pool with preemption priority, bounded secondary detonations and per-instance fade parameters. Secondary audio is triggered from the same update as its VFX; pauses freeze the queue. Position-only rings/dust always use unlit materials.
- `flight-feel.ts`: render/audio envelopes only, no flight-state mutation. `atmosphere.ts`: decorative fleet/wrecks plus one preallocated line mesh for dust; no CombatTargets or colliders. Low/Medium/High budgets are explicit.
- Phase 5B unit tests prove proxy/target access, escape lanes, locked aim, exposure windows, one-shot death events and frozen Flow; existing full browser encounters capture normal/elite/capital effects, warnings, attacks, boost, and steady/explosion frame samples. Keep test event capture/driver globals out of production.
- Visual source evaluation is in `ASSET_CREDITS.md`; no downloaded model pack was introduced. Preserve the approved MusicManager and Phase 5A screens.

## Phase 5C ownership

- `fleet-config.ts`: new-role balance, finite drone budgets, bomber seeker tuning and weighted encounter templates. Preserve Waves 1–5; Wave 10 is Phantom, later waves continue.
- `fleet.ts`: support preparation, physical seeker steering, generation-safe carrier ownership and no-score orphan retirement. Keep the existing eight ship slots and projectile pool.
- `phantom.ts` / `phantom-view.ts`: separate continuous-flight boss simulation and cached presentation, using the existing Boss interface, score authority and lifecycle/music events. Dreadnought remains the Wave 5 boss.
- `spacecraft-art.ts`: cached bomber/carrier/drone variants; never allocate art during combat. Phantom records add optional fields to the existing validated local schema.
- Removed obsolete 3D navigation-beacon boxes from `scene.ts`; do not recreate floating emissive bars in targeting or fleet art. Preserve selected brackets, off-screen markers and physical projectiles.
- `src/fleet.test.ts` covers deployment limits, owner reuse, guidance/EMP, scoring, Phantom and progression. `tests/fleet.spec.ts` exercises actual Waves 1–11 on both renderers and captures ships, phases and destruction. Keep its deterministic pilot out of production.

## Phase 5D ownership

- `frontier.ts`: bounded run-persistent locations, installation targets (IDs 16–21), local asteroid mounts, warning/LOS/range-limited defenses, finite supplies and queued ambushes. Optional installations do not block wave completion. Power shutdown/rewards are idempotent. Use CombatFlow only for points.
- `frontier-view.ts`: cached foundations, mounted towers, wreck/relay geometry and a single navigation marker. No floating bars or unselected health meters. Preserve discovery state outside DOM; quality controls decorative detail only.
- `cruise.ts`: separate travel envelope around unchanged normal Flight.step; obstacle lookahead, threat/weapon exit, bounded acceleration/deceleration and re-entry cooldown. `camera.ts` accepts optional travel velocity only for cruise/settling compensation. Main owns input, pause and rendering/audio envelopes.
- `run-upgrades.ts`: capped run-local ranks and deterministic milestone offers. Combat applies modifiers without mutating shared weapon constants. `upgrade-ui.ts` only presents choices; main freezes simulation/audio and clears input while selecting. Never serialize ranks as persistent economy.
- `guardian.ts` / `guardian-view.ts`: component-gated environmental boss, shared art/damage anchors in `guardian-config.ts`, target IDs 22–28, finite escorts and existing destruction/music events. Use getTarget(id), not array index assumptions: optional world targets can be absent in fixtures.
- `bossForWave` owns configurable every-fifth-wave rotations. Existing Wave 5/10 implementations remain separate and unchanged in behavior. Guardian records are optional additive fields, preserving older data.
- `environment.ts`: one actual sector's name/nebula/planet definition consumed at scene construction, independent of Combat. No portal or generic universe framework.
- `frontier.test.ts`, `run-upgrades.test.ts`, `guardian.test.ts` cover the new simulation. Dedicated browser files verify locations/cruise/refits and real Waves 1–16 on both backends. The test-only pilot selects actual upgrades, resumes fire after cleared inputs and navigates around Guardian cover using velocity; it never edits enemy health or skips director waves. Keep globals out of production.

## Imported model ownership

- Original archives are read-only inputs in ignored `assets-source/`. `tools/extract-model-sources.ps1` checks path containment, link entries and extraction limits; `.blend` conversion must use `--disable-autoexec` and `use_scripts=False`. Blender and scratch data stay in `.local-tools/`, never public or runtime dependencies.
- `tools/prepare-models.py` relinks supplied PBR maps, bounds triangles/textures, bakes static source transforms and merges objects by material. Star Sparrow begins at zero-scale animation frames; inspect a populated frame and avoid joining into a zero-scale active object. Preserve original sources and retain conversion decisions.
- `model-config.ts`: decoded-vertex bounds, intended extent, pivot/yaw and weapon/exhaust/proxy calibration. Simulation remains authoritative for collision radii, weapon damage and movement. Do not independently enlarge enemies to make assets easier to see.
- `model-library.ts`: bounded demand-loaded local container cache. Instantiate with `instantiateRenderEntity`; place calibration on a fresh wrapper around the untouched authored container root. Setting scale/position directly on a GLB root can destroy its FBX unit conversion. Set ship masks to 3; keep valid normals/UVs and existing WebGPU attribute validation.
- `imported-fleet.ts`: cosmetic variants below existing enemy roots, cached eight-slot instances per role, original fallback during streaming. Shared materials/textures, instance-local emissive feedback, no per-frame asset/entity/material creation. `Enemy.visual` never changes elite tuning or adds pools. All original AI and Combat Flow remain authoritative.
- `imported-landmarks.ts`: ISS/station/cargo views and demand-loading ranges. Frontier owns their navigation, one-time supplies and cheap core proxies. Keep actual meshes outside the target-marker system; no floating bars.
- `ship-hangar.ts`: original default plus optional Surveyor, identical simulation/root/muzzles. Wait for readiness, handle missing models, avoid async selection races and reuse the selected visual across resets.
- `tools/verify-models.mjs` validates actual shipped GLB bounds on geometry/material/size/external dependencies; `model-assets.test.ts` checks semantic calibration and cosmetic tuning invariance. `tests/models.spec.ts` checks zero initial model requests, actual rendered AABB extents (not just DOM), alternate views/fire, both landmarks, cargo, interaction, bounded caching/restarts and both backends. Full progression tests allow bounded visual-cache warmup, not unbounded entity growth. Test-only globals remain excluded from normal builds.
- Credits must ship with the game through `public/MODEL_CREDITS.md` and the hangar link, not just repository documentation. Catalog-only and noncommercial candidates must not silently enter `public/models/`.

## Phase 5E ownership

- `asteroid-art.ts`: six deterministic fractured/cratered archetypes, shared 1K Rocks007 maps, and twelve instanced LOD groups. World matrices are cached; distance classification/upload runs at 0.3-second intervals. All visual extents stay inside the existing sphere proxies. Low uses coarse geometry and disables normal maps. Do not restore the old static asteroid batch alongside instancing.
- `living-config.ts`: bounded environment, arrival and Tesser balance. Four installations plus six retained points of interest make ten locations. Keep old navigation indices 0–7; appended installation target IDs are 30–35. Boss IDs remain 22–28; barrels use 40–57. HUD capacity is bounded at 58; unselected barrel markers stay absent.
- `barrels.ts`: eighteen run-persistent hazards, slow seeded motion and an iterative detonation queue. Mark each barrel inactive before propagating damage. Combat owns falloff, player damage and credited kills through CombatFlow; hostile ignitions grant no player kill points. Do not include EVA characters in target arrays or blast loops.
- `living-view.ts`: shared imported turret base/head/gun geometry, original fallback, pooled runtime ownership, distance-gated four-EVA budget and red cargo visuals. Astronauts use the inspected floating clip (match the AnimTrack resource name, not generated Asset names); preserve bone hierarchy and freeze animation speed while paused. Source conversion retains skin/actions and disables source script execution.
- `tesser.ts` / `tesser-view.ts`: mobile two-phase third-boss replacement using existing lifecycle, destruction events, music and legacy third-boss record fields. Capacitors sit on exposed wing edges outside hull proxies; verify access with actual sweeps. Original Guardian geometry must not instantiate: its independently parented turret roots otherwise remain at the origin. Dreadnought and Phantom implementations remain unchanged.
- `Enemy.arrival`: active encounter occupancy with a separate three-second physical approach; targetable/fire permissions remain off until approach completes. Wave 1 waits two seconds before signatures appear. Pause freezes fixed-step timers; reset clears every arrival timer. Support ships must not deploy or fire during arrival.
- `tests/living.spec.ts` verifies both backends, two actual moving joints, real barrel shots, scene timing, pause and warmed-cache restart stability. `tests/guardian.spec.ts` now verifies actual Waves 1–16 and both Tesser phases. The dedicated test driver remains outside production. Final images and provenance live in `artifacts/phase5e/`; credits ship through `public/MODEL_CREDITS.md`.

## Public release ownership

- `npm run build:pages` explicitly sets Vite's `/Aether-Drift-2/` base; ordinary local build/dev behavior remains relative. Every lazy runtime URL must use `import.meta.env.BASE_URL`.
- `.github/workflows/pages.yml` deploys only pushes to main (or explicit manual runs) through official GitHub Pages actions. The original Aether-Drift repository remains read-only.
- `tools/verify-release.mjs` checks the built base, byte-identical required public assets, MP3 manifest and absence of the test driver. Raw source archives, `.local-tools/`, generated screenshots/reports and credentials must never be committed.
- `playwright.release.config.ts` checks the real production subpath locally; set RELEASE_URL to verify the deployed site with the same tests. Gameplay uses normal controls. Asset/boss art fixtures run afterward in the real Engine loader; they do not establish a full public boss-progression playthrough. Source progression remains covered by the separate deterministic local suite.
- Curated official asset metadata lives in docs/licenses/models. Source assets retain their individual licenses; never apply a blanket license to bundled third-party music/models.

## Player propulsion ownership

- `thruster-state.ts`: pure visual envelopes, ship-specific nozzle calibration and eight bounded RCS channels. Trust Flight.boosting (energy-aware), actual command input and Cruise.active; never infer sustained thrust solely from speed. Freeze envelopes/time during pause; reset with the ship. No flight/simulation mutations belong here.
- `player-thrusters.ts` / `thruster-shader.ts`: one shared ShaderMaterial, four shared meshes and twenty preallocated render components. Core spheres, tapered plasma shells, narrow crossed filaments and optional nozzle halos; no particle spawning, screen grabs, downloaded textures or per-frame geometry/material allocations. Shader uniforms use reused Float32Arrays. Keep native GLSL/WGSL implementations equivalent and duplicate shared WGSL declarations byte-identical: Engine 2.24 deduplicates declaration text literally.
- Keep the semantic ship root and authored model transforms intact. AE–01 has two nozzles at (±1.05,-.1,2.845). Surveyor has a centre nozzle (0,-.257,2.445) and small side nozzles (±1.373,-.148,2.615), measured from calibrated GLB geometry. MODEL_MOUNTS.surveyor.engines aliases this visual calibration; muzzle/collision/flight balance stays unchanged.
- `scene.ts` owns/disposes the renderer; main passes controls and existing flight/cruise/selection state after interpolation. Low omits filament/halo/RCS detail and uses a coarse shell, Medium adds the filament/RCS, High adds the compact halo; no camera changes. The old CombatView player boost-dot emitter was removed; its missile trails, pooled impacts and weapon effects remain owned by CombatView.
- Custom shader attribute validation uses ShaderMaterial.shaderDesc rather than reading StandardMaterial-only properties. Expand bounds for vertex displacement and apply the normal matrix under nonuniform plume scaling.
- `tests/thrusters.spec.ts` uses the separate test-only preview for real input-driven states, side-view capture, freeze/reset/switch assertions and effects-on/off frame samples. Production has no new debug globals. Do not push/deploy this visual update without explicit user instruction.

## Phase 5F-A command deck

- `menu.ts` / `command-menu.css`: approved concept composition, five actions, roster slot and actual record/version status. New styles load after legacy model UI and stay scoped to menus. Settings reuse the existing controls/listeners; credits link distributed attribution. Main menu never scrolls; secondary panels scroll internally.
- `menu-world.ts`: bounded menu-only scenery (75 shared PBR rocks, four satellite instances, four decorative patrol craft and cached Kepler). No targets, colliders or AI. It temporarily reframes the existing planet/atmosphere and restores position/rotation on launch. Disable the root and updates during gameplay; preserve gameplay atmosphere and original asteroid field.
- Satellite conversion is offline (`tools/prepare-satellite.py`), shared one-material GLB, 512 px embedded maps, no runtime decoders. Preserve the archive and source provenance in `docs/licenses/models/satellite.md`; source author/license evidence was not supplied. Review before public redistribution. Roster thumbnails are captures of actual game models, not generated artwork.
- `npm run test:menu` checks the actual production Pages subpath, both backends, seven viewport sizes, model selection, records, menu navigation, audio state hooks, gameplay handoff, pause/reset and bounded entity ownership. Inspector hooks are injected only by tests. The menu intentionally loads station/satellite; all other imported models remain demand-loaded. Landmark tests must scope lookups under Imported orbital landmarks to avoid matching menu clones.
- This local milestone is not automatically pushed or deployed. Preserve the local thruster work.

## Phase 5F-B presentation and control ownership

- `explosion-config.ts` centralizes visual-only size/style/lifetime/quality limits. `explosions.ts` owns twelve preallocated bursts sharing one 138-triangle analytic particle mesh, one native shader material and one local RGBA atlas. Invisible preset particles collapse before rasterization; uniforms reuse arrays. No per-frame textures/materials/entities. Warm under the menu; retain procedural fallback. Destroy/unload owned assets. Existing key-light warmth is bounded and quickly restored; no new punctual lights.
- Combat's optional fourth event argument is cosmetic BlastClass metadata only; keep event names, SFX, damage, death clocks, score/victory/music handling unchanged. CombatView routes explosions to the new pool and retains impact/shield/EMP/missile effects and queued secondary SFX.
- `pilot-camera.ts`: C toggles the shared interpolated 6DOF pilot attitude and calibrated AE-01/Surveyor offsets; hide only cached player mesh instances, never the simulation root. Restore visibility, near clip and chase mode on a fresh run. No physics or weapon-origin edits.
- `cockpit-ui.ts` / `cockpit.css`: lazily loaded transparent physical PNG, segmented aspect-preserving canopy/deck and live instruments/radar sourced from Combat. Keep the windshield transparent, the reticle/target indicators live and redundant chase telemetry hidden only in cockpit view. Resolve CSS mask/background URLs against document.baseURI and BASE_URL, not the stylesheet's assets directory. Source/prompt record: docs/art/phase5fb-assets.md.
- `restart-dialog.ts`: one confirmation with focus trap and input isolation; main remembers whether to resume or remain paused. R and in-run restart buttons share it. C is camera; N/V and player-triggered travel are retired. Retain Cruise/Frontier services for internal dependencies and simulation fixtures, with no obsolete player prompts.
- `npm run test:cinematic` uses the separate test driver for real input/laser kills, turret/barrel damage, pooled presets, both ships/cameras, pause/death/reset, responsive artwork and software-only frame samples. Boss destruction fixtures seed death state and run the original clocks; do not present these as a full Wave 1–15 playthrough. Production URL checks live in cinematic-pages.spec.ts. Keep test globals out of ordinary builds and never deploy without instruction.
