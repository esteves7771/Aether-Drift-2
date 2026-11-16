import { Vec3 } from 'playcanvas';

import { BOSS_PATTERNS, PATTERNS } from './boss-pattern-config';
import { BULLETHELL } from './bullethell-config';
import type { Rock } from './collisions';
import { EVOLVED_BOSSES, encounterSpec } from './evolved-boss-config';
import type { EncounterProfile } from './evolved-boss-config';
import type { Flight } from './flight';
import { PatternGeometry } from './pattern-geometry';
import type { Projectiles } from './projectiles';
import { sweptHit } from './projectiles';
export interface PatternSources {
    banks: readonly { position: Vec3; active: boolean }[];
    muzzle: Vec3;
}
export type PatternStage = 'telegraph' | 'fire' | 'recover';
/** Reusable bounded pattern director/emitter. All aiming is locked at the anticipation cue. */
export class BossPatterns {
    readonly profile: EncounterProfile;
    private readonly specs: typeof PATTERNS;
    constructor(profile: EncounterProfile = 'artillery') {
        this.profile = profile;
        this.specs = Object.fromEntries(
            Object.keys(PATTERNS).map((k) => [k, encounterSpec(profile, k as keyof typeof PATTERNS)])
        ) as typeof PATTERNS;
    }

    phase = 1;
    permitted = true;
    limit: number = BULLETHELL.single;
    readonly chargeOrigin = new Vec3();
    index = 0;
    state: PatternStage = 'telegraph';
    time = 0;
    tells = 0;
    salvos = 0;
    readonly aim = new Vec3();
    readonly beamOrigin = new Vec3();
    readonly beamEnd = new Vec3();
    readonly secondOrigin = new Vec3();
    readonly secondEnd = new Vec3();
    readonly warningEnd = new Vec3();
    readonly warningFar = new Vec3();
    readonly secondWarningEnd = new Vec3();
    readonly secondWarningFar = new Vec3();
    beamActive = false;
    obstacles: readonly Rock[] = [];
    private started = false;
    private longRange = false;
    private pulse = 0;
    private readonly geometry = new PatternGeometry();
    private readonly direction = new Vec3();
    private readonly zero = new Vec3();
    get kind() {
        const sequence = (
            this.profile === 'artillery' ? BOSS_PATTERNS.sequences : EVOLVED_BOSSES[this.profile].sequences
        )[this.phase - 1];
        return this.longRange ? 'banks' : sequence[this.index % sequence.length];
    }
    get spec() {
        return this.specs[this.kind];
    }
    get bank() {
        return this.index % 2;
    }
    get winding() {
        return this.permitted && this.state === 'telegraph'
            ? Math.max(0, this.spec.telegraph[this.phase - 1] - this.time)
            : 0;
    }
    reset(phase = 1) {
        this.phase = phase;
        this.index = 0;
        this.state = 'telegraph';
        this.time = 0;
        this.started = false;
        this.longRange = false;
        this.pulse = 0;
        this.beamActive = false;
        this.tells = this.salvos = 0;
    }
    interrupt() {
        this.state = 'recover';
        this.time = 0;
        this.pulse = 0;
        this.beamActive = false;
    }
    private begin(ship: Flight) {
        this.longRange = this.chargeOrigin.distance(ship.position) > 900;
        this.aim.copy(ship.velocity).mulScalar(BOSS_PATTERNS.aimLead).add(ship.position);
        this.started = true;
        this.tells++;
    }

