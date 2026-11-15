import { Vec3 } from 'playcanvas';

import { ARCADE } from './arcade-config';
import { Artillery } from './artillery';
import { Barrel, Barrels } from './barrels';
import { BossPart } from './boss';
import { BOSS_PATTERNS } from './boss-pattern-config';
import type { Rock } from './collisions';
import { COMBAT } from './combat-config';
import type { CombatEvent } from './combat-config';
import { CombatFlow } from './combat-flow';
import type { CombatTarget } from './combat-target';
import { Enemy } from './enemy';
import { EnemyAI } from './enemy-ai';
import { EnemyPatterns } from './enemy-patterns';
import { EVOLUTION } from './evolution-config';
import type { BlastClass } from './explosion-config';
import { Fleet } from './fleet';
import { FLEET } from './fleet-config';
import type { Flight } from './flight';
import { Frontier, InstallationPart } from './frontier';
import { Guardian } from './guardian';
import { bossForWave, GUARDIAN } from './guardian-config';
import { LIVING } from './living-config';
import { Missiles } from './missiles';
import { Phantom } from './phantom';
import { Projectiles, sweptHit } from './projectiles';
import type { RunSummary } from './records';
import { RunUpgrades } from './run-upgrades';
import { SPECTACLE } from './spectacle-config';
import { Squadron } from './squadron';
import { Targeting } from './targeting';
import { TARGETING } from './targeting-config';
import { Tesser } from './tesser';
import { waveHealth, waveTier } from './threat-config';
import { WaveChallenge } from './wave-challenge';
import { WaveDirector } from './wave-director';
export type EmitCombat = (event: CombatEvent, position: Vec3, size: number, blast?: BlastClass) => void;
export class Combat {
    readonly enemies = Array.from({ length: COMBAT.enemyCapacity }, (_, i) => new Enemy(i));
    readonly projectiles = new Projectiles();
    readonly damageSource = new Vec3();
    readonly dreadnought = new Artillery();
    readonly enemyPatterns = new EnemyPatterns();
    readonly phantom = new Phantom();
    readonly guardian = new Tesser();
    get boss(): Artillery | Phantom | Tesser {
        const kind = bossForWave(this.wave);
        return kind === 'guardian' ? this.guardian : kind === 'phantom' ? this.phantom : this.dreadnought;
    }
    bestGuardianTime: number | null = null;
    guardianBosses = 0;
    bestPhantomTime: number | null = null;
    phantomBosses = 0;
    readonly missiles = new Missiles();
    readonly fleet = new Fleet();
    readonly director = new WaveDirector();
    readonly targets: CombatTarget[] = [...this.enemies, ...this.dreadnought.parts, ...this.phantom.parts];
    readonly squadron = new Squadron();
    readonly upgrades = new RunUpgrades();
    get ammoCapacity() {
        return EVOLUTION.missile.maxAmmo + this.upgrades.get('missile');
    }
    chooseUpgrade(index: number) {
        const before = this.ammoCapacity;
        if (!this.upgrades.choose(index)) return false;
        this.ammo = Math.min(this.ammoCapacity, this.ammo + this.ammoCapacity - before);
        this.ship.boostEfficiency = 1 - this.upgrades.get('boost');
        return true;
    }
    readonly frontier: Frontier;
    readonly barrels: Barrels;
    ammo: number = EVOLUTION.missile.starting;
    missileCooldown = 0;
    empCooldown = 0;
    empPulse = 0;
    victory = 0;
    bossReward = 0;
    get wave() {
        return this.director.wave;
    }
    get countdown() {
        return this.director.countdown;
    }
    set countdown(value: number) {
        this.director.countdown = value;
    }
    readonly getTarget = (id: number) => this.targets.find((t) => t.id === id);
    readonly flow = new CombatFlow();
    readonly challenge = new WaveChallenge();
    challengesEnabled = true;
    duration = 0;
    clearedWaves = 0;
    challengesWon = 0;
    bosses = 0;
    bestBossTime: number | null = null;
    private lastHull = 100;
    get score() {
        return this.flow.score;
    }
    summary(ended: RunSummary['ended']): RunSummary {
        return {
            score: this.score,
            wave: this.wave,
            cleared: this.clearedWaves,
            kills: this.kills,
            shots: this.flow.shots,
            hits: this.flow.hits,
            combo: this.flow.longest,
            bossTime: this.bestBossTime,
            bosses: this.bosses,
            duration: this.duration,
            challenges: this.challengesWon,
            phantomTime: this.bestPhantomTime,
            phantomBosses: this.phantomBosses,
            guardianTime: this.bestGuardianTime,
            guardianBosses: this.guardianBosses,
            discoveries: this.frontier.discoveries,
            upgrades: this.upgrades.selections,
            ended
        };
    }
    observeHull() {
        if (this.ship.hull < this.lastHull) this.flow.damage(true);
        this.lastHull = this.ship.hull;
    }
    kills = 0;

