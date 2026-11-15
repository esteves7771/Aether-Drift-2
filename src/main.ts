import {
    AnimComponentSystem,
    AnimClipHandler,
    AppBase,
    AppOptions,
    BatchManager,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    LAYERID_SKYBOX,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    TextureHandler,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { Atmosphere } from './atmosphere';
import { EngineAudio } from './audio';
import { ChaseCamera } from './camera';
import { CockpitHUD } from './cockpit-ui';
import { Collisions, field } from './collisions';
import { Combat } from './combat';
import { CombatHUD } from './combat-ui';
import { CombatView } from './combat-view';
import { FLIGHT, loadSettings } from './config';
import { Cruise } from './cruise';
import { Flight } from './flight';
import { FlightFeel } from './flight-feel';
import { FRONTIER } from './frontier-config';
import { FrontierView } from './frontier-view';
import { Graphics } from './graphics';
import { ImportedFleet } from './imported-fleet';
import { ImportedLandmarks } from './imported-landmarks';
import { Input } from './input';
import { LivingView } from './living-view';
import { Menu } from './menu';
import { MenuWorld } from './menu-world';
import { ModelLibrary } from './model-library';
import { MusicManager, loadMusicAssets } from './music';
import { PilotCamera } from './pilot-camera';
import { Records } from './records';
import { RestartDialog } from './restart-dialog';
import { buildScene } from './scene';
import { ShipHangar } from './ship-hangar';
import { UI } from './ui';
import { UniverseView } from './universe-view';
import { UpgradeUI } from './upgrade-ui';
import './style.css';
import './menu.css';
import './frontier.css';
import './model-ui.css';
import './command-menu.css';
import './cockpit.css';
const canvas = document.getElementById('application-canvas') as HTMLCanvasElement;
try {
    const device = await createGraphicsDevice(canvas, {
        antialias: false,
        deviceTypes: new URLSearchParams(location.search).has('webgl') ? ['webgl2'] : ['webgpu', 'webgl2']
    });
    device.maxPixelRatio = Math.min(window.devicePixelRatio, 1.75);
    const options = new AppOptions();
    options.graphicsDevice = device;
    options.componentSystems = [
        RenderComponentSystem,
        CameraComponentSystem,
        LightComponentSystem,
        AnimComponentSystem
    ];
    options.resourceHandlers = [TextureHandler, ContainerHandler, AnimClipHandler];
    options.batchManager = BatchManager;
    const app = new AppBase(canvas);
    app.init(options);
    app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(RESOLUTION_AUTO);
    const resize = () => graphics.resize();
    window.addEventListener('resize', resize);
    const settings = loadSettings(),
        flight = new Flight(),
        rocks = field(),
        collisions = new Collisions(),
        scene = buildScene(app, rocks),
        audio = new EngineAudio();
    const music = new MusicManager(await loadMusicAssets());
    music.setVolumes(settings.masterVolume, settings.musicVolume);
    audio.setVolume(settings.masterVolume * settings.sfxVolume);
    const soundOffset = new Vec3();
    const combat = new Combat(
        flight,
        rocks,
        (event, point, size, blast) => {
            combatView.event(event, point, size, blast);
            audio.combat(event, 1, soundOffset.sub2(point, flight.position).length());
        },
        (name) => app.fire(name)
    );
    const combatView = new CombatView(app, scene.ship, scene.art, scene.textures.glow, combat.dreadnought, (point) => {
        if (active) audio.combat('missile-impact', 1, soundOffset.sub2(point, flight.position).length());
    });
    const feel = new FlightFeel();
    const cruise = new Cruise();
    const frontierView = new FrontierView(app, combat.frontier);
    const modelLibrary = new ModelLibrary(app);
    combatView.setBossLibrary(modelLibrary);
    const menuWorld = new MenuWorld(app, modelLibrary, scene);
    const importedFleet = new ImportedFleet(modelLibrary, combatView.enemyVisualRoots, device);
    combatView.importedFleet = importedFleet;
    const landmarks = new ImportedLandmarks(app, modelLibrary, combat.frontier);
    const living = new LivingView(app, modelLibrary, combat, frontierView);
    const atmosphere = new Atmosphere(app);
    const universe = new UniverseView(app, modelLibrary, combat, scene.art);
    const camera = new Entity('Chase camera');
    camera.addComponent('camera', {
        clearColor: new Color(0.018, 0.022, 0.055),
        fov: 65,
        nearClip: 0.2,
        farClip: 10000
    });
    app.root.addChild(camera);
    // The lighting atlas is for reflections; the procedural nebula owns the background.
    camera.camera!.layers = [...camera.camera!.layers.filter((id) => id !== LAYERID_SKYBOX), scene.cinematic.layer.id];
    const graphics = new Graphics(app, camera.camera!, (level) => {
        scene.setQuality(level);
        atmosphere.setQuality(level);
        combatView.setQuality(level);
        frontierView.setQuality(level);
        modelLibrary.setQuality(level);
        landmarks.setQuality(level);
        living.setQuality(level);
        universe.setQuality(level);
        menuWorld.setQuality(level);
    });
    graphics.apply(settings.graphics);
    const pilotCamera = new PilotCamera();
    const chase = new ChaseCamera(camera),
        position = new Vec3(),
        rotation = new Quat();
    const records = new Records();
    let runSaved = false;
    let active = false,
        started = false,
        accumulator = 0,
        fps = 60,
        uiTime = 0;
    let soundtrackBoss = false,
        pageFocused = document.hasFocus();
    const pause = () => {
        if (!active) return;
        active = false;
        accumulator = 0;
        input.clear();
        cruise.cancel('CRUISE DISENGAGED / PAUSED');
        if (document.pointerLockElement) document.exitPointerLock();
        ui.update(flight, fps, app.stats.drawCallCount, device.deviceType);
        combatHUD.update(combat, camera, combatView.activeEffects);
        menus.menu(true);
        audio.update(0, false, false, settings.volume);
        audio.silence();
        music.setPaused(true);
    };
    const launch = () => {
        if (combat.upgrades.pending) return;
        if (!started) {
            pilotCamera.reset();
            chase.reset();
            feel.reset();
        }
        if (flight.hull <= 0) {
            flight.reset();
            scene.thrusters.reset();
            cruise.reset();
            combat.reset();
            universe.reset();
            combatView.reset();
            chase.reset();
            soundtrackBoss = false;
            runSaved = false;
        }
        active = true;
        started = true;
        input.clear();
        accumulator = 0;
        menus.menu(false);
        audio.start();
        music.setState(soundtrackBoss ? 'boss' : 'combat');
        music.setPaused(document.hidden || !pageFocused);
        music.unlock();
        canvas.focus();
    };
    const reset = () => {
        pilotCamera.reset();
        if (started && !runSaved && combat.duration > 0) records.save(combat.summary('retired'));
        runSaved = false;
        audio.silence();
        soundtrackBoss = false;
        music.setState(started ? 'combat' : 'menu');
        music.setPaused(document.hidden || !pageFocused);
        music.unlock();
        flight.reset();
        scene.thrusters.reset();
        cruise.reset();
        feel.reset();
        combat.reset();
        universe.reset();
        upgradeUI.reset();
        combatView.reset();
        chase.reset();
        accumulator = 0;
        input.clear();
        scene.ship.setPosition(flight.position);
        scene.ship.setRotation(flight.rotation);
        if (started) launch();
    };
    const restartDialog = new RestartDialog();
    const requestRestart = () => {
        if (!started || flight.hull <= 0 || combat.upgrades.pending || restartDialog.open) return;
        const resume = active;
        pause();
        input.clear();
        restartDialog.show(reset, () => {
            input.clear();
            if (resume && pageFocused && !document.hidden) launch();
        });
    };
    const ui = new UI(settings, launch, requestRestart, pause);
    const finish = (ended: 'lost' | 'retired') => {
        if (runSaved) return;
        runSaved = true;
        const run = combat.summary(ended);
        menus.debrief(run, records.save(run));
    };
    const mainMenu = () => {
        if (menus.screen === 'pause') {
            finish('retired');
            music.setState('menu');
            music.setPaused(document.hidden || !pageFocused);
            music.unlock();
            return;
        }
        active = started = runSaved = soundtrackBoss = false;
        accumulator = 0;
        input.clear();
        flight.reset();
        pilotCamera.reset();
        scene.thrusters.reset();
        cruise.reset();
        combat.reset();
        universe.reset();
        upgradeUI.reset();
        combatView.reset();
        chase.reset();
        audio.silence();
        menus.home();
        music.setState('menu');
        music.setPaused(document.hidden || !pageFocused);
        music.unlock();
    };
    const menus = new Menu(settings, records, mainMenu, reset);
    const hangar = new ShipHangar(modelLibrary, scene.ship);
    const combatHUD = new CombatHUD();
    const cockpitHUD = new CockpitHUD(() => {
        if (active) {
            pilotCamera.toggle();
        }
    });
    const chooseUpgrade = (index: number) => {
        if (!combat.chooseUpgrade(index)) return;
        upgradeUI.update(combat.upgrades);
        launch();
    };
    const upgradeUI = new UpgradeUI(combat.upgrades, chooseUpgrade);
    const input = new Input(
        canvas,
        settings,
        () => {
            if (combat.upgrades.pending) return;
            if (active) pause();
            else if (started && menus.screen === 'pause') launch();
        },
        () => {
            requestRestart();
        }
    );
    canvas.tabIndex = 0;
    const blur = () => {
        pageFocused = false;
        pause();
        music.setPaused(true);
    };
    const focus = () => {
        pageFocused = true;
        if (!started || flight.hull <= 0 || menus.screen === 'debrief') music.setPaused(document.hidden);
    };
    const gesture = (event: Event) => {
        if (event.target instanceof Element && event.target.closest('#launch, #restart')) return;
        music.unlock();
    };
    window.addEventListener('pointerdown', gesture, true);
    window.addEventListener('keydown', gesture, true);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    const visibility = () => {
        if (document.hidden) blur();
        else if (document.hasFocus()) focus();
    };
    document.addEventListener('visibilitychange', visibility);
    const unlock = () => {
        if (!document.pointerLockElement && active) pause();
    };
    document.addEventListener('pointerlockchange', unlock);
    const bossArrival = () => {
        if (started && flight.hull > 0) {
            soundtrackBoss = true;
            music.setState('boss');
        }
    };
    const bossVictory = () => {
        if (started && flight.hull > 0) {
            soundtrackBoss = false;
            music.setState('combat');
        }
    };
    const cruiseBlocked = () =>
        combat.boss.active ||
        combat.boss.dying > 0 ||
        combat.frontier.threatening(flight) ||
        combat.enemies.some((e) => e.active && e.position.distance(flight.position) < FRONTIER.cruise.lockRange) ||
        combat.projectiles.items.some((p) => p.active && p.hostile && p.position.distance(flight.position) < 220);
    // Gameplay director owns boss encounter lifecycle.
    app.on('boss:spawn', bossArrival);
    app.on('boss:defeated', bossVictory);
    app.on('update', (dt: number) => {
        audio.setVolume(settings.masterVolume * settings.sfxVolume);
        music.setVolumes(settings.masterVolume, settings.musicVolume);
        graphics.apply(settings.graphics);
        combat.challengesEnabled = settings.challenges;
        fps += (1 / Math.max(dt, 0.001) - fps) * 0.03;
        if (active) {
            accumulator += Math.min(dt, 0.1);
            // Consume mouse deltas only when a simulation step will run.
            const command =
                accumulator >= FLIGHT.step
                    ? input.sample(Math.floor(accumulator / FLIGHT.step) * FLIGHT.step)
                    : input.command;
            if (accumulator >= FLIGHT.step) {
                if (input.consumeCamera()) pilotCamera.toggle();
                if (input.consumeTarget()) combat.selectTarget(true);
                if (input.consumeMissile()) {
                    cruise.cancel('WEAPONS / DECELERATING');
                    combat.launchMissile();
                }
                if (input.consumeEMP()) {
                    cruise.cancel('SYSTEMS / DECELERATING');
                    combat.emp();
                }
            }
            while (accumulator >= FLIGHT.step) {
                cruise.step(flight, command, FLIGHT.step, settings.assist, cruiseBlocked(), input.firing, rocks);
                collisions.solve(flight, rocks);
                collisions.solve(flight, combat.frontier.solids);
                combat.step(FLIGHT.step, input.firing);
                accumulator -= FLIGHT.step;
                if (combat.upgrades.pending) {
                    active = false;
                    accumulator = 0;
                    input.clear();
                    cruise.cancel('FIELD REFIT / CRUISE OFFLINE');
                    if (document.pointerLockElement) document.exitPointerLock();
                    audio.silence();
                    music.setPaused(true);
                    upgradeUI.update(combat.upgrades);
                    break;
                }
            }
            if (flight.hull <= 0) {
                pause();
                finish('lost');
                music.setState('death');
                music.setPaused(document.hidden || !pageFocused);
            }
        }
        const presentationDt = active || !started ? Math.min(dt, 0.1) : 0;
        feel.update(
            flight.velocity.length(),
            flight.boosting,
            active,
            settings.cameraEffects,
            settings.graphics,
            presentationDt
        );
        camera.camera!.fov +=
            ((cruise.active && settings.cameraEffects ? FRONTIER.cruise.fov : feel.fov) - camera.camera!.fov) *
            (1 - Math.exp(-3 * presentationDt));
        const alpha = active ? accumulator / FLIGHT.step : 1;
        position.lerp(flight.previous, flight.position, alpha);
        rotation.slerp(flight.previousRotation, flight.rotation, alpha);
        if (!started && menus.homeVisible) {
            menuWorld.update(true, dt, camera, hangar.selected);
        } else {
            menuWorld.update(false, 0, camera);
            scene.ship.setPosition(position);
            scene.ship.setRotation(rotation);
            chase.update(
                position,
                rotation,
                settings.distance + feel.pullback,
                presentationDt,
                active ? combat.shake : 0,
                active && (cruise.active || cruise.settling) ? flight.velocity : undefined
            );
        }
        pilotCamera.update(
            camera,
            scene.ship,
            position,
            rotation,
            hangar.selected,
            started && menus.screen !== 'debrief'
        );
        combatView.render(combat, alpha, active || menus.screen === 'debrief' ? Math.min(dt, 0.1) : 0, camera);
        frontierView.render(
            flight,
            cruise,
            camera,
            started && menus.screen !== 'debrief',
            active ? Math.min(dt, 0.1) : 0
        );
        landmarks.render(flight, started);
        living.render(started, active ? Math.min(dt, 0.1) : 0, alpha);
        universe.render(started, active ? Math.min(dt, 0.1) : 0, position, camera);
        scene.asteroidField.update(position, Math.min(dt, 0.1));
        scene.stars.setPosition(camera.getPosition());
        scene.environment.setPosition(camera.getPosition());
        atmosphere.update(
            active || !started ? Math.min(dt, 0.1) : 0,
            position,
            camera,
            active ? flight.velocity.length() : 0,
            flight.boosting || cruise.active,
            settings.cameraEffects
        );
        atmosphere.root.enabled = started;
        scene.thrusters.update(
            flight,
            input.command,
            cruise.active,
            active,
            started,
            hangar.selected,
            Math.min(dt, 0.1)
        );
        cockpitHUD.present(pilotCamera.cockpit, started && menus.screen !== 'debrief', active);
        audio.update(
            Math.min(230, flight.velocity.length()),
            flight.boosting || cruise.active,
            active,
            1,
            feel.acceleration
        );
        music.update(dt);
        uiTime += dt;
        if (uiTime > 0.08) {
            ui.update(flight, fps, app.stats.drawCallCount, device.deviceType);
            combatHUD.update(combat, camera, combatView.activeEffects);
            cockpitHUD.update(combat, combatView.explosions.warmth);
            const musicStatus = document.getElementById('music-status')!;
            musicStatus.dataset.state = music.currentState;
            musicStatus.dataset.status = music.status;
            const message =
                music.status === 'missing'
                    ? 'Music unavailable — add the licensed tracks and prepare the death cue.'
                    : music.status === 'locked' || music.status === 'blocked'
                      ? 'Click or press a key to enable music.'
                      : `Music: ${music.currentState} · ${music.status}`;
            if (musicStatus.textContent !== message) musicStatus.textContent = message;
            uiTime = 0;
        }
    });
    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
        window.removeEventListener('blur', blur);
        window.removeEventListener('focus', focus);
        window.removeEventListener('pointerdown', gesture, true);
        window.removeEventListener('keydown', gesture, true);
        app.off('boss:spawn', bossArrival);
        app.off('boss:defeated', bossVictory);
        document.removeEventListener('visibilitychange', visibility);
        document.removeEventListener('pointerlockchange', unlock);
        audio.destroy();
        music.destroy();
        input.destroy();
        menus.destroy();
        upgradeUI.destroy();
        hangar.destroy();
        pilotCamera.destroy();
        cockpitHUD.destroy();
        restartDialog.destroy();
        menuWorld.destroy();
        universe.destroy();
        living.destroy();
        importedFleet.destroy();
        landmarks.destroy();
        modelLibrary.destroy();
        combatView.destroy();
        frontierView.destroy();
        atmosphere.destroy();
        graphics.destroy();
        scene.destroy();
    });
    chase.update(position, rotation, settings.distance, 1);
    app.start();
} catch (error) {
    console.error(error);
    const message = document.createElement('main');
    message.className = 'error';
    message.textContent = 'Unable to start 3D flight. Enable hardware acceleration and use WebGPU or WebGL2.';
    document.body.append(message);
}
