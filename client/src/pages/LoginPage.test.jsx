import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, mockFetchResponse, makeToken } from '../test/testUtils';

describe('LoginPage', () => {
  test('renders the email field, password field and submit button', () => {
    renderApp('/login');

    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  test('shows validation errors and does not call the API when submitted empty', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('logs in and shows the dashboard', async () => {
    const user = userEvent.setup();
    mockFetchResponse(200, {
      message: 'Login successful',
      token: makeToken({ id: 'u1', role: 'freelancer' }),
      user: { id: 'u1', fullName: 'Sipho Dlamini', email: 'sipho@example.com', role: 'freelancer' },
    });
    renderApp('/login');

    await user.type(screen.getByLabelText('Email'), 'Sipho@Example.com');
    await user.type(screen.getByLabelText('Password'), 'Secure123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'Welcome, Sipho Dlamini' })).toBeInTheDocument();

    // The email is normalised before it is sent.
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(JSON.parse(options.body)).toEqual({ email: 'sipho@example.com', password: 'Secure123' });
  });

  test('shows a friendly message when the credentials are wrong', async () => {
    const user = userEvent.setup();
    mockFetchResponse(401, { message: 'Invalid email or password' });
    renderApp('/login');

    await user.type(screen.getByLabelText('Email'), 'sipho@example.com');
    await user.type(screen.getByLabelText('Password'), 'WrongPass1');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  test('shows a lockout countdown and disables the button when the account is locked', async () => {
    const user = userEvent.setup();
    mockFetchResponse(423, {
      message: 'Account temporarily locked after too many failed login attempts. Please try again in 15 minutes.',
      retryAfterSeconds: 900,
    });
    renderApp('/login');

    await user.type(screen.getByLabelText('Email'), 'sipho@example.com');
    await user.type(screen.getByLabelText('Password'), 'WrongPass1');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Account temporarily locked.');
    expect(alert).toHaveTextContent(/15:00|14:5\d/);
    expect(screen.getByRole('button', { name: 'Locked' })).toBeDisabled();
    // The password is cleared so it is not left sitting in the form
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('unlocks the form again when the lockout countdown ends', async () => {
    const user = userEvent.setup();
    mockFetchResponse(423, { message: 'Account temporarily locked.', retryAfterSeconds: 1 });
    renderApp('/login');

    await user.type(screen.getByLabelText('Email'), 'sipho@example.com');
    await user.type(screen.getByLabelText('Password'), 'WrongPass1');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('button', { name: 'Locked' })).toBeDisabled();
    expect(
      await screen.findByRole('button', { name: 'Log in' }, { timeout: 3000 })
    ).toBeEnabled();
    expect(screen.queryByText('Account temporarily locked.')).not.toBeInTheDocument();
  });
});

describe('LoginPage with two-factor authentication', () => {
  // Step 1: a correct password on a 2FA account returns a challenge token
  async function passPasswordStep(user) {
    mockFetchResponse(200, {
      message: 'Enter the 6-digit code from your authenticator app.',
      twoFactorRequired: true,
      challengeToken: 'challenge-token-abc',
    });
    renderApp('/login');

    await user.type(screen.getByLabelText('Email'), 'sipho@example.com');
    await user.type(screen.getByLabelText('Password'), 'Secure123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await screen.findByRole('heading', { name: 'Two-step verification' });
  }

  test('asks for a code after the password instead of logging in', async () => {
    const user = userEvent.setup();
    await passPasswordStep(user);

    expect(screen.getByLabelText('6-digit code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
    // No session yet: the password step alone must not log anyone in
    expect(sessionStorage.length).toBe(0);
  });

  test('logs in with the correct code', async () => {
    const user = userEvent.setup();
    await passPasswordStep(user);
    mockFetchResponse(200, {
      message: 'Login successful',
      token: makeToken({ id: 'u1', role: 'freelancer' }),
      user: { id: 'u1', fullName: 'Sipho Dlamini', email: 'sipho@example.com', role: 'freelancer' },
    });

    await user.type(screen.getByLabelText('6-digit code'), '123 456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('heading', { name: 'Welcome, Sipho Dlamini' })).toBeInTheDocument();
    const [url, options] = global.fetch.mock.calls[1];
    expect(url).toBe('/api/auth/2fa/verify');
    expect(JSON.parse(options.body)).toEqual({ challengeToken: 'challenge-token-abc', code: '123456' });
  });

  test('shows a clear message for a wrong code and lets the user try again', async () => {
    const user = userEvent.setup();
    await passPasswordStep(user);
    mockFetchResponse(401, {
      message: 'That code is not valid. Check your authenticator app and try again.',
      errors: [{ field: 'code', message: 'That code is not valid.' }],
    });

    await user.type(screen.getByLabelText('6-digit code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That code is not valid.');
    expect(screen.getByLabelText('6-digit code')).toHaveValue('');
    expect(screen.getByRole('heading', { name: 'Two-step verification' })).toBeInTheDocument();
  });

  test('goes back to the password step when the 5-minute challenge has expired', async () => {
    const user = userEvent.setup();
    await passPasswordStep(user);
    mockFetchResponse(401, { message: 'Your login session has expired. Please log in again.' });

    await user.type(screen.getByLabelText('6-digit code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Your login session has expired.');
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  test('shows the lockout countdown after too many wrong codes', async () => {
    const user = userEvent.setup();
    await passPasswordStep(user);
    mockFetchResponse(423, { message: 'Account temporarily locked.', retryAfterSeconds: 900 });

    await user.type(screen.getByLabelText('6-digit code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('button', { name: 'Locked' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Account temporarily locked.');
  });

  test('"Back to log in" returns to the password step with the password cleared', async () => {
    const user = userEvent.setup();
    await passPasswordStep(user);

    await user.click(screen.getByRole('button', { name: 'Back to log in' }));

    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });
});