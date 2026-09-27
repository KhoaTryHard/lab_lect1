import { test, expect } from '@playwright/test';

const invalid = { fullName: 'Nguyễn Văn A', email: 'broken', password: 'password1', confirmPassword: 'password1' };
const valid = { fullName: 'Nguyễn Văn A', email: `e2e-${Date.now()}@example.test`, password: 'password1', confirmPassword: 'password1' };

async function fill(page, value) {
  await page.locator('[data-field="fullName"]').fill(value.fullName);
  await page.locator('[data-field="email"]').fill(value.email);
  await page.locator('[data-field="password"]').fill(value.password);
  await page.locator('[data-field="confirmPassword"]').fill(value.confirmPassword);
}

test('local validation blocks malformed data before the network', async ({ page }) => {
  await page.goto('/?rtt=500');
  await page.locator('input[value="client"]').check();
  await fill(page, invalid);
  const requests = page.waitForRequest(/\/api\/register/, { timeout: 1000 }).catch(() => null);
  await page.locator('#submit-button').click();
  expect(await requests).toBeNull();
  await expect(page.locator('[data-error-for="email"]')).toContainText('định dạng');
  await expect(page.locator('#result')).toHaveAttribute('data-outcome', 'client-validation-error');
});

test('server mode sends valid data and reports success', async ({ page }) => {
  await page.goto('/');
  await fill(page, valid);
  await page.locator('#submit-button').click();
  await expect(page.locator('#result')).toHaveAttribute('data-outcome', 'success');
});
