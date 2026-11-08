import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { validateRegistration } from '../utils/validation';
import FormError from '../components/FormError';

const EMPTY_FORM = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: '',
};

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');

    const errors = validateRegistration(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      // confirmPassword is only checked here; it is never sent to the server.
      await register({
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
      });
      void navigate('/login', { replace: true, state: { registered: true } });
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Small helper so every field renders its label, input and error the same way.
  function renderError(name) {
    if (!fieldErrors[name]) return null;
    return (
      <span id={`${name}-error`} className="field-error">
        {fieldErrors[name]}
      </span>
    );
  }

  function errorProps(name) {
    return {
      'aria-invalid': Boolean(fieldErrors[name]),
      'aria-describedby': fieldErrors[name] ? `${name}-error` : undefined,
    };
  }

  return (
    <section className="card">
      <h1>Create an account</h1>

      <FormError message={formError} />

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="fullName">Full name</label>
          <input
            id="fullName"
            name="fullName"
            autoComplete="name"
            value={form.fullName}
            onChange={handleChange}
            {...errorProps('fullName')}
          />
          {renderError('fullName')}
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            {...errorProps('email')}
          />
          {renderError('email')}
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            {...errorProps('password')}
          />
          <span className="hint">
            8–72 characters, with an uppercase letter, a lowercase letter and a number.
          </span>
          {renderError('password')}
        </div>

        <div className="field">
          <label htmlFor="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={handleChange}
            {...errorProps('confirmPassword')}
          />
          {renderError('confirmPassword')}
        </div>

        <div className="field">
          <label htmlFor="role">I want to</label>
          <select
            id="role"
            name="role"
            value={form.role}
            onChange={handleChange}
            {...errorProps('role')}
          >
            <option value="">Choose one…</option>
            <option value="client">Hire freelancers (client)</option>
            <option value="freelancer">Offer my services (freelancer)</option>
          </select>
          {renderError('role')}
        </div>

        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="form-footer">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </section>
  );
}