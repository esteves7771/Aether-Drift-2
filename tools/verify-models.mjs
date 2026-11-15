import assert from 'node:assert/strict';
import fs from 'node:fs';
const names = [
    'spaceship-free-001',
    'spaceship',
    'futuristic-sci-fi-spaceship',
    'alien-flying-saucer',
    'iss',
    'sci-fi-space-station',
    'sci-fi-box',
    'turret',
    'tesser',
    'astronaut'
];
for (const name of names) {
    const b = fs.readFileSync(new URL('../public/models/' + name + '.glb', import.meta.url));
    assert.equal(b.readUInt32LE(0), 0x46546c67);
    const g = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
    let triangles = 0;
    for (const mesh of g.meshes)
        for (const p of mesh.primitives) {
            assert.ok(p.attributes.NORMAL !== undefined, name + ' normals');
            triangles += g.accessors[p.indices ?? p.attributes.POSITION].count / 3;
        }
    assert.ok(triangles > 500 && triangles < (name === 'astronaut' ? 60000 : 30000), name + ' triangle budget');
    assert.ok(g.materials.length <= 5, name + ' draw budget');
    assert.ok(
        g.buffers.every((b) => !b.uri),
        name + ' embedded buffer'
    );
    assert.ok(
        (g.images ?? []).every((i) => i.bufferView !== undefined),
        name + ' embedded images'
    );
    assert.ok(!(g.extensionsRequired ?? []).includes('KHR_draco_mesh_compression'), name + ' no runtime decoder');
    assert.ok(b.byteLength < (name === 'astronaut' ? 12 : 6) * 1024 * 1024, name + ' download budget');
    console.log(
        name + ': ' + triangles + ' triangles / ' + g.materials.length + ' material draws / ' + b.byteLength + ' bytes'
    );
}
