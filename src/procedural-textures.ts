import { ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR, Texture } from 'playcanvas';
import type { GraphicsDevice } from 'playcanvas';

import { PERSEID } from './environment';
import type { EnvironmentDefinition } from './environment';
export function hash(x: number, y: number, z = 0) {
    const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
    return n - Math.floor(n);
}
export function noise(x: number, y: number) {
    const ix = Math.floor(x),
        iy = Math.floor(y);
    let u = x - ix,
        v = y - iy;
    u = u * u * (3 - 2 * u);
    v = v * v * (3 - 2 * v);
    return (
        (hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u) * (1 - v) +
        (hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u) * v
    );
}
export function fbm(x: number, y: number) {
    return (
        noise(x, y) * 0.55 +
        noise(x * 2.07 + 17, y * 2.07) * 0.27 +
        noise(x * 4.13, y * 4.13 + 9) * 0.13 +
        noise(x * 8.2, y * 8.2) * 0.05
    );
}
function tileFbm(u: number, v: number, frequency: number) {
    const blend = u * u * (3 - 2 * u);
    return fbm(u * frequency, v * frequency) * (1 - blend) + fbm((u - 1) * frequency, v * frequency) * blend;
}
export function texture(
    device: GraphicsDevice,
    name: string,
    w: number,
    h: number,
    pixel: (x: number, y: number) => number[],
    repeat = false,
    srgb = true
) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!,
        data = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            const rgba = pixel(x / w, y / h),
                i = (y * w + x) * 4;
            data.data[i] = rgba[0];
            data.data[i + 1] = rgba[1];
            data.data[i + 2] = rgba[2];
            data.data[i + 3] = rgba[3] ?? 255;
        }
    ctx.putImageData(data, 0, 0);
    const t = new Texture(device, {
        name,
        width: w,
        height: h,
        mipmaps: true,
        srgb,
        addressU: repeat ? ADDRESS_REPEAT : ADDRESS_CLAMP_TO_EDGE,
        addressV: repeat ? ADDRESS_REPEAT : ADDRESS_CLAMP_TO_EDGE,
        minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
        magFilter: FILTER_LINEAR
    });
    t.setSource(canvas);
    return t;
}
export function spaceTextures(device: GraphicsDevice, environment: EnvironmentDefinition = PERSEID) {
    const nebula = texture(
        device,
        environment.name + ' molecular clouds',
        1024,
        512,
        (u, v) => {
            const angle = u * Math.PI * 2;
            const warp = tileFbm(u, v, 4),
                n = tileFbm(u, v + warp * 0.18, 14) * 0.7 + tileFbm(u, v, 44) * 0.3,
                band = Math.exp(-Math.pow((v - 0.5 - Math.sin(angle) * 0.1) * 4, 2));
            const dust = Math.pow(Math.max(0, n - 0.25) * 1.7, 2.4) * band,
                vein = Math.pow(Math.max(0, n - 0.38), 2.4) * band,
                blue = (Math.sin(angle * 2) + 1) / 2;
            return [
                environment.nebula.base[0] +
                    dust * (environment.nebula.dust[0] + blue * environment.nebula.blue[0]) +
                    vein * environment.nebula.vein[0],
                environment.nebula.base[1] +
                    dust * (environment.nebula.dust[1] + blue * environment.nebula.blue[1]) +
                    vein * environment.nebula.vein[1],
                environment.nebula.base[2] +
                    dust * (environment.nebula.dust[2] + blue * environment.nebula.blue[2]) +
                    vein * environment.nebula.vein[2],
                255
            ];
        },
        true
    );
    const planet = texture(
        device,
        'Gas giant turbulent bands',
        1024,
        512,
        (u, v) => {
            const n = fbm(u * 20, v * 40),
                warp = Math.sin(u * 28 + v * 33) * 0.005 + Math.sin(u * 9 + v * 17) * 0.009;
            const band = Math.sin((v + warp) * 110 + n * 2.2) * 0.5 + 0.5,
                fine = Math.sin((v + warp) * 390 + n * 4) * 0.5 + 0.5;
            const storm = Math.exp(-Math.pow((u - 0.64) * 26, 2) - Math.pow((v - 0.58) * 36, 2));
            return [
                40 + band * 44 + n * 24 + storm * 35,
                39 + band * 38 + n * 26,
                67 + band * 60 + fine * 8 + n * 20,
                255
            ];
        },
        true
    );
    const rock = texture(
        device,
        'Meteoritic mineral strata',
        256,
        256,
        (u, v) => {
            const n = fbm(u * 12, v * 12),
                grain = hash(u * 200, v * 200),
                crack = Math.pow(Math.abs(Math.sin(u * 47 + Math.sin(v * 31) * 2)), 0.1);
            const c = (0.43 + n * 0.63 + grain * 0.12) * crack;
            return [104 * c, 107 * c, 119 * c, 255];
        },
        true
    );
    const rings = texture(device, 'Ice and dust ring bands', 512, 8, (u) => {
        const gap = u > 0.55 && u < 0.61 ? 0.08 : 1,
            band = 0.25 + hash(Math.floor(u * 270), 7) * 0.5 + Math.sin(u * 133) * 0.1;
        return [119 + band * 65, 111 + band * 65, 153 + band * 55, (0.1 + band * 0.55) * 255 * gap];
    });
    const glow = texture(device, 'Soft plasma falloff', 128, 128, (u, v) => {
        const r = Math.hypot(u * 2 - 1, v * 2 - 1);
        return [255, 255, 255, Math.max(0, Math.pow(1 - Math.min(1, r), 2)) * 255];
    });
    const halo = texture(device, 'Atmospheric limb', 256, 256, (u, v) => {
        const r = Math.hypot(u * 2 - 1, v * 2 - 1);
        return [120, 170, 255, Math.exp(-Math.pow((r - 0.86) * 19, 2)) * 80];
    });
    const rockNormal = texture(
        device,
        'Regolith micro relief',
        256,
        256,
        (u, v) => {
            const dx = (fbm((u + 0.004) * 12, v * 12) - fbm((u - 0.004) * 12, v * 12)) * 3,
                dy = (fbm(u * 12, (v + 0.004) * 12) - fbm(u * 12, (v - 0.004) * 12)) * 3;
            const inv = 1 / Math.sqrt(1 + dx * dx + dy * dy);
            return [128 - dx * inv * 127, 128 - dy * inv * 127, 128 + inv * 127, 255];
        },
        true,
        false
    );
    return { nebula, planet, rock, rockNormal, rings, glow, halo };
}
