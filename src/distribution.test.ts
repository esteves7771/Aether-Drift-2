import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
});
for (const mode of ['production', 'public-release'])
    it('keeps the complete three-ship roster in ' + mode, async () => {
        vi.stubEnv('MODE', mode);
        expect((await import('./distribution')).AVAILABLE_SHIPS).toEqual(['classic', 'surveyor', 'ptah']);
    });