    selected = -1;
    cooldown = 0;
    damageFlash = 0;
    shieldHit = false;
    shake = 0;
    muzzle = 0;
    playerHits = 0;
    enemyHits = 0;
    rockHits = 0;
    private shieldDelay = 0;
    spawnObstacles: readonly Rock[] = [];
    private readonly ai = new EnemyAI();
    private readonly forward = new Vec3();
    private readonly delta = new Vec3();
    private readonly muzzlePosition = new Vec3();
    private readonly direction = new Vec3();
    private readonly target = new Vec3();
    readonly targeting: Targeting;
    private targetingWave = 0;
    readonly ship: Flight;
    readonly rocks: Rock[];
    private readonly emit: EmitCombat;
    private readonly event: (name: string) => void;
    constructor(ship: Flight, rocks: Rock[], emit: EmitCombat, event: (name: string) => void = () => undefined) {
        this.ship = ship;
        this.rocks = rocks;
        this.targeting = new Targeting(ship, rocks);
        this.emit = emit;
        this.event = event;
        this.frontier = new Frontier(rocks);
        this.barrels = new Barrels(this.frontier);
        this.targets.push(...this.barrels.items);
        this.targets.push(...this.frontier.targets);
        this.targets.push(...this.guardian.parts);
    }
    get remaining() {
        let n = this.boss.active || this.boss.dying > 0 ? 1 : 0;
        for (const e of this.enemies) if (e.active) n++;
        return n;
    }
    reset() {
        this.targeting.reset();
        this.targetingWave = 0;
        for (const e of this.enemies) {
            e.active = false;
            e.arrival = 0;
            e.arrivalGoal.set(0, 0, 0);
        }
        this.projectiles.reset();
        this.fleet.reset();
        this.frontier.reset();
        this.barrels.reset();
        this.upgrades.reset();
        this.ship.boostEfficiency = 1;
        this.director.reset();
        this.dreadnought.reset();
        this.phantom.reset();
        this.enemyPatterns.reset();
        this.guardian.reset();
        this.bestGuardianTime = null;
        this.guardianBosses = 0;
        this.bestPhantomTime = null;
        this.phantomBosses = 0;
        this.missiles.reset();
        this.squadron.reset();
        this.ammo = EVOLUTION.missile.starting;
        this.missileCooldown = this.empCooldown = this.empPulse = this.victory = this.bossReward = 0;
        this.flow.reset();
        this.challenge.reset();
        this.duration = this.clearedWaves = this.challengesWon = this.bosses = 0;
        this.bestBossTime = null;
        this.lastHull = this.ship.hull;
        this.kills =
            this.cooldown =
            this.damageFlash =
            this.shake =
            this.muzzle =
            this.playerHits =
            this.enemyHits =
            this.rockHits =
            this.shieldDelay =
                0;
        this.countdown = LIVING.arrival - LIVING.approach;
        this.selected = -1;
    }
    selectTarget(manual = false) {
        this.selected = this.targeting.select(this.targets, manual);
    }
    private spawnWave() {
        if (this.director.group === 1) this.squadron.reset();
        const count = this.director.size;
        let spawned = 0;
        for (let i = 0; i < count; i++) {
            const e = this.enemies.find((e) => !e.active);
            if (!e) break;
            let safe = false;
            for (let attempt = 0; attempt < 64; attempt++) {
                const angle = i * 2.4 + attempt * 1.7,
                    spread = 28 + i * 13 + attempt * 8;
                this.ship.rotation
                    .transformVector(
                        this.delta.set(
                            this.director.encounter?.name === 'PINCER ATTACK'
                                ? (i % 2 ? 1 : -1) * (150 + i * 15 + attempt * 8)
                                : Math.cos(angle) * spread,
                            Math.sin(angle) * spread * 0.6,
                            -LIVING.spawnDistance - i * 35 - attempt * 3
                        ),
                        this.target
                    )
                    .add(this.ship.position);
                safe = true;
                for (const rock of this.rocks)
                    if (this.delta.sub2(this.target, rock.position).length() < rock.radius + 14) {
                        safe = false;
                        break;
                    }
                if (safe)
                    for (const r of this.spawnObstacles)
                        if (this.target.distance(r.position) < r.radius + 16) {
                            safe = false;
                            break;
                        }
                if (safe)
                    for (const other of this.enemies)
                        if (other.active && this.delta.sub2(this.target, other.position).length() < 36) {
                            safe = false;
                            break;
                        }
                if (safe) break;
            }
            if (safe) {
                let kind =
                    this.director.encounter?.roles[i % this.director.encounter.roles.length] ??
                    (this.director.plan.heavy && i % 3 === 2 ? 'heavy' : 'interceptor');
                if (kind === 'carrier' && this.enemies.some((e) => e.active && e.kind === 'carrier')) kind = 'heavy';
                if (kind === 'bomber' && this.enemies.filter((e) => e.active && e.kind === 'bomber').length >= 2)
                    kind = 'heavy';
                const tier = waveTier(this.wave, this.director.deployed + i);
                e.spawn(kind, this.target, this.ship.rotation, kind === 'interceptor' && tier === 'elite');
                e.sniper = kind === 'heavy' && this.wave >= 8 && (this.director.deployed + i) % 3 === 0;
                if (!e.elite && e.kind === 'interceptor' && tier === 'veteran') {
                    e.tier = 'veteran';
                    e.health *= 1.3;
                    e.maxHealth = e.health;
                }
                const durability = waveHealth(this.wave, e.kind, e.elite);
                e.health = e.maxHealth = Math.round(e.maxHealth * durability);
                spawned++;
                e.arrival = LIVING.approach;
                this.ship.rotation
                    .transformVector(
                        this.delta.set((i - (count - 1) / 2) * 42, (i % 2 ? 1 : -1) * 24, -240 - i * 18),
                        e.arrivalGoal
                    )
                    .add(this.ship.position);
                if (e.elite) this.emit('emp', e.position, 0.6);
                if (this.director.encounter?.name === 'ELITE VECTOR AMBUSH' && i === 0) e.visual = 'saucer';
            }
        }
        this.director.commitSpawn(spawned);
    }
    hurtPlayer(damage: number, source: Vec3) {
        if (this.ship.hull <= 0) return;
        const absorbed = Math.min(this.ship.shield, damage);
        this.ship.shield -= absorbed;
        this.ship.hull = Math.max(0, this.ship.hull - (damage - absorbed));
        this.shieldDelay = COMBAT.shield.delay;
        this.shieldHit = absorbed > 0;
        this.damageSource.copy(source);
        this.damageFlash = 1;
        this.shake = Math.max(this.shake, 0.6);
        this.enemyHits++;
        this.flow.damage(damage > absorbed);
        this.lastHull = this.ship.hull;
        this.emit(this.shieldHit ? 'shield' : 'hull', this.ship.position, 1);
        if (this.ship.hull <= 0) this.emit('explosion', this.ship.position, 2);
    }
    private firePlayer() {
        this.ship.rotation.transformVector(Vec3.FORWARD, this.forward);
        const target = this.getTarget(this.selected);
        this.direction.copy(this.forward);
        if (target && this.targeting.assist(target)) {
            const distance = this.delta.sub2(target.position, this.ship.position).length();
            this.target
                .copy(target.velocity)
                .sub(this.ship.velocity)
                .mulScalar(distance / (COMBAT.player.speed * (1 + this.upgrades.get('velocity'))))
                .add(target.position);
            this.delta.sub2(this.target, this.ship.position).normalize();
            if (this.delta.dot(this.forward) > TARGETING.laserCos)
                this.direction.lerp(this.forward, this.delta, TARGETING.laserBlend).normalize();
        }
        for (const side of [-1, 1]) {
            this.ship.rotation
                .transformVector(this.muzzlePosition.set(side * 1.35, -0.12, -2.8), this.muzzlePosition)
                .add(this.ship.position);
            const fired = this.projectiles.spawn(
                this.muzzlePosition,
                this.direction,
                this.ship.velocity,
                COMBAT.player.speed * (1 + this.upgrades.get('velocity')),
                COMBAT.player.damage * (1 + this.upgrades.get('laser')),
                COMBAT.player.lifetime,
                false
            );
            if (fired) this.flow.shots++;
        }
        this.muzzle = 0.06;
        this.emit('laser', this.ship.position, 1);
    }
    step(dt: number, firing: boolean) {
        if (this.upgrades.pending) return;
        this.observeHull();
        if (this.ship.hull <= 0) return;
        this.duration += dt;
        this.flow.step(
            dt,
            this.boss.dying <= 0 &&
                this.remaining > 0 &&
                (!this.boss.active ||
                    (!this.boss.arriving && this.boss.grace <= 0 && this.boss.parts.some((p) => p.targetable)))
        );
        this.cooldown -= dt;
        this.damageFlash = Math.max(0, this.damageFlash - dt * 1.8);
        this.shake = Math.max(0, this.shake - dt * 2);
        this.muzzle = Math.max(0, this.muzzle - dt);
        this.shieldDelay -= dt;
        if (this.shieldDelay <= 0)
            this.ship.shield = Math.min(
                COMBAT.shield.capacity,
                this.ship.shield + COMBAT.shield.recharge * (1 + this.upgrades.get('shield')) * dt
            );
        this.missileCooldown -= dt;
        this.empCooldown = Math.max(0, this.empCooldown - dt);
        this.empPulse = Math.max(0, this.empPulse - dt);
        this.victory = Math.max(0, this.victory - dt);
        const spawn = this.director.step(dt, this.remaining);
        if (this.director.cleared) {
            this.clearedWaves = this.wave;
            if (this.challenge.finish(this.flow)) this.challengesWon++;
            this.ammo = Math.min(this.ammoCapacity, this.ammo + EVOLUTION.director.resupply);
            this.ship.hull = Math.min(100, this.ship.hull + EVOLUTION.director.hullRepair);
            this.upgrades.offer(this.wave);
            if (this.upgrades.pending) return;
        }
        if (spawn !== 'none' && this.director.group === 1)
            this.challenge.begin(this.wave, this.flow, this.challengesEnabled);
        if (spawn === 'boss') {
            this.boss.spawn(this.ship, this.rocks);
            this.event('boss:spawn');
            this.emit('charge', this.boss.position, 2);
        } else if (spawn === 'squad') this.spawnWave();
        const attacks = this.guardian.attack;
        const tells = this.boss.patterns.tells,
            salvos = this.boss.patterns.salvos;
        this.boss.step(dt, this.ship, this.rocks, this.projectiles);
        if (this.boss.active) {
            const b = this.boss,
                p = b.patterns;
            if (p.tells !== tells) this.emit('charge', b.position, 0.7);
            if (p.salvos !== salvos) this.emit('salvo', b.position, 1.2);
            if (
                p.beamActive &&
                b.beamCooldown <= 0 &&
                (Number.isFinite(
                    sweptHit(
                        p.beamOrigin,
                        p.beamEnd,
                        this.ship.previous,
                        this.ship.position,
                        BOSS_PATTERNS.beam.radius + 3
                    )
                ) ||
                    (p.profile === 'tesser' &&
                        p.kind === 'cross' &&
                        Number.isFinite(
                            sweptHit(
                                p.secondOrigin,
                                p.secondEnd,
                                this.ship.previous,
                                this.ship.position,
                                BOSS_PATTERNS.beam.radius + 3
                            )
                        )))
            ) {
                this.hurtPlayer(BOSS_PATTERNS.beam.damage, p.beamOrigin);
                b.beamCooldown = BOSS_PATTERNS.beam.hitInterval;
            }
        }
        if (this.guardian.active && this.guardian.attack !== attacks)
            this.emit('salvo', this.guardian.warningOrigin, 2);
        if (this.guardian.active && this.guardian.escortsPending) {
            this.guardian.escortsPending = false;
            for (let i = 0; i < GUARDIAN.escorts; i++) {
                const e = this.enemies.find((t) => !t.active);
                if (!e) break;
                this.guardian.rotation
                    .transformVector(this.delta.set(i ? 180 : -180, 75, -100), this.target)
                    .add(this.guardian.position);
                if (this.rocks.every((r) => r.position.distance(this.target) > r.radius + 20))
                    e.spawn('interceptor', this.target, this.ship.rotation, true);
            }
        }
        if (this.boss.dying > 0) {
            const deathBeats =
                this.boss instanceof Phantom
                    ? [0, 0.35, 0.85, 1.6, 2.7, 3.8, 4.8]
                    : this.boss instanceof Tesser
                      ? [0, 0.8, 1.8, 2.8, 3.7, 4.3, 5.2]
                      : SPECTACLE.boss.beats;
            while (
                this.boss.deathStage + 1 < SPECTACLE.boss.beats.length &&
                this.boss.deathAge >= deathBeats[this.boss.deathStage + 1]
            ) {
                const stage = ++this.boss.deathStage;
                this.boss.rotation
                    .transformVector(
                        this.delta.set(
                            stage === 1 ? -64 : stage === 2 ? 64 : 0,
                            stage === 3 ? 20 : 0,
                            stage === 4 ? 105 : stage === 2 ? -45 : 0
                        ),
                        this.target
                    )
                    .add(this.boss.position);
                if (this.boss instanceof Phantom) this.target.lerp(this.boss.position, this.target, 0.18);
                this.emit(
                    stage === SPECTACLE.boss.finalBeat
                        ? 'capital-final'
                        : this.boss instanceof Phantom
                          ? 'elite-explosion'
                          : 'capital-burst',
                    this.target,
                    this.boss instanceof Phantom
                        ? stage === SPECTACLE.boss.finalBeat
                            ? 5
                            : 1.5
                        : stage === SPECTACLE.boss.finalBeat
                          ? 9
                          : stage === 0
                            ? 2
                            : 3.5,
                    this.boss instanceof Phantom ? 'phantom' : this.boss instanceof Guardian ? 'tesser' : 'dreadnought'
                );
                this.shake = Math.max(this.shake, stage === SPECTACLE.boss.finalBeat ? 0.65 : 0.18);
                if (stage === SPECTACLE.boss.finalBeat) {
                    this.victory = EVOLUTION.boss.victory;
                    this.flow.rewardTime = 1.35;
                    this.event('boss:defeated');
                }
            }
        }
        if (this.boss.active && !this.boss.arriving && this.boss.collisionCooldown <= 0)
            for (const h of this.boss.hull) {
                this.delta.sub2(this.ship.position, h.position);
                const distance = this.delta.length();
                if (distance < h.radius + 3) {
                    if (distance < 0.01) this.delta.set(0, 1, 0);
                    else this.delta.mulScalar(1 / distance);
                    this.ship.position
                        .copy(this.delta)
                        .mulScalar(h.radius + 3.1)
                        .add(h.position);
                    this.ship.previous.copy(this.ship.position);
                    this.ship.velocity.mulScalar(0.2);
                    this.hurtPlayer(18, h.position);
                    this.boss.collisionCooldown = 1;
                    break;
                }
            }
        this.barrels.step(dt, this.ship.position);
        this.frontier.step(dt, this.ship, this.projectiles, this.boss.active || this.boss.dying > 0);
        this.frontier.dispatchAmbush(this.enemies, this.ship, this.boss.active || this.boss.dying > 0);
        let hostilePressure = 0;
        for (const p of this.projectiles.items) if (p.active && p.hostile) hostilePressure++;
        const attackBudget = this.boss.active
            ? this.boss.patterns.state === 'recover'
                ? 1
                : 0
            : hostilePressure >= 48
              ? 1
              : this.director.attackers;
        this.squadron.step(dt, this.enemies, this.ship, attackBudget, Math.max(0, this.wave - 5));
        for (const e of this.enemies)
            if (e.active) {
                if (
                    this.director.encounter?.name === 'BASTION BOMBER WING' ||
                    this.director.encounter?.name === 'CARRIER STRONGPOINT'
                ) {
                    const base = this.frontier.bases.find(
                        (b) => b.powered && b.rock.position.distance(this.ship.position) < 650
                    );
                    if (base && (e.kind === 'carrier' || e.kind === 'heavy')) {
                        e.order = 'formation';
                        base.rotation
                            .transformVector(
                                this.delta.set((e.id % 2 ? 1 : -1) * 75, base.rock.radius + 100, 40),
                                e.goal
                            )
                            .add(base.rock.position);
                        e.canFire = e.disrupted <= 0;
                    }
                }
                this.ai.step(e, this.ship, this.enemies, this.rocks, dt, this.spawnObstacles);
                this.enemyPatterns.step(dt, e, this.ship, this.projectiles, this.enemies, this.emit);
            }
        this.fleet.step(dt, this.ship, this.enemies, this.rocks, this.projectiles, this.emit);
        if (this.wave !== this.targetingWave) {
            this.targetingWave = this.wave;
            if (this.selected >= 0) this.selected = this.targeting.clear();
        }
        this.selected = this.targeting.update(this.selected, this.targets, dt);
        if (firing && this.cooldown <= 0) {
            this.firePlayer();
            this.cooldown = 1 / COMBAT.player.fireRate;
        }
        for (const p of this.projectiles.items)
            if (p.active) {
                this.fleet.steer(p, this.ship, dt);
                p.previous.copy(p.position);
                p.position.add(this.delta.copy(p.velocity).mulScalar(dt));
                this.trace(p);
                p.life -= dt;
                if (p.life <= 0) p.active = false;
            }
        this.missiles.step(dt, this.getTarget);
        for (const p of this.missiles.items) if (p.active) this.trace(p);
    }
    launchMissile() {
        if (this.ship.hull <= 0 || this.ammo <= 0 || this.missileCooldown > 0) return false;
        const target = this.targeting.missile(this.getTarget(this.selected), this.targets);
        if (!target || !this.missiles.launch(this.ship, target)) return false;
        this.selected = target.id;
        this.flow.shots++;
        this.ammo--;
        this.missileCooldown = EVOLUTION.missile.cooldown;
        this.emit('laser', this.ship.position, 2);
        return true;
    }
    emp() {
        if (this.ship.hull <= 0 || this.empCooldown > 0) return false;
        this.empCooldown = EVOLUTION.emp.cooldown * (1 - this.upgrades.get('emp'));
        this.empPulse = 1;
        for (const e of this.enemies)
            if (e.active && e.position.distance(this.ship.position) <= EVOLUTION.emp.radius)
                e.disrupted = EVOLUTION.emp.duration;
        if (this.boss.active && this.boss.position.distance(this.ship.position) <= EVOLUTION.emp.radius + 50)
            this.boss.disrupted = EVOLUTION.emp.bossDuration;
        for (const p of this.frontier.targets)
            if (p.active && p.position.distance(this.ship.position) <= EVOLUTION.emp.radius)
                p.disrupted = EVOLUTION.emp.duration;
        for (const p of this.projectiles.items)
            if (p.active && p.hostile && p.position.distance(this.ship.position) <= EVOLUTION.emp.radius)
                p.active = false;
        this.emit('emp', this.ship.position, 15);
        return true;
    }
    private barrelBlast(b: Barrel, credited: boolean) {
        this.emit('missile-impact', b.position, 2.2, 'barrel');
        if (b.position.distance(this.ship.position) < 100) this.shake = Math.max(this.shake, 0.35);
        const amount = (position: Vec3) =>
            LIVING.blastDamage * Math.max(0, 1 - position.distance(b.position) / LIVING.blastRadius);
        const hurt = amount(this.ship.position);
        if (hurt > 0) this.hurtPlayer(hurt, b.position);
        for (const e of this.enemies)
            if (e.targetable) {
                e.health -= amount(e.position);
                e.flash = 0.15;
                if (e.health <= 0) {
                    e.active = false;
                    this.emit(
                        'explosion',
                        e.position,
                        1.5,
                        e.visual === 'saucer' ? 'saucer' : e.kind === 'heavy' ? 'heavy' : 'fighter'
                    );
                    if (credited) {
                        this.kills++;
                        this.flow.kill(
                            e.elite ? ARCADE.scoring.elite : ARCADE.scoring[e.kind],
                            this.ship.boosting,
                            'ENVIRONMENTAL KILL'
                        );
                    }
                }
            }
        for (const p of this.frontier.targets)
            if (p.active) {
                const damage = amount(p.position);
                if (damage <= 0) continue;
                const points = this.frontier.damage(p, damage);
                if (points > 0) {
                    this.emit('explosion', p.position, 1.5, 'turret');
                    if (credited) {
                        this.kills++;
                        this.flow.kill(points, this.ship.boosting, 'ENVIRONMENTAL DEFENSE DOWN');
                    }
                }
            }
    }
    private trace(p: {
        active: boolean;
        hostile: boolean;
        damage: number;
        radius: number;
        position: Vec3;
        previous: Vec3;
        missile?: boolean;
    }) {
        let nearest = Infinity;
        let victim: CombatTarget | undefined;
        let player = false;
        for (const rock of this.rocks) {
            const t = sweptHit(p.previous, p.position, rock.position, rock.position, rock.radius + p.radius);
            if (t < nearest) {
                nearest = t;
                victim = undefined;
            }
        }
        for (const core of this.frontier.solids) {
            const t = sweptHit(p.previous, p.position, core.position, core.position, core.radius + p.radius);
            if (t < nearest) {
                nearest = t;
                victim = undefined;
            }
        }
        for (const b of this.barrels.items)
            if (b.active) {
                const t = sweptHit(p.previous, p.position, b.previous, b.position, b.radius + p.radius);
                if (t < nearest) {
                    nearest = t;
                    victim = b;
                }
            }
        if (p.hostile) {
            const t = sweptHit(p.previous, p.position, this.ship.previous, this.ship.position, 3 + p.radius);
            if (t < nearest) {
                nearest = t;
                player = true;
                victim = undefined;
            }
        } else {
            for (const e of this.targets)
                if (e.active) {
                    const t = sweptHit(p.previous, p.position, e.previous, e.position, e.radius + p.radius);
                    if (t < nearest) {
                        nearest = t;
                        victim = e;
                    }
                }
            if (this.boss.active)
                for (const h of this.boss.hull) {
                    const t = sweptHit(p.previous, p.position, h.previous, h.position, h.radius + p.radius);
                    if (t < nearest) {
                        nearest = t;
                        victim = undefined;
                    }
                }
        }
        if (nearest === Infinity) return;
        p.position.lerp(p.previous, p.position, nearest);
        p.active = false;
        if (p.missile)
            for (const b of this.barrels.items)
                if (b.active && b.position.distance(p.position) < 12)
                    this.barrels.damage(b, 40, (q) => this.barrelBlast(q, !p.hostile));
        if (player) this.hurtPlayer(p.damage, p.previous);
        else if (victim) {
            this.emit(
                p.missile ? 'missile-impact' : victim.targetable ? 'impact' : 'armor',
                p.position,
                p.missile ? 2 : 1
            );
            if (!victim.targetable) return;
            if (!p.hostile) {
                this.playerHits++;
                this.flow.hit();
            }
            if (victim instanceof Barrel) {
                this.barrels.damage(victim, p.damage, (b) => this.barrelBlast(b, !p.hostile));
            } else if (victim instanceof BossPart) {
                const phaseBefore = this.boss.phase;
                if (this.boss.damage(victim, p.damage)) {
                    if (this.boss instanceof Artillery && this.boss.phase !== phaseBefore) {
                        this.emit('emp', this.boss.position, 3);
                        this.shake = Math.max(this.shake, 0.22);
                    }
                    if (this.boss instanceof Guardian && victim.id < 28)
                        this.flow.kill(GUARDIAN.componentScore, this.ship.boosting, 'TESSER SYSTEM DOWN');
                    else if (victim.id < 12) this.flow.kill(ARCADE.scoring.turret, this.ship.boosting, 'TURRET DOWN');
                    this.emit('explosion', victim.position, 2, 'turret');
                    if (!this.boss.active) {
                        this.flow.kill(
                            this.boss instanceof Guardian
                                ? GUARDIAN.score
                                : this.boss instanceof Phantom
                                  ? FLEET.phantom.score
                                  : ARCADE.scoring.boss,
                            this.ship.boosting,
                            this.boss instanceof Guardian
                                ? 'TESSER VICTORY'
                                : this.boss instanceof Phantom
                                  ? 'PHANTOM VICTORY'
                                  : 'CAPITAL VICTORY'
                        );
                        this.bosses++;
                        const time = this.boss.age - this.boss.arrival.duration;
                        if (this.boss instanceof Guardian) {
                            this.guardianBosses++;
                            this.bestGuardianTime =
                                this.bestGuardianTime === null ? time : Math.min(this.bestGuardianTime, time);
                            for (const e of this.enemies) e.active = false;
                        } else if (this.boss instanceof Phantom) {
                            this.phantomBosses++;
                            this.bestPhantomTime =
                                this.bestPhantomTime === null ? time : Math.min(this.bestPhantomTime, time);
                        } else
                            this.bestBossTime = this.bestBossTime === null ? time : Math.min(this.bestBossTime, time);
                        this.kills++;
                        this.bossReward = this.flow.lastReward;
                        this.shake = 0.25;
                        for (const shot of this.projectiles.items) if (shot.hostile) shot.active = false;
                    }
                }
            } else if (victim instanceof InstallationPart) {
                const points = this.frontier.damage(victim, p.damage);
                if (points > 0) {
                    this.flow.kill(
                        points,
                        this.ship.boosting,
                        victim.base.destroyed ? 'BASTION DISABLED' : 'DEFENSE DOWN'
                    );
                    this.kills++;
                    this.emit('explosion', victim.position, victim.base.destroyed ? 2 : 1, 'turret');
                }
            } else if (victim instanceof Enemy) {
                victim.health -= p.damage;
                victim.flash = 0.15;
                if (victim.health <= 0) {
                    victim.active = false;
                    for (const b of this.barrels.items)
                        if (b.active && b.position.distance(victim.position) < 14)
                            this.barrels.damage(b, 30, (q) => this.barrelBlast(q, true));
                    this.kills++;
                    if (victim.kind === 'bomber' || victim.kind === 'carrier')
                        for (const side of [-1, 1]) {
                            victim.rotation
                                .transformVector(this.target.set(side * 5, -1, 0), this.target)
                                .add(victim.position);
                            this.emit('impact', this.target, 1.5);
                        }
                    this.flow.kill(
                        (victim.elite ? ARCADE.scoring.elite : ARCADE.scoring[victim.kind]) +
                            (victim.warmup > 0 ? FLEET.priority : 0),
                        this.ship.boosting,
                        victim.warmup > 0 ? 'PRIORITY INTERRUPTED' : victim.label + ' DOWN'
                    );
                    this.emit(
                        victim.elite || victim.kind === 'carrier' || victim.kind === 'bomber'
                            ? 'elite-explosion'
                            : 'explosion',
                        victim.position,
                        victim.kind === 'bomber' || victim.kind === 'carrier'
                            ? 2.2
                            : victim.elite
                              ? 1.8
                              : victim.kind === 'heavy'
                                ? 1.4
                                : victim.kind === 'drone'
                                  ? 0.6
                                  : 1,
                        victim.visual === 'saucer'
                            ? 'saucer'
                            : victim.kind === 'heavy' || victim.kind === 'bomber' || victim.kind === 'carrier'
                              ? 'heavy'
                              : 'fighter'
                    );
                    if (victim.position.distance(this.ship.position) < 150)
                        this.shake = Math.max(this.shake, victim.elite ? 0.45 : 0.25);
                }
            }
            if (!victim.active && this.selected === victim.id) this.selected = this.targeting.clear();
        } else {
            this.rockHits++;
            this.emit(p.missile ? 'missile-impact' : 'armor', p.position, p.missile ? 1.7 : 0.6);
        }
    }
}
