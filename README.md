# Aether Drift 2.0

A single-player 3D arcade space combat game: fly freely in six degrees of freedom, fight coordinated enemy waves, and explore the Perseid Expanse.

**[Play Aether Drift 2.0](https://esteves7771.github.io/Aether-Drift-2/)** · [Source](https://github.com/esteves7771/Aether-Drift-2)

Public release: **v0.5f-public**, including Phase 5F-A, Phase 5F-B and the cinematic thruster overhaul. This is a separate project inspired by [the original Aether Drift](https://github.com/esteves7771/Aether-Drift); its original repository is unchanged.

## Features

- Responsive inertial 6DOF flight, boost, braking, flight assistance and chase / first-person cockpit cameras.
- Dual lasers, guided missiles, EMP, shields, coordinated enemy classes and limited alien encounters.
- Escalating waves with Dreadnought at Wave 5, Phantom at Wave 10 and two-phase Tesser at Wave 15; harder waves continue afterward.
- Combat Flow scoring, optional challenges, run upgrades, local records and a debrief.
- Default fighter and optional Surveyor with shared flight and weapon balance.
- Cratered PBR asteroids, distance LOD, varied defense installations, explosive cargo chains, ISS/Kepler landmarks and animated EVA crews.
- Physical formation arrivals, pooled combat effects, Low/Medium/High graphics presets and a dynamic licensed soundtrack.

## Controls

| Input              | Action                                |
| ------------------ | ------------------------------------- |
| W / S              | Forward / reverse thrust              |
| A / D              | Strafe                                |
| F / Ctrl           | Rise / descend                        |
| Mouse / arrow keys | Pitch / yaw                           |
| Space | Evasive roll (A / D direction, 5s cooldown) |
| Q / E              | Roll                                  |
| Shift              | Boost                                 |
| X                  | Brake                                 |
| Left click / Z | Fire dual cannons                     |
| Right click        | Soft target selection                 |
| M                  | Guided missile                        |
| G                  | EMP                                   |
| C                  | Toggle chase / cockpit camera         |
| R                  | Confirm restart patrol                |
| Esc                | Pause / resume, release mouse capture |

Click the viewport for mouse capture; arrow-key steering also works. Audio starts after user interaction. Settings include independent Master/Music/SFX volume, sensitivity, camera distance, flight assistance and graphics presets. Settings and personal records are stored in this browser; clearing site data removes them. Switching tabs pauses gameplay.

## Technology and requirements

PlayCanvas Engine (standalone npm), strict TypeScript, Vite, HTML/CSS, Vitest and Playwright. WebGPU is preferred, with WebGL2 fallback; append `?webgl` to force WebGL2. Use a current desktop browser with keyboard/mouse and hardware acceleration. No backend, PlayCanvas Editor account, paid API or remote runtime asset service is required.

Medium is the default graphics preset. Use Low on slower hardware. A reliable hardware 60 FPS baseline has not been established; detailed EVA scenes and chain explosions can be expensive. First-use model/shader loading can hitch. The optional EVA model is approximately 10.3 MiB and loads near stations. Collision geometry is deliberately simpler than the visible models. This is an evolving arcade prototype, not a finished commercial game.

## Develop locally

Node.js **24 LTS** is recommended (minimum 22.23.2), with npm:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. The existing Windows `Start-Game.ps1` launcher is also retained. Local development uses relative asset URLs.

```sh
npm run typecheck
npm test
npm run lint
npm run build
npm run preview
```

Browser checks:

```sh
npx playwright install chromium
npm run test:release
npm run test:living
```

`test:release` builds and checks the game at the actual `/Aether-Drift-2/` subpath. `test:living` uses a separate test-only build for deterministic progression and environmental checks; that driver is excluded from production. Existing inspection skills remain in `.agents/skills` and `.claude/skills`.

## GitHub Pages

Pushes to `main` trigger [.github/workflows/pages.yml](.github/workflows/pages.yml). GitHub Actions installs dependencies with `npm ci`, checks types/assets, builds, and deploys `dist/` through the official Pages actions. The repository's Pages source must be **GitHub Actions**.

```sh
npm run build:pages
```

The release build explicitly uses `/Aether-Drift-2/`; normal `npm run build` and localhost behavior stay relative. A static HTTP server is required; direct `file://` launch is unsupported for ES modules. No server-side application or credentials are included in the game.

## Credits and licensing

- [Model/material credits](public/MODEL_CREDITS.md): exact sources, creators, asset-specific terms and modifications; linked from Credits and distributed with the game.
- [Music credits](MUSIC_CREDITS.md): creators, original download names, Pixabay source URLs, license and edited death-cue provenance. Music may be used in this game under its listed terms; do not redistribute it as a standalone music collection.
- [Asset development record](ASSET_CREDITS.md) and [preserved official model metadata](docs/licenses/models/).
- NASA imagery/models follow NASA's stated usage guidance; no NASA endorsement is implied.
- Third-party assets retain their respective licenses. This repository does not grant a blanket license over every bundled asset or music track.

Raw asset archives, Blender/FBX conversion inputs, downloaded tool binaries, dependencies, generated builds and local screenshot/report artifacts are intentionally excluded from Git. Required assets for the existing public features, textures and supplied soundtrack files remain included. New Phase 5H PTAH and Space Voyage assets remain local-only. Original local asset sources remain untouched. Offline conversion tools require separately obtained original sources and Blender/FFmpeg; they are not needed to build or play the released game.

## Player propulsion visuals

The thruster overhaul uses a shared native GLSL/WGSL material with tapered 3D plasma shells, soft crossed filaments, hot cores and a High-only nozzle halo. It reacts to actual thrust, boost energy state, cruise, braking, strafe, vertical movement and roll. Coasting alone does not sustain a full plume. The original fighter uses two engines; Surveyor uses its measured central engine plus two smaller outboard nozzles. Existing flight, chase camera, weapons, AI and audio are unchanged. The old hardcoded player wake dots were replaced; missile trails remain.

`npm run test:thrusters` exercises both ships, all states, presets, pause/reset, repeated selection and real combat on WebGPU/WebGL2. Local captures and measurements are written under the ignored `artifacts/thrusters/` directory. Included in v0.5f-public.

## Command deck update (Phase 5F-A)

The approved menu composition uses a live selected-ship preview, five command actions, real-model roster thumbnails and real persisted records/version in the bottom status strip. Four shared satellite instances, Kepler, bounded traffic and PBR asteroids form menu-only scenery. They stop when the patrol launches; the gameplay world and cinematic thrusters are preserved. Settings, Records and Credits remain functional. Included in v0.5f-public.

Run `npm run test:menu` for focused production-subpath browser checks and screenshots at 1920×1080, 1366×768 and 1280×720 (plus layout checks at four additional sizes). Source/licensing limitations for the supplied satellite are recorded in `docs/licenses/models/satellite.md`. The source archive remains untouched.

## Cinematic update (Phase 5F-B)

Press **C** or the compact camera HUD button to switch chase/cockpit view. The shared transparent cockpit artwork has live hull/shield, speed/boost, selected target, missiles, EMP and nearby contacts. **R** and in-game restart buttons now pause for confirmation; Cancel/Escape restore the previous active/paused state. The old C-cruise, N-destination and V-investigate shortcuts are removed. Space locations, installations, hazards and internal exploration services remain.

Explosions use bounded layered fire, physical directional sparks and fragments, short warm lighting responses and per-class presets. Boss death sequencing, weapons, flight balance, scoring, audio, the new main menu and plasma thrusters are preserved. Low reduces overdraw/particles; OS reduced-motion preferences reduce intensity/counts. `npm run test:cinematic` runs focused WebGPU/WebGL2 checks. Artwork preparation and prompts are recorded in [docs/art/phase5fb-assets.md](docs/art/phase5fb-assets.md). Included in v0.5f-public.

## v0.5g — Combat evolution

Phase 5G adds proportional cockpit framing and safe menu layering, the imported Wave 5 artillery dreadnought, shared gravitational-rift arrivals, three-phase Phantom and Tesser encounters, telegraphed 3D weapon patterns, tactical enemy roles and a quota-based reinforcement director. Both existing player ships, flight physics, audio, exploration, graphics presets and records remain supported.

Ordinary wave quotas progress through 3 / 5 / 7 / 9 / 12 / 15 / 18+, with bounded active populations and the established boss rotation every fifth wave. Human difficulty tuning remains a first pass. Source asset provenance is retained in public/MODEL_CREDITS.md and docs/licenses/models; the supplied dreadnought archive has no original author or license evidence.

Focused browser suites: `npm run test:boss-foundation` and `npm run test:combat-evolution`. Production Pages verification uses `npm run test:release`; set RELEASE_URL for the deployed URL. Debug encounter instrumentation is never shipped.

## Phase 5H local prototype

Three selectable hulls now have data-driven handling, shield and primary-weapon profiles: balanced AE-01 precision lasers, tougher Surveyor sustained cannons and agile PTAH burst plasma. Left mouse or Z fires; Space performs a lateral evasive roll with a five-second cooldown. A/D chooses its side; Q/E remains manual roll. There is no invulnerability. Missiles remain M and EMP remains G.

On the start menu, drag the preview to rotate, wheel to zoom and double-click to reset. Only the displayed ship moves. Noncombat Space Voyage convoys follow bounded world-space corridors; sparse animated EVA characters have no procedural tethers.

Run npm run test:voyage for focused dual-renderer verification. PTAH and Space Voyage assets are intentionally local and ignored; source/license records are under docs/licenses/models. Public Pages builds filter out PTAH, its thumbnail and Space Voyage and fail if those files enter the output. Do not publish this prototype without resolving those asset rights. Ordinary npm run build works locally.

## v0.5h public release scope

The public release includes AE-01 and Surveyor handling/weapon identities, real lateral Space evasion, left mouse/Z primary fire, the interactive garage, untethered menu/gameplay EVA and all existing bosses/combat/audio. The local PTAH thumbnail is now a tightly framed transparent actual-model render.

PTAH (including its artwork) and Space Voyage convoys are excluded from public distribution because their redistribution rights remain unresolved. They remain fully available in local builds. This is intentionally a reduced public release, not the complete three-ship/convoy build. The public roster has two ships with no paging arrows; a persisted local PTAH preference safely falls back to AE-01.

Use npm run build:pages for the filtered public mode and npm run release:verify for byte-identical permitted assets and exclusion checks. Normal npm run build/dev retain local models when present. The distribution gate stays closed to those assets; do not remove it based only on a free-download or CC0 claim.
