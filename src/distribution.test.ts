import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
});
it('retains all supplied models in local builds', async () => {
    vi.stubEnv('MODE', 'production');
    const policy = await import('./distribution');
    expect(policy.AVAILABLE_SHIPS).toEqual(['classic', 'surveyor', 'ptah']);
    expect(policy.VOYAGE_AVAILABLE).toBe(true);
    expect(policy.modelAvailable('ptah')).toBe(true);
});
it('excludes uncleared models in public builds while retaining approved ships', async () => {
    vi.stubEnv('MODE', 'public-release');
    const policy = await import('./distribution');
    expect(policy.AVAILABLE_SHIPS).toEqual(['classic', 'surveyor']);
    expect(policy.VOYAGE_AVAILABLE).toBe(false);
    expect(policy.modelAvailable('ptah')).toBe(false);
    expect(policy.modelAvailable('voyage')).toBe(false);
    expect(policy.modelAvailable('surveyor')).toBe(true);
});
