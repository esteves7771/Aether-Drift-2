import { Entity } from 'playcanvas';
import type { GraphicsDevice } from 'playcanvas';

import { ModelBuilder, emission, surface } from './art-kit';
import type { EnemyKind } from './combat-config';
export class SpacecraftArt {
    readonly armor = surface('Ceramic titanium', '#9facbd', 0.65, 0.72);
    readonly carbon = surface('Carbon composite', '#111f35', 0.4, 0.43);
    readonly trim = surface('Machined graphite', '#38455b', 0.8, 0.7);
    readonly glass = surface('Polarized canopy', '#16466a', 0.88, 0.95);
    readonly interceptor = surface('Interceptor violet alloy', '#75608c', 0.55, 0.64);
    readonly heavy = surface('Heavy burnt titanium', '#99705f', 0.6, 0.6);
    readonly cyan = emission('Ion conduits', '#58e8ff', 2.4);
    readonly hostile = emission('Hostile ion drive', '#ff608e', 2.4);
    readonly warning = emission('Warning amber', '#ffb35d', 0.8);
    readonly flash = emission('Armor impact', '#d4f7ff', 2);
    private readonly templates = new Map<string, Entity>();
    private readonly device: GraphicsDevice;
    constructor(device: GraphicsDevice) {
        this.device = device;
    }
    create(kind: 'player' | EnemyKind) {
        let template = this.templates.get(kind);
        if (!template) {
            template = this.build(kind);
            this.templates.set(kind, template);
        }
        return template.clone();
    }
    private build(kind: 'player' | EnemyKind) {
        if (kind === 'bomber' || kind === 'carrier' || kind === 'drone') return this.buildFleet(kind);
        const b = new ModelBuilder(),
            player = kind === 'player',
            heavy = kind === 'heavy',
            hull = player ? this.armor : heavy ? this.heavy : this.interceptor,
            glow = player ? this.cyan : this.hostile;
        const width = heavy ? 1.45 : 0.73;
        b.hull(this.carbon, [
            [-3, 0.16, 0, 0.12],
            [-1.8, width * 0.9, 0, 0.3],
            [0.7, width * 1.15, 0, 0.46],
            [2.45, width * 0.8, 0, 0.36]
        ]);
        b.hull(hull, [
            [-3.25, 0.08, 0.1, 0.08],
            [-1.2, width, 0.15, 0.3],
            [0.8, width * 0.9, 0.2, 0.38],
            [2.1, width * 0.7, 0.16, 0.25]
        ]);
        b.hull(this.glass, [
            [-1.65, 0.15, 0.46, 0.06],
            [-0.8, 0.43, 0.58, 0.28],
            [0.35, 0.37, 0.62, 0.27],
            [0.6, 0.2, 0.51, 0.08]
        ]);
        b.box(this.trim, [0, 0.96, -0.28], [0.05, 0.05, 1.25]);
        for (const side of [-1, 1]) {
            const outline = heavy
                ? [
                      [side * 0.9, -1.4],
                      [side * 3.8, -0.7],
                      [side * 4.3, 2.3],
                      [side * 1.0, 2.5]
                  ]
                : player
                  ? [
                        [side * 0.65, -1.2],
                        [side * 2.8, 0.1],
                        [side * 3.45, 2.05],
                        [side * 1.45, 1.7]
                    ]
                  : [
                        [side * 0.6, -1.5],
                        [side * 3.65, 1.25],
                        [side * 2.8, 2.1],
                        [side * 1.0, 1.5]
                    ];
            b.plate(this.carbon, outline, -0.3, heavy ? 0.1 : -0.05);
            b.plate(
                hull,
                outline.map(([x, z]) => [x * 0.94, z * 0.93]),
                -0.06,
                heavy ? 0.25 : 0.08
            );
            b.plate(
                this.trim,
                [
                    [side * 1.65, 0.3],
                    [side * 2.8, 1.2],
                    [side * 2.95, 1.7],
                    [side * 1.65, 1.35]
                ],
                0.1,
                0.14
            );
            b.box(
                glow,
                [side * (heavy ? 3.75 : 2.95), heavy ? 0.26 : 0.11, 1.55],
                [0.08, 0.07, 0.62],
                [0, side * -25, 0]
            );
            // Original player drive and gun attachment coordinates are retained.
            const engineX = side * (heavy ? 1.6 : 1.05),
                engineZ = heavy ? 2.25 : 1.7;
            b.plate(
                hull,
                [
                    [engineX - 0.35, engineZ - 1.1],
                    [engineX + 0.35, engineZ - 1.1],
                    [engineX + 0.56, engineZ + 0.5],
                    [engineX - 0.56, engineZ + 0.5]
                ],
                -0.35,
                0.36
            );
            // Engine pod geometry is translated before merging to keep a single draw per material.
            b.box(this.carbon, [engineX, -0.12, engineZ], [0.9, 0.8, 1.9]);
            b.cylinder(this.trim, [engineX, -0.1, engineZ + 0.75], [1.06, 0.85, 1.06]);
            b.cylinder(this.carbon, [engineX, -0.1, engineZ + 1.0], [0.82, 0.2, 0.82]);
            b.cylinder(glow, [engineX, -0.1, engineZ + 1.12], [0.59, 0.03, 0.59]);
            for (let j = 0; j < 4; j++)
                b.box(this.trim, [engineX, -0.1, engineZ + 1.14], [0.035, 0.65, 0.04], [0, 0, j * 45]);
            const gunX = side * (heavy ? 2.5 : player ? 1.35 : 1.8);
            b.box(this.trim, [gunX, -0.12, -1.55], [0.43, 0.36, 1.9]);
            b.cylinder(this.carbon, [gunX, -0.12, -2.45], [0.28, 0.65, 0.28]);
            b.cylinder(glow, [gunX, -0.12, -2.79], [0.14, 0.025, 0.14]);
            for (let j = 0; j < (heavy ? 5 : 3); j++)
                b.box(
                    this.carbon,
                    [side * (heavy ? 1.15 : 0.55), 0.61, 0.65 + j * 0.23],
                    [0.32, 0.045, 0.1],
                    [0, side * 15, 0]
                );
            b.box(this.warning, [side * 1.82, 0.15, 0.55], [0.25, 0.025, 0.1], [0, side * -25, 0]);
            b.box(hull, [side * 0.48, 0.91, 1.15], [0.12, 0.85, 1.0], [0, 0, side * -22]);
            if (heavy)
                for (let j = 0; j < 3; j++)
                    b.box(hull, [side * 2.85, 0.38, -0.2 + j * 0.65], [1.65, 0.28, 0.48], [0, side * 8, 0]);
        }
        b.box(glow, [0, 0.64, 1.46], [0.18, 0.06, 0.75]);
        if (!player) {
            for (const x of heavy ? [0, 2] : [0]) {
                const tip = heavy ? -6.8 : -4.8;
                b.box(this.trim, [x, 0, (tip - 2.2) / 2], [heavy ? 0.45 : 0.23, heavy ? 0.42 : 0.2, -tip - 2.2]);
                b.cylinder(glow, [x, 0, tip + 0.03], [heavy ? 0.22 : 0.12, 0.04, heavy ? 0.22 : 0.12]);
            }
        }
        const model = b.finish(this.device, kind === 'player' ? 'Fuselage' : heavy ? 'Heavy fighter' : 'Interceptor');
        if (player)
            for (const side of [-1, 1]) {
                const mount = new Entity(side < 0 ? 'Weapon mount left' : 'Weapon mount right');
                mount.setLocalPosition(side * 1.35, -0.12, -2.8);
                model.addChild(mount);
            }
        return model;
    }
    private buildFleet(kind: 'bomber' | 'carrier' | 'drone') {
        const b = new ModelBuilder(),
            h = kind === 'bomber' ? this.heavy : kind === 'carrier' ? this.armor : this.interceptor;
        if (kind === 'drone') {
            b.hull(h, [
                [-2, 0.15, 0, 0.1],
                [-0.5, 0.8, 0, 0.35],
                [1.5, 0.55, 0, 0.25]
            ]);
            for (const side of [-1, 1]) {
                b.plate(
                    this.carbon,
                    [
                        [side * 0.5, -1],
                        [side * 2, 0.2],
                        [side * 1.6, 1.2],
                        [side * 0.4, 0.8]
                    ],
                    -0.1,
                    0.15
                );
                b.box(this.hostile, [side * 1.4, 0.1, 0.65], [0.3, 0.15, 0.65]);
            }
            b.cylinder(this.hostile, [0, 0, 1.6], [0.7, 0.1, 0.7]);
        } else if (kind === 'bomber') {
            b.hull(this.carbon, [
                [-7, 1.2, 0, 0.6],
                [-3, 3, 0, 1],
                [3, 3.5, 0, 1.2],
                [6, 2.6, 0, 0.9]
            ]);
            b.hull(h, [
                [-6.6, 1, 1, 0.4],
                [-2, 2.5, 1, 1],
                [4, 2.8, 1, 0.8]
            ]);
            b.box(this.glass, [0, 2, -3], [2, 0.6, 2]);
            for (const side of [-1, 1]) {
                b.plate(
                    h,
                    [
                        [side * 2, -3],
                        [side * 7.5, -1],
                        [side * 8, 5],
                        [side * 2.5, 4]
                    ],
                    -0.5,
                    0.6
                );
                b.box(this.trim, [side * 5.5, -0.4, -1], [3.1, 2, 7]);
                for (const x of [-0.7, 0.7])
                    for (const y of [-0.45, 0.45])
                        b.cylinder(this.warning, [side * 5.5 + x, y - 0.4, -4.6], [0.6, 0.2, 0.6]);
                b.box(this.carbon, [side * 3.5, 0, 4], [2, 2, 4]);
                b.cylinder(this.hostile, [side * 3.5, 0, 6.1], [1.5, 0.15, 1.5]);
                b.box(this.warning, [side * 7, 0.7, 2], [0.2, 0.2, 2]);
            }
        } else {
            b.hull(h, [
                [-7, 1, 0, 0.4],
                [-3, 2.5, 0, 1],
                [4, 2.5, 0, 1.3],
                [8, 1.5, 0, 0.7]
            ]);
            b.box(this.glass, [0, 2, -2], [2, 0.6, 3]);
            for (const side of [-1, 1]) {
                b.box(h, [side * 5, 0, 0], [2.5, 2, 13]);
                b.box(this.trim, [side * 3.5, -0.8, 0], [3, 2, 8]);
                b.box(this.cyan, [side * 3.5, 0.3, 0], [2.5, 0.2, 6]);
                for (let z = -3; z <= 3; z += 2) b.box(this.trim, [side * 3.5, 0.45, z], [3, 0.3, 0.2]);
                b.cylinder(this.hostile, [side * 5, 0, 6.7], [1.8, 0.3, 1.8]);
                b.box(this.warning, [side * 6.3, 1, 2], [0.2, 0.15, 3]);
            }
        }
        return b.finish(
            this.device,
            kind === 'bomber' ? 'Heavy bomber' : kind === 'carrier' ? 'Drone carrier' : 'Combat drone'
        );
    }
    destroy() {
        for (const e of this.templates.values()) e.destroy();
        for (const m of [
            this.armor,
            this.carbon,
            this.trim,
            this.glass,
            this.interceptor,
            this.heavy,
            this.cyan,
            this.hostile,
            this.warning,
            this.flash
        ])
            m.destroy();
    }
}
