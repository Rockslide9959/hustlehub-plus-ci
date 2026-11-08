import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, logInAs, mockRoutes, fetchCalls } from '../test/testUtils';
import { ownGig, otherGig, shownPrice } from '../test/fixtures';

const adminGig = (gig, email) => ({ ...gig, freelancer: { ...gig.freelancer, email } });
const users = {
  message: 'Users retrieved',
  data: [
    { id: 'u1', fullName: 'Test User', email: 'test@example.com', role: 'freelancer', createdAt: '2026-10-01T10:00:00.000Z' },
    { id: 'u2', fullName: 'Thandi Mokoena', email: 'thandi@example.com', role: 'client', createdAt: '2026-10-02T10:00:00.000Z' },
  ],
  pagination: { page: 1, limit: 20, total: 2, pages: 1 },
};

describe('AdminPage', () => {
  test('an admin sees every gig, including who owns it', async () => {
    logInAs('admin');
    mockRoutes({
      'GET /api/admin/gigs': [
        200,
        {
          message: 'All gigs retrieved',
          data: [adminGig(ownGig, 'test@example.com'), adminGig(otherGig, 'naledi@example.com')],
          pagination: { page: 1, limit: 20, total: 2, pages: 1 },
        },
      ],
    });

    renderApp('/admin');

    expect(await screen.findByText(ownGig.title)).toBeInTheDocument();
    expect(screen.getByText(otherGig.title)).toBeInTheDocument();
    expect(screen.getByText(/naledi@example.com/)).toBeInTheDocument();
    expect(screen.getByText(shownPrice(2500.5))).toBeInTheDocument();
  });

  test('shows the users tab without any password data', async () => {
    logInAs('admin');
    mockRoutes({
      'GET /api/admin/gigs': [200, { data: [], pagination: { page: 1, limit: 20, total: 0, pages: 1 } }],
      'GET /api/admin/users': [200, users],
    });

    renderApp('/admin');
    await userEvent.click(await screen.findByRole('button', { name: 'Users' }));

    expect(await screen.findByText('thandi@example.com')).toBeInTheDocument();
    expect(screen.getByText('client')).toBeInTheDocument();
    expect(screen.queryByText(/password/i)).not.toBeInTheDocument();
  });

  test('deleting a gig asks first, then calls the API and refreshes', async () => {
    logInAs('admin');
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockRoutes({
      'GET /api/admin/gigs': [
        200,
        { data: [adminGig(otherGig, 'naledi@example.com')], pagination: { page: 1, limit: 20, total: 1, pages: 1 } },
      ],
      [`DELETE /api/gigs/${otherGig.id}`]: [200, { message: 'Gig deleted' }],
    });

    renderApp('/admin');
    await userEvent.click(await screen.findByRole('button', { name: `Delete ${otherGig.title}` }));

    await waitFor(() =>
      expect(fetchCalls()).toContainEqual(
        expect.objectContaining({ method: 'DELETE', url: `/api/gigs/${otherGig.id}` })
      )
    );
    expect(await screen.findByRole('status')).toHaveTextContent(/was removed/);
    window.confirm.mockRestore();
  });

  test('cancelling the confirmation deletes nothing', async () => {
    logInAs('admin');
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    mockRoutes({
      'GET /api/admin/gigs': [
        200,
        { data: [adminGig(otherGig, 'n@example.com')], pagination: { page: 1, limit: 20, total: 1, pages: 1 } },
      ],
    });

    renderApp('/admin');
    await userEvent.click(await screen.findByRole('button', { name: `Delete ${otherGig.title}` }));

    expect(fetchCalls().some((c) => c.method === 'DELETE')).toBe(false);
    window.confirm.mockRestore();
  });

  test.each(['client', 'freelancer'])('a %s is sent to the forbidden page', async (role) => {
    logInAs(role);
    mockRoutes({});

    renderApp('/admin');

    expect(await screen.findByText(/permission|not allowed|forbidden/i)).toBeInTheDocument();
    expect(fetchCalls().some((c) => c.url.startsWith('/api/admin'))).toBe(false);
  });

  test('the admin menu link is only shown to admins', async () => {
    logInAs('admin');
    mockRoutes({});
    const { unmount } = renderApp('/');
    expect(await screen.findByRole('link', { name: 'Admin' })).toBeInTheDocument();
    unmount();
    sessionStorage.clear();

    logInAs('client');
    renderApp('/');
    await screen.findByText(/Welcome/);
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });
});