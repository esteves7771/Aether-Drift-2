import { defineConfig } from '@playwright/test';

import base from './playwright.boss-foundation.config';
export default defineConfig({
    ...base,
    testMatch: '**/phase5i.spec.ts',
    use: { ...base.use, baseURL: 'http://127.0.0.1:5193' },
    webServer: {
        command: 'node tools/phase4-browser-build.mjs --serve --port=5193',
        port: 5193,
        reuseExistingServer: false
    }
});
