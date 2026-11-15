import { defineConfig } from '@playwright/test';

import base from './playwright.boss-foundation.config';
export default defineConfig({ ...base, testMatch: '**/combat-evolution.spec.ts' });
