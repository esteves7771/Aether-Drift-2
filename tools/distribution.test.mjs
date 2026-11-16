import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { test, expect } from 'vitest';

import { RESTRICTED_ASSETS, verifyDistribution } from './check-distribution.mjs';

test('public output guard rejects each restricted asset rather than trusting a manifest', () => {
    const scratch = path.resolve('.local-tools');
    fs.mkdirSync(scratch, { recursive: true });
    const dir = fs.mkdtempSync(path.join(scratch, 'distribution-test-'));
    try {
        fs.writeFileSync(
            path.join(dir, 'release-assets.json'),
            JSON.stringify({ playableShips: ['classic', 'surveyor'], spaceVoyage: false, excluded: RESTRICTED_ASSETS })
        );
        expect(() => verifyDistribution(dir)).not.toThrow();
        for (const file of RESTRICTED_ASSETS) {
            const target = path.join(dir, file);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, 'test marker');
            expect(() => verifyDistribution(dir)).toThrow('Uncleared asset');
            fs.unlinkSync(target);
        }
    } finally {
        assert.equal(path.dirname(dir), scratch);
        assert.ok(path.basename(dir).startsWith('distribution-test-'));
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
