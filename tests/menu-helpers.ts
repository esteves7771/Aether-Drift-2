import type { Page } from '@playwright/test';
export async function openSettings(page: Page) {
    if (!(await page.locator('#settings-panel').isVisible())) await page.locator('#show-settings').click();
}
export async function launchPatrol(page: Page) {
    if (await page.locator('#settings-panel').isVisible()) await page.locator('#menu-back').click();
    await page.locator('#launch').click();
}
