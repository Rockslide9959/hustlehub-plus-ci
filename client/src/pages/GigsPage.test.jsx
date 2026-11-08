import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, logInAs, mockRoutes, fetchCalls } from '../test/testUtils';
import { otherGig, ownGig, gigList, shownPrice } from '../test/fixtures';

describe('GigsPage', () => {
  test('shows the gigs returned by the API', async () => {
    logInAs('client');
    mockRoutes({ 'GET /api/gigs?sort=newest': [200, gigList([otherGig, ownGig])] });

    renderApp('/gigs');

    const grid = await screen.findByRole('list', { name: 'Gigs' });
    const cards = within(grid).getAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('React landing page build')).toBeInTheDocument();
    expect(within(cards[0]).getByText('by Naledi Khumalo')).toBeInTheDocument();
    expect(within(cards[0]).getByText(shownPrice(2500.5))).toBeInTheDocument();
  });

  test('sends the search, category and sort to the API', async () => {
    const user = userEvent.setup();
    logInAs('client');
    mockRoutes({
      'GET /api/gigs?sort=newest': [200, gigList([otherGig, ownGig])],
      'GET /api/gigs?q=logo&category=Design&sort=price_asc': [200, gigList([ownGig])],
    });
    renderApp('/gigs');
    await screen.findByText('React landing page build');

    await user.type(screen.getByLabelText('Search'), 'logo');
    await user.selectOptions(screen.getByLabelText('Category'), 'Design');
    await user.selectOptions(screen.getByLabelText('Sort by'), 'price_asc');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Logo design for small businesses')).toBeInTheDocument();
    expect(screen.queryByText('React landing page build')).not.toBeInTheDocument();
    expect(fetchCalls().at(-1).url).toBe('/api/gigs?q=logo&category=Design&sort=price_asc');
  });

  test('says so when nothing matches', async () => {
    logInAs('freelancer');
    mockRoutes({ 'GET /api/gigs?sort=newest': [200, gigList([])] });

    renderApp('/gigs');

    expect(await screen.findByText('No gigs match your search.')).toBeInTheDocument();
  });
});