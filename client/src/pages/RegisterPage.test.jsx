import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, mockFetchResponse } from '../test/testUtils';

async function fillForm(user, overrides = {}) {
  const values = {
    fullName: 'Thandi Mokoena',
    email: 'thandi@example.com',
    password: 'Secure123',
    confirmPassword: 'Secure123',
    role: 'client',
    ...overrides,
  };
  await user.type(screen.getByLabelText('Full name'), values.fullName);
  await user.type(screen.getByLabelText('Email'), values.email);
  await user.type(screen.getByLabelText('Password'), values.password);
  await user.type(screen.getByLabelText('Confirm password'), values.confirmPassword);
  await user.selectOptions(screen.getByLabelText('I want to'), values.role);
}

describe('RegisterPage', () => {
  test('only offers client and freelancer roles', () => {
    renderApp('/register');

    const options = screen.getAllByRole('option').map((option) => option.value);
    expect(options).toEqual(['', 'client', 'freelancer']);
  });

  test('explains a weak password without calling the API', async () => {
    const user = userEvent.setup();
    renderApp('/register');

    await fillForm(user, { password: 'weakpass1', confirmPassword: 'weakpass1' });
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      screen.getByText('Password must contain at least one uppercase letter.')
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('sends the registration and redirects to log in', async () => {
    const user = userEvent.setup();
    mockFetchResponse(201, { message: 'User registered', data: { id: 'u2' } });
    renderApp('/register');

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Account created. You can now log in.')).toBeInTheDocument();

    // confirmPassword is checked in the browser only and never sent.
    const [, options] = global.fetch.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      fullName: 'Thandi Mokoena',
      email: 'thandi@example.com',
      password: 'Secure123',
      role: 'client',
    });
  });

  test('shows the API message when the email is already registered', async () => {
    const user = userEvent.setup();
    mockFetchResponse(409, { error: 'User already exists.' });
    renderApp('/register');

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('User already exists.');
  });
});