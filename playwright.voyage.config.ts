import { defineConfig } from '@playwright/test';

import base from './playwright.boss-foundation.config';
export default defineConfig({
    ...base,
    testMatch: '**/living-voyage.spec.ts',
    use: { ...base.use, baseURL: 'http://127.0.0.1:5192' },
    webServer: {
        command: 'node tools/phase4-browser-build.mjs --serve --port=5192',
        port: 5192,
        reuseExistingServer: false
    }
});
