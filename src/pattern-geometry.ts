import { Vec3 } from 'playcanvas';
/** Shared allocation-free aim-plane generator for regular and capital weapon patterns. */
export class PatternGeometry {
    private readonly forward = new Vec3();
    private readonly right = new Vec3();
    private readonly up = new Vec3();
    private readonly scratch = new Vec3();
    ray(origin: Vec3, aim: Vec3, x: number, y: number, out: Vec3) {
        this.forward.sub2(aim, origin).normalize();
        this.right.cross(this.forward, Math.abs(this.forward.y) > 0.98 ? Vec3.RIGHT : Vec3.UP).normalize();
        this.up.cross(this.right, this.forward).normalize();
        return out
            .copy(this.forward)
            .add(this.scratch.copy(this.right).mulScalar(x))
            .add(this.scratch.copy(this.up).mulScalar(y))
            .normalize();
    }
}
