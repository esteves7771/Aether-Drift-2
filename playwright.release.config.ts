import { defineConfig } from '@playwright/test';

const remote = process.env.RELEASE_URL;
export default defineConfig({
    testDir: './tests',
    testMatch: '**/release.spec.ts',
    workers: 1,
    timeout: 180000,
    use: {
        baseURL: remote ?? 'http://127.0.0.1:5184/Aether-Drift-2/',
        viewport: { width: 1440, height: 900 },
        launchOptions: {
            args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader']
        }
    },
    webServer: remote
        ? undefined
        : {
              command: 'node node_modules/vite/bin/vite.js preview --host 0.0.0.0 --port 5184 --base=/Aether-Drift-2/',
              port: 5184,
              reuseExistingServer: false
          }
});
