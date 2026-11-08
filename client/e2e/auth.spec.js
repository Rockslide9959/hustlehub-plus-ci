import { test, expect } from '@playwright/test';
import { mockLogin } from './helpers.js';

test.describe('authentication flow', () => {
  test('shows validation errors when the form is submitted empty', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Email is required.')).toBeVisible();
    await expect(page.getByText('Password is required.')).toBeVisible();
  });

  test('rejects wrong credentials with a friendly message', async ({ page }) => {
    await mockLogin(page);
    await page.goto('/login');
    await page.getByLabel('Email').fill('sipho@example.com');
    await page.getByLabel('Password').fill('WrongPass1');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('alert')).toContainText('Invalid email or password.');
  });

  test('logs in and lands on the dashboard', async ({ page }) => {
    await mockLogin(page);
    await page.goto('/login');
    await page.getByLabel('Email').fill('Sipho@Example.com');
    await page.getByLabel('Password').fill('Secure123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome, Sipho Dlamini' })).toBeVisible();
  });

  test('the session lives in sessionStorage, not localStorage', async ({ page }) => {
    await mockLogin(page);
    await page.goto('/login');
    await page.getByLabel('Email').fill('sipho@example.com');
    await page.getByLabel('Password').fill('Secure123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome, Sipho Dlamini' })).toBeVisible();
    const local = await page.evaluate(() => localStorage.length);
    const session = await page.evaluate(() => sessionStorage.getItem('hustlehub.session'));
    expect(local).toBe(0);
    expect(session).not.toBeNull();
  });
});
