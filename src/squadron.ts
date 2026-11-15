import { Vec3 } from 'playcanvas';

import type { Enemy } from './enemy';
import { EVOLUTION } from './evolution-config';
import type { Flight } from './flight';
export class Squadron {
    time = 0;
    private readonly offset = new Vec3();
    reset() {
        this.time = 0;
    }
    step(dt: number, enemies: Enemy[], ship: Flight, attackers: number = EVOLUTION.director.attackers, pressure = 0) {
        this.time += dt;
        const cycle = this.time % EVOLUTION.coordination.cycle,
            shift = Math.floor(this.time / 3);
        let index = 0,
            alive = 0;
        for (const e of enemies) if (e.active) alive++;
        for (const e of enemies)
            if (e.active) {
                e.disrupted = Math.max(0, e.disrupted - dt);
                e.order = 'engage';
                const side = e.id % 2 === 0 ? 1 : -1;
                if (this.time < EVOLUTION.coordination.formation) {
                    e.order = 'formation';
                    this.offset.set(side * (25 + index * 14), Math.sin(index * 2) * 24, -190 - index * 20);
                } else if (cycle >= EVOLUTION.coordination.regroupAt + Math.min(2, pressure * 0.16)) {
                    e.order = 'regroup';
                    this.offset.set(side * (90 + index * 20), 35 * Math.sin(index + 1), -230);
                } else if (cycle < EVOLUTION.coordination.flankUntil && e.id % 3 === 1) {
                    e.order = 'flank';
                    this.offset.set(side * 135, side * 40, 25);
                }
                ship.rotation.transformVector(this.offset, e.goal).add(ship.position);
                e.canFire =
                    e.order === 'engage' && e.disrupted <= 0 && (index + shift) % Math.max(1, alive) < attackers;
                if (e.kind === 'bomber' || e.kind === 'carrier') e.order = 'engage';
                if (e.kind === 'drone') {
                    const owner = enemies[e.owner];
                    if (
                        owner?.active &&
                        owner.generation === e.ownerGeneration &&
                        owner.position.distance(ship.position) > 220
                    ) {
                        e.order = 'formation';
                        e.goal.copy(owner.position);
                        e.goal.x += Math.sin(e.age + e.id) * 30;
                        e.goal.y += Math.cos(e.age + e.id) * 25;
                        e.canFire = false;
                    }
                }
                e.attackCue = e.canFire && e.state === 'attack' && e.cooldown < 0.65 && e.cooldown > 0;
                index++;
            }
    }
}
