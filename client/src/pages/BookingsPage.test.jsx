import { screen, within } from '@testing-library/react';
import { renderApp, logInAs, mockRoutes } from '../test/testUtils';
import { otherGig, ownGig, shownPrice } from '../test/fixtures';

// Bookings come back as raw Mongoose documents, so ids are `_id`.
const asPopulatedGig = (gig) => ({ _id: gig.id, title: gig.title, price: gig.price });

describe('BookingsPage', () => {
  test('a client sees the gigs they booked and who provides them', async () => {
    logInAs('client');
    mockRoutes({
      'GET /api/bookings/my': [
        200,
        {
          count: 1,
          bookings: [
            {
              _id: 'b1',
              gig: asPopulatedGig(otherGig),
              freelancer: { fullName: 'Naledi Khumalo' },
              status: 'confirmed',
              bookingDate: '2026-10-05T09:00:00.000Z',
            },
          ],
        },
      ],
    });

    renderApp('/bookings');

    const row = (await screen.findByRole('link', { name: otherGig.title })).closest('tr');
    expect(within(row).getByText('Naledi Khumalo')).toBeInTheDocument();
    expect(within(row).getByText(shownPrice(otherGig.price))).toBeInTheDocument();
    expect(within(row).getByText('confirmed')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Freelancer' })).toBeInTheDocument();
  });

  test('a freelancer sees bookings of their gigs, using the freelancer endpoint', async () => {
    logInAs('freelancer');
    mockRoutes({
      'GET /api/bookings/freelancer/my': [
        200,
        {
          count: 1,
          bookings: [
            {
              _id: 'b2',
              gig: asPopulatedGig(ownGig),
              client: { fullName: 'Thandi Mokoena' },
              status: 'confirmed',
              bookingDate: '2026-10-06T09:00:00.000Z',
            },
          ],
        },
      ],
    });

    renderApp('/bookings');

    expect(await screen.findByText('Thandi Mokoena')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Client' })).toBeInTheDocument();
  });

  test('explains when there are no bookings yet', async () => {
    logInAs('client');
    mockRoutes({ 'GET /api/bookings/my': [200, { count: 0, bookings: [] }] });

    renderApp('/bookings');

    expect(await screen.findByText(/No bookings yet/)).toBeInTheDocument();
    // The page links to browsing (the menu has a link with the same name, so look inside <main>).
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Browse gigs' })).toBeInTheDocument();
  });
});