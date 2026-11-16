import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Verify completeness of the user-authorized full release; preserve provenance separately.
export const REQUIRED_PHASE5H_ASSETS = ['models/ptah.glb', 'images/menu-ptah.webp', 'models/space-voyage.glb'];
export function verifyDistribution(directory) {
    for (const file of REQUIRED_PHASE5H_ASSETS)
        assert.ok(fs.statSync(path.join(directory, file)).size > 1000, 'Missing Phase 5H asset: ' + file);
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'release-assets.json'), 'utf8'));
    assert.deepEqual(manifest.excluded, []);
    assert.deepEqual(manifest.playableShips, ['classic', 'surveyor', 'ptah']);
    assert.equal(manifest.spaceVoyage, true);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    verifyDistribution(path.resolve('dist'));
    console.log('Full Phase 5H verified: PTAH, its thumbnail and Space Voyage are included.');
}
