import { test, expect } from '@playwright/test';
import { fakeToken } from './helpers.js';

const client = { id: 'u9', fullName: 'Client Person', email: 'c@example.com', role: 'client' };
const gig = {
  id: '665f1a2b3c4d5e6f7a8b9c02',
  title: 'React landing page build',
  description: 'A responsive landing page built in React, delivered within a week.',
  price: 2500.5,
  category: 'Development',
  isActive: true,
  freelancer: { id: 'u2', fullName: 'Naledi Khumalo' },
  createdAt: '2026-10-02T10:00:00.000Z',
};

test('a client can open a gig and book it', async ({ page }) => {
  await page.addInitScript(
    ([token, user]) => {
      sessionStorage.setItem('hustlehub.session', JSON.stringify({ token, user }));
    },
    [fakeToken({ id: client.id, role: client.role }), client]
  );
  await page.route(`**/api/gigs/${gig.id}`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: gig }) })
  );
  let posted = null;
  await page.route('**/api/bookings', (r) => {
    posted = r.request().postDataJSON();
    return r.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Booking confirmed successfully.',
        booking: { _id: 'b1', status: 'confirmed' },
        transaction: { _id: 't1', amount: gig.price, status: 'completed' },
      }),
    });
  });

  await page.goto(`/gigs/${gig.id}`);
  await page.getByRole('button', { name: 'Book this gig' }).click();
  await expect(page.getByRole('status')).toContainText('Booking confirmed');
  expect(posted).toEqual({ gigId: gig.id });
});

test('protected pages redirect anonymous visitors to the login page', async ({ page }) => {
  await page.goto('/bookings');
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
});
