/* Cau hinh Playwright cho cac bai kiem thu giao dien end-to-end. */
import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './test/e2e', timeout: 15_000, use: { baseURL: 'http://127.0.0.1:3000', headless: true } });
