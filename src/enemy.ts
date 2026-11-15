import { Quat, Vec3 } from 'playcanvas';

import { COMBAT } from './combat-config';
import type { AIState, EnemyKind } from './combat-config';
import { EVOLUTION } from './evolution-config';
import { FLEET } from './fleet-config';
export class Enemy {
    active = false;
    generation = 0;
    owner = -1;
    ownerGeneration = 0;
    deployments = 0;
    orphanTime = 0;
    warmup = 0;
    arrival = 0;
    readonly arrivalGoal = new Vec3();
    volley = 0;
    plasma = false;
    readonly lockedAim = new Vec3();
    kind: EnemyKind = 'interceptor';
    visual: 'standard' | 'saucer' = 'standard';
    state: AIState = 'pursue';
    readonly position = new Vec3();
    readonly previous = new Vec3();
    readonly velocity = new Vec3();
    readonly rotation = new Quat();
    readonly previousRotation = new Quat();
    health = 56;
    maxHealth = 56;
    cooldown = 0;
    stateTime = 0;
    age = 0;
    flash = 0;
    elite = false;
    disrupted = 0;
    canFire = true;
    attackCue = false;
    order: 'formation' | 'flank' | 'regroup' | 'engage' = 'engage';
    readonly goal = new Vec3();
    get radius() {
        return this.tuning.radius;
    }
    get label() {
        if (this.visual === 'saucer') return 'ALIEN SCOUT / ELITE';
        return this.elite
            ? 'ELITE INTERCEPTOR'
            : this.kind === 'bomber'
              ? 'HEAVY BOMBER'
              : this.kind === 'carrier'
                ? 'DRONE CARRIER'
                : this.kind === 'drone'
                  ? 'COMBAT DRONE'
                  : this.kind === 'heavy'
                    ? 'HEAVY'
                    : 'INTERCEPTOR';
    }
    get targetable() {
        return this.active && this.arrival <= 0;
    }
    readonly escape = new Vec3();
    constructor(readonlyId: number) {
        this.id = readonlyId;
    }
    readonly id: number;
    get tuning() {
        return this.elite
            ? EVOLUTION.elite
            : this.kind === 'bomber' || this.kind === 'carrier' || this.kind === 'drone'
              ? FLEET[this.kind]
              : COMBAT[this.kind];
    }
    spawn(kind: EnemyKind, position: Vec3, rotation: Quat, elite = false) {
        this.visual = 'standard';
        this.arrival = 0;
        this.volley = 0;
        this.plasma = false;
        this.generation++;
        this.owner = -1;
        this.ownerGeneration = this.deployments = this.orphanTime = this.warmup = 0;
        this.elite = elite;
        this.disrupted = 0;
        this.canFire = true;
        this.attackCue = false;
        this.order = 'engage';
        this.active = true;
        this.kind = kind;
        this.position.copy(position);
        this.previous.copy(position);
        this.velocity.set(0, 0, 0);
        this.rotation.copy(rotation);
        this.previousRotation.copy(rotation);
        this.health = this.maxHealth = this.tuning.health;
        this.cooldown = 1.5 + this.id * 0.3;
        this.stateTime = this.age = this.flash = 0;
        this.state = 'pursue';
    }
}
