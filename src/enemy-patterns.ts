import { Vec3 } from 'playcanvas';

import type { EmitCombat } from './combat';
import type { Enemy } from './enemy';
import { ENEMY_PATTERNS as C } from './enemy-pattern-config';
import type { Flight } from './flight';
import { PatternGeometry } from './pattern-geometry';
import type { Projectiles } from './projectiles';
/** Fixed-step attacks; major token is held through anticipation and release, never per projectile. */
export class EnemyPatterns {
    private readonly geometry = new PatternGeometry();
    private readonly direction = new Vec3();
    private readonly origin = new Vec3();
    private readonly zero = new Vec3();
    tells = 0;
    salvos = 0;
    reset() {
        this.tells = this.salvos = 0;
    }
    step(dt: number, e: Enemy, ship: Flight, shots: Projectiles, enemies: Enemy[], emit: EmitCombat) {
        if (e.arrival > 0 || e.kind === 'carrier' || e.kind === 'bomber') return;
        const role = e.role,
            spec = C[role];
        if (e.disrupted > 0) {
            e.patternTime = e.patternShots = 0;
            e.patternState = 'idle';
            e.attackCue = false;
            e.cooldown = Math.max(1, e.cooldown);
            return;
        }
        if (e.patternState === 'idle') {
            if (!e.canFire || e.state !== 'attack' || e.cooldown > 0 || e.age < 2) return;
            if (e.position.distance(ship.position) > (role === 'sniper' ? 850 : 550)) return;
            if (
                role !== 'standard' &&
                enemies.some(
                    (o) => o !== e && o.active && (o.warmup > 0 || (o.role !== 'standard' && o.patternState !== 'idle'))
                )
            )
                return;
            e.lockedAim
                .copy(ship.velocity)
                .mulScalar(role === 'sniper' ? 0.22 : 0.3)
                .add(ship.position);
            e.patternState = 'telegraph';
            e.patternTime = spec.tell;
            e.patternShots = 0;
            e.attackCue = true;
            this.tells++;
            emit('charge', e.position, role === 'standard' ? 0.3 : 0.65);
            return;
        }
        e.patternTime -= dt;
        e.attackCue = e.patternState === 'telegraph';
        if (e.patternTime > 0) return;
        if (e.patternState === 'telegraph') {
            e.patternState = 'fire';
            e.patternTime = 0;
        }
        let hostile = 0,
            active = 0;
        for (const p of shots.items)
            if (p.active) {
                active++;
                if (p.hostile) hostile++;
            }
        if (hostile < C.hostileLimit && active < shots.items.length - C.reserve) {
            const i = e.patternShots;
            // Fan elevations alternate, while each burst keeps the original warned aim.
            const fan = role === 'veteran' || role === 'heavy' || role === 'elite';
            const x = fan ? (i - (spec.count - 1) / 2) * spec.spread : Math.sin(i * 2.4) * spec.spread;
            const y = fan ? Math.sin(i * 2.4 + e.volley) * spec.spread * 0.65 : Math.cos(i * 2.4) * spec.spread;
            e.rotation
                .transformVector(Vec3.FORWARD, this.origin)
                .mulScalar(e.radius + 1)
                .add(e.position);
            this.geometry.ray(this.origin, e.lockedAim, x, y, this.direction);
            shots.spawn(
                this.origin,
                this.direction,
                this.zero,
                role === 'sniper' ? 420 : role === 'heavy' ? 130 : e.tuning.projectileSpeed,
                role === 'sniper' ? 20 : role === 'heavy' ? 14 : e.tuning.damage,
                5,
                true,
                role === 'elite' && e.volley % 2 === 1 && i < 2,
                role === 'heavy',
                false,
                role === 'heavy' ? 1 : role === 'elite' ? 5 : 2
            );
            this.salvos++;
            emit('hostile', e.position, 0.5);
        }
        e.patternShots++;
        e.patternTime += spec.interval;
        if (e.patternShots >= spec.count) {
            e.patternState = 'idle';
            e.cooldown = spec.cooldown;
            e.volley++;
            e.state = 'reposition';
            e.stateTime = 0;
            e.attackCue = false;
        }
    }
}
