import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { RESTRICTED_ASSETS, verifyDistribution } from './tools/check-distribution.mjs';

/** Filter before Vite copies public assets, then enforce the same gate on the completed output. */
export function publicAssets() {
    let staged;
    let output;
    let scratch;
    return {
        name: 'verified-public-assets',
        apply: 'build',
        config(config, { mode }) {
            if (mode !== 'public-release') return;
            const root = path.resolve(config.root ?? '.');
            scratch = path.join(root, '.local-tools');
            fs.mkdirSync(scratch, { recursive: true });
            staged = fs.mkdtempSync(path.join(scratch, 'public-release-'));
            const source = path.join(root, 'public');
            fs.cpSync(source, staged, {
                recursive: true,
                filter: (file) => !RESTRICTED_ASSETS.includes(path.relative(source, file).replaceAll('\\', '/'))
            });
            fs.writeFileSync(
                path.join(staged, 'release-assets.json'),
                JSON.stringify({
                    playableShips: ['classic', 'surveyor'],
                    spaceVoyage: false,
                    excluded: RESTRICTED_ASSETS
                })
            );
            return { publicDir: staged };
        },
        configResolved(config) {
            output = path.resolve(config.root, config.build.outDir);
        },
        closeBundle() {
            if (!staged) return;
            try {
                verifyDistribution(output);
            } finally {
                // Only remove the exact temporary directory created above, inside this workspace's scratch root.
                assert.equal(path.dirname(path.resolve(staged)), path.resolve(scratch));
                assert.ok(path.basename(staged).startsWith('public-release-'));
                fs.rmSync(staged, { recursive: true, force: true });
            }
        }
    };
}
