import { getPasswordProblem, validateLogin, validateRegistration } from './validation';

const validRegistration = {
  fullName: 'Thandi Mokoena',
  email: 'thandi@example.com',
  password: 'Secure123',
  confirmPassword: 'Secure123',
  role: 'client',
};

describe('validateLogin', () => {
  test('requires email and password', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({
      email: 'Email is required.',
      password: 'Password is required.',
    });
  });

  test('rejects a badly formatted email', () => {
    expect(validateLogin({ email: 'not-an-email', password: 'x' }).email).toBe(
      'Enter a valid email address.'
    );
  });

  test('accepts valid input', () => {
    expect(validateLogin({ email: 'a@b.co', password: 'anything' })).toEqual({});
  });
});

describe('getPasswordProblem', () => {
  test.each([
    ['Ab1', 'Password must be between 8 and 72 characters.'],
    ['lowercase123', 'Password must contain at least one uppercase letter.'],
    ['UPPERCASE123', 'Password must contain at least one lowercase letter.'],
    ['NoNumbersHere', 'Password must contain at least one number.'],
  ])('rejects "%s"', (password, message) => {
    expect(getPasswordProblem(password)).toBe(message);
  });

  test('accepts a password that meets every rule', () => {
    expect(getPasswordProblem('Secure123')).toBeNull();
  });
});

describe('validateRegistration', () => {
  test('accepts valid input', () => {
    expect(validateRegistration(validRegistration)).toEqual({});
  });

  test('rejects mismatched passwords', () => {
    const errors = validateRegistration({ ...validRegistration, confirmPassword: 'Different123' });
    expect(errors.confirmPassword).toBe('Passwords do not match.');
  });

  test('does not allow registering as admin', () => {
    const errors = validateRegistration({ ...validRegistration, role: 'admin' });
    expect(errors.role).toBeDefined();
  });

  test('rejects names longer than the database allows', () => {
    const errors = validateRegistration({ ...validRegistration, fullName: 'a'.repeat(81) });
    expect(errors.fullName).toBe('Full name must be between 2 and 80 characters.');
  });
});