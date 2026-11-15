# Aether Drift 2.0

A single-player 3D arcade space combat game: fly freely in six degrees of freedom, fight coordinated enemy waves, and explore the Perseid Expanse.

**[Play Aether Drift 2.0](https://esteves7771.github.io/Aether-Drift-2/)** · [Source](https://github.com/esteves7771/Aether-Drift-2)

First public milestone: **v0.5e-public**, including work through Phase 5E. This is a separate project inspired by [the original Aether Drift](https://github.com/esteves7771/Aether-Drift); its original repository is unchanged.

## Features

- Responsive inertial 6DOF flight, boost, braking, cruise, flight assistance and a smooth third-person chase camera.
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
| Q / E              | Roll                                  |
| Shift              | Boost                                 |
| X                  | Brake                                 |
| Left click / Space | Fire dual cannons                     |
| Right click        | Soft target selection                 |
| M                  | Guided missile                        |
| G                  | EMP                                   |
| C                  | Toggle cruise                         |
| N                  | Cycle navigation destination          |
| V                  | Investigate nearby location           |
| R                  | Restart patrol                        |
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

- [Model/material credits](public/MODEL_CREDITS.md): exact sources, creators, asset-specific terms and modifications; linked from the hangar and distributed with the game.
- [Music credits](MUSIC_CREDITS.md): creators, original download names, Pixabay source URLs, license and edited death-cue provenance. Music may be used in this game under its listed terms; do not redistribute it as a standalone music collection.
- [Asset development record](ASSET_CREDITS.md) and [preserved official model metadata](docs/licenses/models/).
- NASA imagery/models follow NASA's stated usage guidance; no NASA endorsement is implied.
- Third-party assets retain their respective licenses. This repository does not grant a blanket license over every bundled asset or music track.

Raw asset archives, Blender/FBX conversion inputs, downloaded tool binaries, dependencies, generated builds and local screenshot/report artifacts are intentionally excluded from Git. All ten production GLBs, required textures and supplied soundtrack files are included. Original local asset sources remain untouched. Offline conversion tools require separately obtained original sources and Blender/FFmpeg; they are not needed to build or play the released game.
