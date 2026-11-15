import { Entity, Layer, Mesh, MeshInstance, SORTMODE_MANUAL, SphereGeometry } from 'playcanvas';
import type { AppBase, RenderComponent, Texture } from 'playcanvas';

import { emission, surface } from './art-kit';
import { CINEMATIC } from './cinematic-config';
import type { GraphicsQuality } from './config';

/** Explicit background pass avoids stars painting over nearer celestial geometry. */
export function cinematicSpace(app: AppBase, stars: Entity, environment: Entity, nebula: Texture, rock: Texture) {
    const layer = new Layer({
        name: 'Deep space / no translation parallax',
        opaqueSortMode: SORTMODE_MANUAL,
        transparentSortMode: SORTMODE_MANUAL
    });
    app.scene.layers.insertOpaque(layer, 0);
    app.scene.layers.insertTransparent(layer, 1);
    const veilMat = emission('Subtle molecular veil', '#7064a0', 0.35, 0.12);
    veilMat.emissiveMap = nebula;
    veilMat.depthTest = false;
    veilMat.update();
    const veil = new Entity('Deep violet molecular veil');
    const sphere = Mesh.fromGeometry(app.graphicsDevice, new SphereGeometry({ latitudeBands: 20, longitudeBands: 36 }));
    veil.addComponent('render', { meshInstances: [new MeshInstance(sphere, veilMat, veil)], layers: [layer.id] });
    veil.setLocalScale(7800, 7800, 7800);
    veil.setLocalEulerAngles(26, 81, -22);
    environment.addChild(veil);
    for (const e of [environment, stars])
        for (const c of e.findComponents('render')) {
            const render = c as RenderComponent;
            render.layers = [layer.id];
            for (const mi of render.meshInstances) mi.drawOrder = e === stars ? 10 : 0;
        }
    const geometry = Mesh.fromGeometry(
        app.graphicsDevice,
        new SphereGeometry({ latitudeBands: 28, longitudeBands: 40 })
    );
    const materials = CINEMATIC.bodies.map((b) => {
        const m = surface(b.name, b.color, 0, 0.08);
        m.useSkybox = false;
        m.diffuseMap = rock;
        m.update();
        return m;
    });
    const bodies = CINEMATIC.bodies.map((b, i) => {
        const e = new Entity(b.name);
        e.addComponent('render', { meshInstances: [new MeshInstance(geometry, materials[i], e)] });
        e.setPosition(b.position[0], b.position[1], b.position[2]);
        e.setLocalScale(b.radius, b.radius, b.radius);
        e.setLocalEulerAngles(i * 17, 31 + i * 77, 12);
        app.root.addChild(e);
        return e;
    });
    return {
        layer,
        bodies,
        setQuality(q: GraphicsQuality) {
            veil.enabled = q === 'high';
            bodies[2].enabled = q === 'high';
        },
        destroy() {
            for (const b of bodies) b.destroy();
            veil.destroy();
            sphere.destroy();
            geometry.destroy();
            for (const m of materials) m.destroy();
            veilMat.destroy();
            app.scene.layers.remove(layer);
        }
    };
}
