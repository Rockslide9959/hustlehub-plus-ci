import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, logInAs } from '../test/testUtils';

// Own security feature: two-factor authentication settings on the profile page.
// A small fake API answers each request the way the real backend does.

function mockTwoFactorApi({ enabled = false, enableResult, disableResult } = {}) {
  const state = { enabled };

  global.fetch.mockImplementation(async (url, options = {}) => {
    const route = `${options.method || 'GET'} ${url}`;
    let status = 404;
    let body = { message: 'Route not found' };

    if (route === 'GET /api/auth/profile') {
      status = 200;
      body = { user: { email: 'test@example.com', role: 'client', exp: Math.floor(Date.now() / 1000) + 3600 } };
    } else if (route === 'GET /api/auth/2fa/status') {
      status = 200;
      body = { enabled: state.enabled };
    } else if (route === 'POST /api/auth/2fa/setup') {
      status = 200;
      body = { qrCode: 'data:image/png;base64,QRDATA', manualEntryKey: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' };
    } else if (route === 'POST /api/auth/2fa/enable') {
      [status, body] = enableResult || [200, { enabled: true }];
      if (status === 200) state.enabled = true;
    } else if (route === 'POST /api/auth/2fa/disable') {
      [status, body] = disableResult || [200, { enabled: false }];
      if (status === 200) state.enabled = false;
    }

    return { ok: status >= 200 && status < 300, status, json: async () => body };
  });
}

const callsTo = (route) =>
  global.fetch.mock.calls.filter(([url, options = {}]) => `${options.method || 'GET'} ${url}` === route);

describe('TwoFactorSettings', () => {
  beforeEach(() => {
    logInAs('client');
  });

  test('shows that two-factor authentication is off', async () => {
    mockTwoFactorApi();
    renderApp('/profile');

    expect(await screen.findByRole('heading', { name: 'Two-factor authentication' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Turn on two-factor authentication' })).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
  });

  test('turning it on shows the QR code, the setup key and a code box', async () => {
    const user = userEvent.setup();
    mockTwoFactorApi();
    renderApp('/profile');

    await user.click(await screen.findByRole('button', { name: 'Turn on two-factor authentication' }));

    expect(await screen.findByAltText(/QR code/)).toHaveAttribute('src', 'data:image/png;base64,QRDATA');
    expect(screen.getByText('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP')).toBeInTheDocument();
    expect(screen.getByLabelText('6-digit code')).toBeInTheDocument();
  });

  test('the code box only accepts up to 6 digits', async () => {
    const user = userEvent.setup();
    mockTwoFactorApi();
    renderApp('/profile');

    await user.click(await screen.findByRole('button', { name: 'Turn on two-factor authentication' }));
    await user.type(await screen.findByLabelText('6-digit code'), '12a3 456789');

    expect(screen.getByLabelText('6-digit code')).toHaveValue('123456');
  });

  test('confirming with a valid code turns two-factor authentication on', async () => {
    const user = userEvent.setup();
    mockTwoFactorApi();
    renderApp('/profile');

    await user.click(await screen.findByRole('button', { name: 'Turn on two-factor authentication' }));
    await user.type(await screen.findByLabelText('6-digit code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirm and turn on' }));

    expect(await screen.findByText(/Two-factor authentication is now on/)).toBeInTheDocument();
    expect(screen.getByText('On')).toBeInTheDocument();
    // The QR code is gone once setup is finished
    expect(screen.queryByAltText(/QR code/)).not.toBeInTheDocument();
    expect(JSON.parse(callsTo('POST /api/auth/2fa/enable')[0][1].body)).toEqual({ code: '123456' });
  });

  test('a wrong code shows an error and keeps the setup open', async () => {
    const user = userEvent.setup();
    mockTwoFactorApi({
      enableResult: [400, { message: 'That code is not valid. Check your authenticator app and try again.' }],
    });
    renderApp('/profile');

    await user.click(await screen.findByRole('button', { name: 'Turn on two-factor authentication' }));
    await user.type(await screen.findByLabelText('6-digit code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Confirm and turn on' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That code is not valid.');
    expect(screen.getByAltText(/QR code/)).toBeInTheDocument();
    expect(screen.getByLabelText('6-digit code')).toHaveValue('');
  });

  test('a short code is caught before calling the API', async () => {
    const user = userEvent.setup();
    mockTwoFactorApi();
    renderApp('/profile');

    await user.click(await screen.findByRole('button', { name: 'Turn on two-factor authentication' }));
    await user.type(await screen.findByLabelText('6-digit code'), '123');
    await user.click(screen.getByRole('button', { name: 'Confirm and turn on' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter the 6-digit code');
    expect(callsTo('POST /api/auth/2fa/enable')).toHaveLength(0);
  });

  test('turning it off needs the password and a code', async () => {
    const user = userEvent.setup();
    mockTwoFactorApi({ enabled: true });
    renderApp('/profile');

    await user.click(await screen.findByRole('button', { name: 'Turn off two-factor authentication' }));
    await user.type(screen.getByLabelText('Password'), 'Secure123');
    await user.type(screen.getByLabelText('6-digit code'), '654321');
    await user.click(screen.getByRole('button', { name: 'Turn off' }));

    expect(await screen.findByText('Two-factor authentication is now off.')).toBeInTheDocument();
    expect(JSON.parse(callsTo('POST /api/auth/2fa/disable')[0][1].body)).toEqual({
      password: 'Secure123',
      code: '654321',
    });
  });

  test('a wrong password when turning it off shows an error and does not log out', async () => {
    const user = userEvent.setup();
    mockTwoFactorApi({ enabled: true, disableResult: [400, { message: 'Incorrect password or code.' }] });
    renderApp('/profile');

    await user.click(await screen.findByRole('button', { name: 'Turn off two-factor authentication' }));
    await user.type(screen.getByLabelText('Password'), 'Wrong1234');
    await user.type(screen.getByLabelText('6-digit code'), '654321');
    await user.click(screen.getByRole('button', { name: 'Turn off' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect password or code.');
    expect(screen.getByRole('heading', { name: 'Your profile' })).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });
});
