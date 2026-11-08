import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, logInAs, mockRoutes, fetchCalls } from '../test/testUtils';
import { otherGig, ownGig, shownPrice } from '../test/fixtures';

describe('GigDetailPage', () => {
  test('a client can book a gig, which records a transaction', async () => {
    const user = userEvent.setup();
    logInAs('client');
    mockRoutes({
      [`GET /api/gigs/${otherGig.id}`]: [200, { data: otherGig }],
      'POST /api/bookings': [
        201,
        {
          message: 'Booking confirmed successfully.',
          booking: { _id: 'b1', status: 'confirmed' },
          transaction: { _id: 't1', amount: otherGig.price, status: 'completed' },
        },
      ],
    });
    renderApp(`/gigs/${otherGig.id}`);

    await user.click(await screen.findByRole('button', { name: 'Book this gig' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      `Booking confirmed. A payment of ${shownPrice(otherGig.price)} has been recorded.`
    );
    expect(screen.queryByRole('button', { name: 'Book this gig' })).not.toBeInTheDocument();
    // Only the gig id is sent; the server works out the client, freelancer and price.
    expect(fetchCalls().at(-1)).toEqual({
      method: 'POST',
      url: '/api/bookings',
      body: { gigId: otherGig.id },
    });
  });

  test('shows the rate-limit message when booking too often', async () => {
    const user = userEvent.setup();
    logInAs('client');
    mockRoutes({
      [`GET /api/gigs/${otherGig.id}`]: [200, { data: otherGig }],
      'POST /api/bookings': [429, { message: 'Too many booking attempts. Please try again in 15 minutes.' }],
    });
    renderApp(`/gigs/${otherGig.id}`);

    await user.click(await screen.findByRole('button', { name: 'Book this gig' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many booking attempts. Please try again in 15 minutes.'
    );
  });

  test('the owner sees Edit and Delete but cannot book their own gig', async () => {
    logInAs('freelancer');
    mockRoutes({ [`GET /api/gigs/${ownGig.id}`]: [200, { data: ownGig }] });

    renderApp(`/gigs/${ownGig.id}`);

    expect(await screen.findByRole('link', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Book this gig' })).not.toBeInTheDocument();
  });

  test("another freelancer cannot edit, delete or book someone else's gig", async () => {
    logInAs('freelancer');
    mockRoutes({ [`GET /api/gigs/${otherGig.id}`]: [200, { data: otherGig }] });

    renderApp(`/gigs/${otherGig.id}`);

    expect(await screen.findByRole('heading', { name: otherGig.title })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Book this gig' })).not.toBeInTheDocument();
  });

  test('the owner can delete their gig after confirming', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    logInAs('freelancer');
    mockRoutes({
      [`GET /api/gigs/${ownGig.id}`]: [200, { data: ownGig }],
      [`DELETE /api/gigs/${ownGig.id}`]: [200, { message: 'Gig deleted' }],
      'GET /api/gigs/mine?limit=50': [200, { data: [] }],
    });
    renderApp(`/gigs/${ownGig.id}`);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('heading', { name: 'My gigs' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Gig deleted.');
    window.confirm.mockRestore();
  });

  test('shows a friendly message when the gig does not exist', async () => {
    logInAs('client');
    mockRoutes({});

    renderApp('/gigs/665f1a2b3c4d5e6f7a8b9c99');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't find what you were looking for."
    );
  });
});