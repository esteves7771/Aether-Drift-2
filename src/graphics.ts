import { CameraFrame, TONEMAP_NEUTRAL } from 'playcanvas';
import type { AppBase, CameraComponent } from 'playcanvas';

import type { GraphicsQuality } from './config';
export const PRESETS = {
    low: { pixelRatio: 1, renderScale: 0.8, effects: 40, bloom: false },
    medium: { pixelRatio: 1.5, renderScale: 0.9, effects: 88, bloom: false },
    high: { pixelRatio: 1.75, renderScale: 1, effects: 128, bloom: true }
} as const;
export class Graphics {
    private readonly app: AppBase;
    private readonly camera: CameraComponent;
    private frame?: CameraFrame;
    private current: GraphicsQuality | undefined;
    private readonly changed: (level: GraphicsQuality) => void;
    constructor(app: AppBase, camera: CameraComponent, changed: (level: GraphicsQuality) => void) {
        this.app = app;
        this.camera = camera;
        this.changed = changed;
        camera.toneMapping = TONEMAP_NEUTRAL;
    }
    apply(level: GraphicsQuality) {
        if (this.current === level) return;
        this.current = level;
        const app = this.app;
        app.graphicsDevice.maxPixelRatio =
            Math.min(window.devicePixelRatio, PRESETS[level].pixelRatio) * PRESETS[level].renderScale;
        app.resizeCanvas();
        if (level === 'high') {
            if (!this.frame) {
                this.frame = new CameraFrame(app, this.camera);
                this.frame.rendering.toneMapping = TONEMAP_NEUTRAL;
                this.frame.rendering.samples = 1;
                this.frame.bloom.enabled = true;
                this.frame.bloom.intensity = 0.025;
                this.frame.bloom.threshold = 1.2;
                this.frame.bloom.blurLevel = 4;
                this.frame.bloom.highQuality = false;
                this.frame.ssao.enabled = false;
                this.frame.dof.enabled = false;
                this.frame.taa.enabled = false;
                this.frame.vignette.enabled = false;
                this.frame.update();
            }
            this.frame.enabled = true;
        } else if (this.frame) this.frame.enabled = false;
        this.camera.toneMapping = TONEMAP_NEUTRAL;
        this.changed(level);
        document.body.dataset.graphics = level;
    }
    resize() {
        if (this.current) {
            this.app.graphicsDevice.maxPixelRatio =
                Math.min(window.devicePixelRatio, PRESETS[this.current].pixelRatio) * PRESETS[this.current].renderScale;
            this.app.resizeCanvas();
        }
    }
    destroy() {
        this.frame?.destroy();
    }
}
