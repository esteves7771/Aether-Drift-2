import path from 'node:path';

import { verifyDistribution } from './tools/check-distribution.mjs';

/** Package the same complete assets as local builds, plus a release inventory. */
export function publicAssets() {
    let output;
    let publishing = false;
    return {
        name: 'complete-public-assets',
        apply: 'build',
        configResolved(config) {
            publishing = config.mode === 'public-release';
            output = path.resolve(config.root, config.build.outDir);
        },
        generateBundle() {
            if (!publishing) return;
            this.emitFile({
                type: 'asset',
                fileName: 'release-assets.json',
                source: JSON.stringify({
                    playableShips: ['classic', 'surveyor', 'ptah'],
                    spaceVoyage: true,
                    excluded: []
                })
            });
        },
        closeBundle() {
            if (publishing) verifyDistribution(output);
        }
    };
}