    private ray(origin: Vec3, x: number, y: number, out: Vec3) {
        return this.geometry.ray(origin, this.aim, x, y, out);
    }
    private source(s: PatternSources, pulse: number) {
        let count = 0;
        for (const b of s.banks) if (b.active) count++;
        if (!count) return s.muzzle;
        let index = pulse % count;
        for (const b of s.banks) if (b.active && index-- === 0) return b.position;
        return s.muzzle;
    }
    private emit(shots: Projectiles, s: PatternSources) {
        let hostile = 0,
            active = 0;
        for (const p of shots.items)
            if (p.active) {
                active++;
                if (p.hostile) hostile++;
            }
        let budget = Math.min(this.limit - hostile, shots.items.length - active - BOSS_PATTERNS.playerReserve);
        if (budget <= 0) return;
        if (this.profile === 'tesser' && this.phase === 1 && this.pulse % 2 === 1 && s.banks.some((b) => !b.active))
            return;
        const spec = this.spec,
            origin = this.source(s, this.pulse),
            kind = this.kind;
        const shoot = (x: number, y: number, seeker = false, plasma = false, tag = 0) => {
            if (budget <= 0) return;
            this.ray(origin, x, y, this.direction);
            if (
                shots.spawn(
                    origin,
                    this.direction,
                    this.zero,
                    Math.min(spec.speed * 1.6, Math.max(spec.speed, origin.distance(this.aim) / 5)),
                    spec.damage,
                    BOSS_PATTERNS.life,
                    true,
                    seeker,
                    plasma,
                    false,
                    tag,
                    this.profile === 'artillery' ? 8 : this.profile === 'phantom' ? 15 : 22
                )
            )
                budget--;
        };
        if (kind === 'sphere' && this.pulse < 2) {
            // A perforated forward spherical cap: no closed wall, with a broad diagonal corridor.
            for (let row = -2; row <= 2; row++)
                for (let lane = -4; lane <= 4; lane++) {
                    if (Math.abs(lane - row) < 1.2) continue;
                    shoot(Math.tan(lane * 0.13) * Math.cos(row * 0.16), Math.tan(row * 0.16), false, true, 1);
                }
        } else if (kind === 'finale') {
            if (this.pulse < 2) {
                for (let row = -2; row <= 2; row++)
                    for (let lane = -4; lane <= 4; lane++) {
                        if (Math.abs(lane - (this.index % 2 ? 2 : -2)) <= 1) continue;
                        shoot(lane * 0.095, row * 0.115, false, true, 1);
                    }
            } else if (this.pulse < 6) {
                for (let i = -3; i <= 3; i++) shoot(i * 0.035, -i * 0.025, false, false, 2);
            } else {
                const a = this.pulse * 0.6;
                for (let stream = 0; stream < 3; stream++) {
                    const angle = a + stream * 2.094;
                    shoot(Math.cos(angle) * 0.28, Math.sin(angle) * 0.28, false, false, 4);
                }
            }
        } else if (kind === 'fan' && this.pulse < 2) {
            for (let row = -2; row <= 2; row++)
                for (let lane = -4; lane <= 4; lane++) {
                    if (Math.abs(lane - (this.index % 2 ? 2 : -2)) <= 1) continue;
                    shoot(lane * 0.095 + row * row * 0.008, row * 0.115, false, true, 1);
                }
        } else if (kind === 'banks' || (kind === 'cross' && this.profile === 'phantom')) {
            for (let i = -3; i <= 3; i++) shoot(i * 0.034, (this.pulse % 2 ? 1 : -1) * i * 0.03, false, false, 2);
        } else if (kind === 'helix') {
            const streams = this.phase === 3 ? 4 : 3;
            for (let stream = 0; stream < streams; stream++) {
                const a = this.pulse * 0.52 * (stream % 2 ? -1 : 1) + (stream * Math.PI * 2) / streams;
                const r = stream === 2 ? 0.17 : 0.3;
                shoot(Math.cos(a) * r, Math.sin(a) * r, false, false, 4);
            }
        } else if (kind === 'seekers' && this.pulse < 2) {
            shoot(-0.085, 0.075, true, false, 5);
            shoot(0.085, -0.075, true, false, 5);
        } else if (kind === 'beam' && this.phase === 3 && this.pulse > 0) {
            const a = this.pulse * 1.3;
            shoot(Math.cos(a) * 0.3, Math.sin(a) * 0.3, false, true, 1);
            shoot(-Math.cos(a) * 0.3, -Math.sin(a) * 0.3, false, true, 1);
        }
        if (kind !== 'fan' || this.pulse === 0 || (this.phase > 1 && this.pulse === 1)) this.salvos++;
    }
    private beam(s: PatternSources, rocks: readonly Rock[]) {
        this.beamOrigin.copy(this.profile === 'tesser' ? this.source(s, 0) : s.muzzle);
        const tilt = this.index % 2 ? Math.PI * 0.38 : -Math.PI * 0.22,
            angle = BOSS_PATTERNS.beam.sweep,
            t = this.state === 'fire' ? Math.min(1, this.time / this.spec.fire) : 0;
        this.ray(this.beamOrigin, Math.cos(tilt) * Math.tan(-angle), Math.sin(tilt) * Math.tan(-angle), this.direction);
        this.warningEnd.copy(this.direction).mulScalar(BOSS_PATTERNS.beam.length).add(this.beamOrigin);
        this.ray(this.beamOrigin, Math.cos(tilt) * Math.tan(angle), Math.sin(tilt) * Math.tan(angle), this.direction);
        this.warningFar.copy(this.direction).mulScalar(BOSS_PATTERNS.beam.length).add(this.beamOrigin);
        this.ray(
            this.beamOrigin,
            Math.cos(tilt) * Math.tan(-angle + 2 * angle * t),
            Math.sin(tilt) * Math.tan(-angle + 2 * angle * t),
            this.direction
        );
        this.beamEnd.copy(this.direction).mulScalar(BOSS_PATTERNS.beam.length).add(this.beamOrigin);
        let nearest = 1;
        for (const group of [rocks, this.obstacles])
            for (const r of group)
                nearest = Math.min(
                    nearest,
                    sweptHit(
                        this.beamOrigin,
                        this.beamEnd,
                        r.position,
                        r.position,
                        r.radius + BOSS_PATTERNS.beam.radius
                    )
                );
        if (nearest < 1) this.beamEnd.lerp(this.beamOrigin, this.beamEnd, nearest);
        this.secondOrigin.copy(this.beamOrigin);
        this.secondEnd.copy(this.beamEnd);
        if (this.kind === 'cross' && this.profile === 'tesser') {
            this.secondOrigin.copy(this.source(s, 1));
            this.ray(
                this.secondOrigin,
                Math.cos(tilt + Math.PI / 2) * Math.tan(angle),
                Math.sin(tilt + Math.PI / 2) * Math.tan(angle),
                this.direction
            );
            this.secondWarningEnd.copy(this.direction).mulScalar(BOSS_PATTERNS.beam.length).add(this.secondOrigin);
            this.ray(
                this.secondOrigin,
                Math.cos(tilt + Math.PI / 2) * Math.tan(-angle),
                Math.sin(tilt + Math.PI / 2) * Math.tan(-angle),
                this.direction
            );
            this.secondWarningFar.copy(this.direction).mulScalar(BOSS_PATTERNS.beam.length).add(this.secondOrigin);
            this.ray(
                this.secondOrigin,
                Math.cos(tilt + Math.PI / 2) * Math.tan(angle - 2 * angle * t),
                Math.sin(tilt + Math.PI / 2) * Math.tan(angle - 2 * angle * t),
                this.direction
            );
            this.secondEnd.copy(this.direction).mulScalar(BOSS_PATTERNS.beam.length).add(this.secondOrigin);
            let stop = 1;
            for (const group of [rocks, this.obstacles])
                for (const r of group)
                    stop = Math.min(
                        stop,
                        sweptHit(
                            this.secondOrigin,
                            this.secondEnd,
                            r.position,
                            r.position,
                            r.radius + BOSS_PATTERNS.beam.radius
                        )
                    );
            if (stop < 1) this.secondEnd.lerp(this.secondOrigin, this.secondEnd, stop);
        }
    }
    step(dt: number, phase: number, ship: Flight, sources: PatternSources, shots: Projectiles, rocks: readonly Rock[]) {
        if (dt <= 0) return;
        if (
            (!this.permitted || sources.muzzle.distance(ship.position) > BULLETHELL.maximumRange) &&
            this.state !== 'fire'
        ) {
            this.beamActive = false;
            return;
        }
        this.chargeOrigin.copy(this.source(sources, this.pulse));
        if (phase !== this.phase) this.reset(phase);
        if (!this.started) this.begin(ship);
        this.time += dt;
        let duration =
            this.state === 'telegraph'
                ? this.spec.telegraph[this.phase - 1]
                : this.state === 'fire'
                  ? this.spec.fire
                  : this.spec.recovery[this.phase - 1];
        while (this.time >= duration) {
            this.time -= duration;
            if (this.state === 'telegraph') {
                this.state = 'fire';
                this.pulse = 0;
            } else if (this.state === 'fire') {
                this.state = 'recover';
                this.beamActive = false;
            } else {
                this.index++;
                this.state = 'telegraph';
                this.pulse = 0;
                this.begin(ship);
            }
            duration =
                this.state === 'telegraph'
                    ? this.spec.telegraph[this.phase - 1]
                    : this.state === 'fire'
                      ? this.spec.fire
                      : this.spec.recovery[this.phase - 1];
        }
        if (this.state === 'fire')
            while (this.pulse * this.spec.interval <= this.time) {
                this.emit(shots, sources);
                this.pulse++;
            }
        this.beamActive =
            (this.kind === 'beam' || (this.kind === 'cross' && this.profile === 'tesser')) && this.state === 'fire';
        if ((this.kind === 'beam' || this.kind === 'cross') && this.state !== 'recover') this.beam(sources, rocks);
    }
}
