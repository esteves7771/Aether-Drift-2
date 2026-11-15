import type { GraphicsQuality } from './config';
import { SPECTACLE } from './spectacle-config';
/** Render/audio envelope only: never writes flight position, velocity or orientation. */
export class FlightFeel {
    fov: number = SPECTACLE.speed.fov;
    pullback = 0;
    acceleration = 0;
    intensity = 0;
    private previous = 0;
    readonly engineColor = new Float32Array(3);
    reset() {
        this.fov = SPECTACLE.speed.fov;
        this.pullback = this.acceleration = this.intensity = this.previous = 0;
    }
    update(speed: number, boost: boolean, active: boolean, enabled: boolean, quality: GraphicsQuality, dt: number) {
        if (!active || dt <= 0) {
            this.previous = speed;
            return;
        }
        const blend = 1 - Math.exp(-SPECTACLE.speed.response * dt),
            acc = Math.max(-90, Math.min(90, (speed - this.previous) / dt));
        this.previous = speed;
        this.acceleration += (acc - this.acceleration) * blend;
        const strength = enabled ? (quality === 'low' ? 0.6 : 1) : 0,
            n = Math.min(1, speed / 190);
        this.intensity += ((boost ? 1 : n * 0.35) - this.intensity) * blend;
        this.fov +=
            (SPECTACLE.speed.fov +
                strength * (n * SPECTACLE.speed.fovSpeed + (boost ? SPECTACLE.speed.fovBoost : 0)) -
                this.fov) *
            blend;
        this.pullback +=
            (strength *
                ((boost ? SPECTACLE.speed.pullback : 0) +
                    (Math.max(0, this.acceleration) / 65) * SPECTACLE.speed.accelerationPull) -
                this.pullback) *
            blend;
        const brightness = 1 + n + (boost ? 1 : 0);
        this.engineColor[0] = 0.015 * brightness;
        this.engineColor[1] = 0.25 * brightness;
        this.engineColor[2] = 0.8 * brightness;
    }
}
