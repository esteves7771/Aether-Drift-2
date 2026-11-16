import { defineConfig } from '@playwright/test';
export default defineConfig({
    testDir: './tests',
    testIgnore: [
        '**/phase5i.spec.ts',
        '**/thumbnail.spec.ts',
        '**/phase4.spec.ts',
        '**/boss-foundation.spec.ts',
        '**/combat-evolution.spec.ts',
        '**/living-voyage.spec.ts',
        '**/arcade.spec.ts',
        '**/fleet.spec.ts',
        '**/frontier.spec.ts',
        '**/guardian.spec.ts',
        '**/models.spec.ts',
        '**/living.spec.ts',
        '**/thrusters.spec.ts',
        '**/menu.spec.ts',
        '**/evolution-space.spec.ts',
        '**/evolution-benchmark.spec.ts',
        '**/cinematic.spec.ts',
        '**/cinematic-pages.spec.ts'
    ],
    timeout: 60000,
    use: {
        baseURL: 'http://127.0.0.1:5180',
        viewport: { width: 1440, height: 900 },
        launchOptions: {
            args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader']
        }
    },
    webServer: {
        command: 'node node_modules/vite/bin/vite.js preview --host 0.0.0.0 --port 5180',
        port: 5180,
        reuseExistingServer: true
    }
});
