import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { test, expect } from 'vitest';

import { REQUIRED_PHASE5H_ASSETS, verifyDistribution } from './check-distribution.mjs';
test('full release requires every Phase 5H asset', () => {
    const scratch = path.resolve('.local-tools');
    const dir = fs.mkdtempSync(path.join(scratch, 'distribution-test-'));
    try {
        fs.writeFileSync(
            path.join(dir, 'release-assets.json'),
            JSON.stringify({ playableShips: ['classic', 'surveyor', 'ptah'], spaceVoyage: true, excluded: [] })
        );
        for (const file of REQUIRED_PHASE5H_ASSETS) {
            const target = path.join(dir, file);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, Buffer.alloc(1024));
        }
        expect(() => verifyDistribution(dir)).not.toThrow();
        for (const file of REQUIRED_PHASE5H_ASSETS) {
            fs.unlinkSync(path.join(dir, file));
            expect(() => verifyDistribution(dir)).toThrow();
            fs.writeFileSync(path.join(dir, file), Buffer.alloc(1024));
        }
    } finally {
        assert.equal(path.dirname(dir), scratch);
        assert.ok(path.basename(dir).startsWith('distribution-test-'));
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
