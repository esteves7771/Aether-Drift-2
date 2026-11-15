import { defineConfig } from '@playwright/test';

import base from './playwright.config';
const baseline = process.env.AE_BASELINE === '1';
export default defineConfig({
    ...base,
    workers: 1,
    testIgnore: [],
    testMatch: baseline
        ? '**/evolution-benchmark.spec.ts'
        : ['**/evolution-space.spec.ts', '**/evolution-benchmark.spec.ts', '**/menu.spec.ts'],
    use: { ...base.use, baseURL: 'http://127.0.0.1:' + (baseline ? 5188 : 5187) },
    webServer: {
        command:
            'node tools/phase4-browser-build.mjs --serve --port=' +
            (baseline ? 5188 : 5187) +
            (baseline ? ' --baseline' : ''),
        port: baseline ? 5188 : 5187,
        reuseExistingServer: true
    }
});
