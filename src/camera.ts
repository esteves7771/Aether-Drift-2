import type { Entity } from 'playcanvas';
import { Quat, Vec3 } from 'playcanvas';
export class ChaseCamera {
    private readonly desired = new Vec3();
    private readonly offset = new Vec3();
    private readonly rotation = new Quat();
    private initialized = false;
    private readonly smoothPosition = new Vec3();
    private time = 0;
    readonly entity: Entity;
    constructor(entity: Entity) {
        this.entity = entity;
    }
    reset() {
        this.initialized = false;
    }
    update(position: Vec3, rotation: Quat, distance: number, dt: number, shake = 0, travelVelocity?: Vec3) {
        rotation.transformVector(this.offset.set(0, distance * 0.25, distance), this.desired).add(position);
        const blend = this.initialized ? 1 - Math.exp(-9 * dt) : 1;
        if (this.initialized && travelVelocity)
            this.smoothPosition.add(this.offset.copy(travelVelocity).mulScalar(Math.min(dt, 0.1)));
        this.smoothPosition.lerp(this.smoothPosition, this.desired, blend);
        this.offset.copy(this.smoothPosition);
        this.time += dt;
        this.offset.x += Math.sin(this.time * 73) * shake * 0.25;
        this.offset.y += Math.sin(this.time * 91) * shake * 0.2;
        this.entity.setPosition(this.offset);
        this.rotation.slerp(this.entity.getRotation(), rotation, this.initialized ? 1 - Math.exp(-12 * dt) : 1);
        this.entity.setRotation(this.rotation);
        this.initialized = true;
    }
}
