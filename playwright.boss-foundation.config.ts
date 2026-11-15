import { defineConfig } from '@playwright/test';

import base from './playwright.config';
export default defineConfig({
    ...base,
    workers: 1,
    timeout: 180000,
    testIgnore: [],
    testMatch: '**/boss-foundation.spec.ts',
    use: { ...base.use, baseURL: 'http://127.0.0.1:5191' },
    webServer: {
        command: 'node tools/phase4-browser-build.mjs --serve --port=5191',
        port: 5191,
        reuseExistingServer: false
    }
});
