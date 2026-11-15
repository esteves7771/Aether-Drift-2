import { defineConfig } from '@playwright/test';

import base from './playwright.config';

export default defineConfig({
    ...base,
    testIgnore: [],
    testMatch: [
        '**/phase4.spec.ts',
        '**/arcade.spec.ts',
        '**/fleet.spec.ts',
        '**/frontier.spec.ts',
        '**/guardian.spec.ts',
        '**/models.spec.ts',
        '**/living.spec.ts',
        '**/thrusters.spec.ts',
        '**/evolution-space.spec.ts',
        '**/cinematic.spec.ts'
    ],
    webServer: {
        command: 'node tools/phase4-browser-build.mjs --serve',
        port: 5181,
        reuseExistingServer: !process.env.CI
    }
});
