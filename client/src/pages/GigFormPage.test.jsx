import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, logInAs, mockRoutes, fetchCalls } from '../test/testUtils';
import { otherGig, ownGig } from '../test/fixtures';

async function fillGigForm(user, values) {
  if (values.title) await user.type(screen.getByLabelText('Title'), values.title);
  if (values.description) await user.type(screen.getByLabelText('Description'), values.description);
  if (values.price) await user.type(screen.getByLabelText('Price (R)'), values.price);
  if (values.category) await user.selectOptions(screen.getByLabelText('Category'), values.category);
}

describe('GigFormPage', () => {
  test('checks the form before calling the API', async () => {
    const user = userEvent.setup();
    logInAs('freelancer');
    renderApp('/gigs/new');

    await fillGigForm(user, { title: 'Logo', description: 'Too short', price: '0' });
    await user.click(screen.getByRole('button', { name: 'Create gig' }));

    expect(screen.getByText('Title must be between 5 and 100 characters.')).toBeInTheDocument();
    expect(screen.getByText('Description must be between 20 and 1000 characters.')).toBeInTheDocument();
    expect(screen.getByText('Price must be between R1 and R1,000,000.')).toBeInTheDocument();
    expect(screen.getByText('Choose a category.')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('creates a gig, sending the price as a number', async () => {
    const user = userEvent.setup();
    logInAs('freelancer');
    mockRoutes({
      'POST /api/gigs': [201, { message: 'Gig created', data: ownGig }],
      [`GET /api/gigs/${ownGig.id}`]: [200, { data: ownGig }],
    });
    renderApp('/gigs/new');

    await fillGigForm(user, {
      title: ownGig.title,
      description: ownGig.description,
      price: '750',
      category: 'Design',
    });
    await user.click(screen.getByRole('button', { name: 'Create gig' }));

    // After saving, the new gig's page opens.
    expect(await screen.findByRole('heading', { name: ownGig.title })).toBeInTheDocument();
    expect(fetchCalls()[0]).toEqual({
      method: 'POST',
      url: '/api/gigs',
      body: {
        title: ownGig.title,
        description: ownGig.description,
        price: 750,
        category: 'Design',
        isActive: true,
      },
    });
  });

  test('shows field errors returned by the API', async () => {
    const user = userEvent.setup();
    logInAs('freelancer');
    mockRoutes({
      'POST /api/gigs': [
        400,
        { message: 'Validation failed', errors: [{ field: 'price', message: 'Price must have at most 2 decimal places' }] },
      ],
    });
    renderApp('/gigs/new');

    await fillGigForm(user, {
      title: ownGig.title,
      description: ownGig.description,
      price: '750',
      category: 'Design',
    });
    await user.click(screen.getByRole('button', { name: 'Create gig' }));

    expect(await screen.findByText('Price must have at most 2 decimal places')).toBeInTheDocument();
    expect(screen.getByLabelText('Price (R)')).toHaveAttribute('aria-invalid', 'true');
  });

  test('loads an existing gig for editing and saves the changes', async () => {
    const user = userEvent.setup();
    logInAs('freelancer');
    const updated = { ...ownGig, price: 900 };
    mockRoutes({
      [`GET /api/gigs/${ownGig.id}`]: [200, { data: ownGig }],
      [`PUT /api/gigs/${ownGig.id}`]: [200, { message: 'Gig updated', data: updated }],
    });
    renderApp(`/gigs/${ownGig.id}/edit`);

    const price = await screen.findByLabelText('Price (R)');
    expect(screen.getByLabelText('Title')).toHaveValue(ownGig.title);
    await user.clear(price);
    await user.type(price, '900');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const putCall = fetchCalls().find((call) => call.method === 'PUT');
    expect(putCall.url).toBe(`/api/gigs/${ownGig.id}`);
    expect(putCall.body.price).toBe(900);
  });

  test("refuses to edit another freelancer's gig", async () => {
    logInAs('freelancer');
    mockRoutes({ [`GET /api/gigs/${otherGig.id}`]: [200, { data: otherGig }] });

    renderApp(`/gigs/${otherGig.id}/edit`);

    expect(await screen.findByText('You can only edit gigs you created.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });
});