import { test, expect } from '@playwright/test';

// Frontend Content Security Policy (Part 2 feedback). The preview server sends
// the same headers as Nginx in Docker (see vite.config.js and nginx.conf).

test.describe('Frontend security headers', () => {
  test('the app is served with a strict Content Security Policy', async ({ page }) => {
    const response = await page.goto('/login');
    const headers = response.headers();
    const csp = headers['content-security-policy'];

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
  });

  test('the app works under the policy without any violations', async ({ page }) => {
    const violations = [];
    page.on('console', (message) => {
      if (/Content Security Policy/i.test(message.text())) {
        violations.push(message.text());
      }
    });

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible();

    expect(violations).toEqual([]);
  });
});
