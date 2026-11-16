import { defineConfig } from '@playwright/test';

import base from './playwright.config';
export default defineConfig({ ...base, testIgnore: [], testMatch: '**/thumbnail.spec.ts', workers: 1 });
