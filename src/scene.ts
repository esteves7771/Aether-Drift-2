import { BLEND_NORMAL, Color, Entity, EnvLighting, Mesh, MeshInstance, SphereGeometry, Vec3 } from 'playcanvas';
import type { AppBase } from 'playcanvas';

import { emission, surface, validateRenderAttributes } from './art-kit';
import { AsteroidField, asteroidGeometry, loadRockMaps } from './asteroid-art';
import type { Rock } from './collisions';
import type { GraphicsQuality } from './config';
import { PERSEID } from './environment';
import type { EnvironmentDefinition } from './environment';
import { PlayerThrusters } from './player-thrusters';
import { hash, spaceTextures, texture } from './procedural-textures';
import { SpacecraftArt } from './spacecraft-art';
export function buildScene(app: AppBase, rocks: Rock[], definition: EnvironmentDefinition = PERSEID) {
    const device = app.graphicsDevice,
        art = new SpacecraftArt(device),
        textures = spaceTextures(device, definition);
    app.scene.clusteredLightingEnabled = false;
    app.scene.ambientLight = new Color(0.12, 0.16, 0.23);
    const key = new Entity('Starlight');
    key.addComponent('light', { type: 'directional', color: new Color(0.76, 0.87, 1), intensity: 2.6 });
    key.setEulerAngles(38, -30, 25);
    key.light!.mask = 1;
    app.root.addChild(key);
    const rim = new Entity('Magenta rim');
    rim.addComponent('light', { type: 'directional', color: new Color(0.57, 0.35, 0.85), intensity: 1.4 });
    rim.setEulerAngles(-25, 140, 0);
    rim.light!.mask = 2;
    app.root.addChild(rim);
    const fill = new Entity('Blue bounce');
    fill.addComponent('light', { type: 'directional', color: new Color(0.23, 0.51, 0.8), intensity: 0.45 });
    fill.setEulerAngles(140, 25, 0);
    fill.destroy();
    const reflection = texture(
        device,
        'Studio-space reflections',
        256,
        128,
        (u, v) => {
            const broad = Math.exp(-Math.pow((v - 0.36) * 5, 2)),
                light = Math.exp(-Math.pow((u - 0.24) * 12, 2) - Math.pow((v - 0.25) * 9, 2));
            return [12 + broad * 40 + light * 190, 20 + broad * 60 + light * 185, 35 + broad * 85 + light * 170, 255];
        },
        true
    );
    const source = EnvLighting.generateLightingSource(reflection, { size: 32 });
    const atlas = EnvLighting.generateAtlas(source, { size: 128, numReflectionSamples: 32, numAmbientSamples: 64 });
    app.scene.envAtlas = atlas;
    const ship = new Entity('Ship');
    app.root.addChild(ship);
    ship.addChild(art.create('player'));
    const thrusters = new PlayerThrusters(app, ship);
    const rockMaterials = [
        surface('Nickel iron regolith', '#b8bdc7', 0, 0.22),
        surface('Carbonaceous regolith', '#7c8194', 0, 0.13),
        surface('Violet silicate', '#ac9fae', 0, 0.24)
    ];
    for (const m of rockMaterials) {
        m.diffuseMap = textures.rock;
        m.useMetalness = true;
        m.metalness = 0;
        m.useSkybox = false;
        m.bumpiness = 0.3;
        m.update();
    }
    const meshes: Mesh[][] = [[], []];
    for (let lod = 0; lod < 2; lod++)
        for (let variant = 0; variant < 6; variant++) {
            const g = asteroidGeometry(variant, lod === 1);
            meshes[lod].push(Mesh.fromGeometry(device, g));
        }
    const rockyMaps = loadRockMaps(app, rockMaterials);
    const asteroidField = new AsteroidField(app, rocks, meshes, rockMaterials);
    const stars = new Entity('Stars');
    app.root.addChild(stars);
    const starMaterial = emission('Stellar light', '#ffffff', 1.4);
    starMaterial.emissiveVertexColor = true;
    starMaterial.update();
    const extras: Entity[] = [];
    for (let layer = 0; layer < 3; layer++) {
        const positions: number[] = [],
            colors: number[] = [],
            count = layer === 0 ? 1200 : layer === 1 ? 1100 : 1500;
        for (let i = 0; i < count; i++) {
            const n = i + layer * 2000,
                angle = hash(n, 4) * Math.PI * 2;
            let y = hash(n, 5) * 2 - 1;
            if (i % 3 === 0) y = (hash(n, 6) - 0.5) * 0.35 + Math.sin(angle * 2) * 0.2;
            const r = Math.sqrt(1 - y * y),
                distance = 2800 + layer * 1200,
                dx = r * Math.cos(angle),
                dy = y,
                dz = r * Math.sin(angle),
                size = (0.8 + Math.pow(hash(n, 7), 5) * 4) * (distance / 4200);
            const tangent = new Vec3(dz, 0, -dx).normalize(),
                up = new Vec3().cross(new Vec3(dx, dy, dz), tangent).normalize();
            for (const [a, b] of [
                [-1, -0.65],
                [1, -0.65],
                [0, 1]
            ])
                positions.push(
                    dx * distance + (tangent.x * a + up.x * b) * size,
                    dy * distance + up.y * b * size,
                    dz * distance + (tangent.z * a + up.z * b) * size
                );
            const warm = hash(n, 11) > 0.86;
            for (let j = 0; j < 3; j++)
                colors.push(
                    warm ? 1 : 0.65 + hash(n, 12) * 0.25,
                    warm ? 0.8 : 0.75 + hash(n, 13) * 0.2,
                    warm ? 0.62 : 1,
                    1
                );
        }
        const mesh = new Mesh(device);
        mesh.setPositions(positions);
        mesh.setColors(colors);
        mesh.update();
        const e = layer === 0 ? stars : new Entity(`Star depth ${layer}`);
        e.addComponent('render', { meshInstances: [new MeshInstance(mesh, starMaterial, e)] });
        if (layer > 0) {
            stars.addChild(e);
            extras.push(e);
        }
    }
    const environment = new Entity('Distant space');
    app.root.addChild(environment);
    const nebulaMaterial = emission(definition.name + ' nebula', '#ffffff', 0.9);
    nebulaMaterial.emissiveMap = textures.nebula;
    nebulaMaterial.depthWrite = false;
    nebulaMaterial.update();
    const nebula = new Entity('Molecular clouds');
    nebula.addComponent('render', {
        meshInstances: [
            new MeshInstance(
                Mesh.fromGeometry(device, new SphereGeometry({ radius: 1, latitudeBands: 24, longitudeBands: 48 })),
                nebulaMaterial,
                nebula
            )
        ]
    });
    nebula.setLocalScale(8200, 8200, 8200);
    environment.addChild(nebula);
    const planetMat = surface('Banded gas giant', '#d6cbdc', 0, 0.14);
    planetMat.useSkybox = false;
    planetMat.useMetalness = false;
    planetMat.specular.set(0, 0, 0);
    planetMat.diffuseMap = textures.planet;
    planetMat.update();
    const planet = new Entity(definition.planet.name);
    planet.addComponent('render', {
        meshInstances: [
            new MeshInstance(
                Mesh.fromGeometry(device, new SphereGeometry({ radius: 1, latitudeBands: 32, longitudeBands: 48 })),
                planetMat,
                planet
            )
        ]
    });
    planet.setPosition(...definition.planet.position);
    planet.setLocalScale(definition.planet.radius, definition.planet.radius, definition.planet.radius);
    planet.setEulerAngles(0, 30, definition.planet.tilt);
    app.root.addChild(planet);
    const ringMat = emission('Ice ring scattering', '#b7b4d3', 0.6);
    ringMat.emissiveMap = textures.rings;
    ringMat.opacityMap = textures.rings;
    ringMat.opacityMapChannel = 'a';
    ringMat.blendType = BLEND_NORMAL;
    ringMat.depthWrite = false;
    ringMat.update();
    const rp: number[] = [],
        uv: number[] = [],
        ri: number[] = [];
    for (let i = 0; i < 256; i++) {
        const a = (i / 256) * Math.PI * 2,
            b = ((i + 1) / 256) * Math.PI * 2,
            base = rp.length / 3;
        for (const [r, t] of [
            [1.19, a],
            [1.93, a],
            [1.19, b],
            [1.93, b]
        ]) {
            rp.push(Math.cos(t) * r, 0, Math.sin(t) * r);
            uv.push((r - 1.19) / 0.74, t / (Math.PI * 2));
        }
        ri.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
    const ringMesh = new Mesh(device);
    ringMesh.setPositions(rp);
    ringMesh.setUvs(0, uv);
    ringMesh.setIndices(ri);
    ringMesh.update();
    const rings = new Entity('Planet rings');
    rings.addComponent('render', { meshInstances: [new MeshInstance(ringMesh, ringMat, rings)] });
    rings.setLocalEulerAngles(52, 0, 8);
    planet.addChild(rings);
    const atmosphereMat = emission('Atmospheric scattering', '#669aff', 0.8, 0.4);
    atmosphereMat.emissiveMap = textures.halo;
    atmosphereMat.opacityMap = textures.halo;
    atmosphereMat.opacityMapChannel = 'a';
    atmosphereMat.update();
    const atmosphere = new Entity('Atmospheric limb');
    const q = new Mesh(device);
    q.setPositions([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]);
    q.setUvs(0, [0, 0, 1, 0, 0, 1, 1, 1]);
    q.setIndices([0, 1, 2, 2, 1, 3]);
    q.update();
    atmosphere.addComponent('render', { meshInstances: [new MeshInstance(q, atmosphereMat, atmosphere)] });
    atmosphere.setPosition(...definition.planet.position);
    atmosphere.setLocalScale(
        definition.planet.radius * 1.184,
        definition.planet.radius * 1.184,
        definition.planet.radius * 1.184
    );
    app.root.addChild(atmosphere);
    app.batcher?.generate();
    validateRenderAttributes(app.root);
    let quality: GraphicsQuality = 'medium';
    const setQuality = (level: GraphicsQuality) => {
        if (quality === level) return;
        quality = level;
        thrusters.setQuality(level);
        rockyMaps.setQuality(level);
        extras[0].enabled = level !== 'low';
        extras[1].enabled = level === 'high';
        atmosphere.enabled = level !== 'low';
        for (const m of rockMaterials) {
            m.normalMap = level === 'low' ? null : (rockyMaps.normal ?? textures.rockNormal);
            m.update();
        }
        asteroidField.setQuality(level);
        app.batcher?.generate();
    };
    extras[1].enabled = false;
    // Materials and geometry are generated only during boot or preset changes.
    return {
        ship,
        thrusters,
        stars,
        environment,
        planet,
        planetAtmosphere: atmosphere,
        rockMeshes: meshes,
        rockMaterials,
        art,
        textures,
        setQuality,
        asteroidField,
        destroy: () => {
            asteroidField.destroy();
            for (const lod of meshes) for (const m of lod) m.destroy();
            for (const m of rockMaterials) m.destroy();
            rockyMaps.destroy();
            thrusters.destroy();
            art.destroy();
            source.destroy();
            reflection.destroy();
            atlas.destroy();
            for (const t of Object.values(textures)) t.destroy();
        }
    };
}
