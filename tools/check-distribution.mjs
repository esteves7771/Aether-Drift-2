import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Neither archive establishes the underlying redistribution rights. Keep the gate closed.
export const RESTRICTED_ASSETS = ['models/ptah.glb', 'images/menu-ptah.webp', 'models/space-voyage.glb'];
export function verifyDistribution(directory) {
    for (const file of RESTRICTED_ASSETS)
        assert.ok(!fs.existsSync(path.join(directory, file)), 'Uncleared asset in public build: ' + file);
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'release-assets.json'), 'utf8'));
    assert.deepEqual(manifest.excluded, RESTRICTED_ASSETS);
    assert.deepEqual(manifest.playableShips, ['classic', 'surveyor']);
    assert.equal(manifest.spaceVoyage, false);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    verifyDistribution(path.resolve('dist'));
    console.log('Distribution gate passed: PTAH, its thumbnail and Space Voyage are excluded.');
}
