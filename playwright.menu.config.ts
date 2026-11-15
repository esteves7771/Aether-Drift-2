import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    testMatch: ['**/menu.spec.ts', '**/cinematic-pages.spec.ts'],
    workers: 1,
    timeout: 180000,
    use: {
        baseURL: 'http://127.0.0.1:5185/Aether-Drift-2/',
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
            args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader']
        }
    },
    webServer: {
        command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5185 --base=/Aether-Drift-2/',
        port: 5185,
        reuseExistingServer: false
    }
});
