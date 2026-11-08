import { useState } from 'react';
import { GIG_CATEGORIES, validateGig, toGigPayload } from '../utils/gigValidation';
import FormError from './FormError';

// Shared by the create and edit pages.
// onSubmit receives the cleaned gig and should navigate away when it succeeds.
export default function GigForm({ initialValues, submitLabel, onSubmit }) {
  const [form, setForm] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((previous) => ({ ...previous, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');

    const errors = validateGig(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit(toGigPayload(form));
    } catch (error) {
      // Show any per-field messages from the API next to the matching field.
      setFieldErrors(error.fieldErrors || {});
      setFormError(error.message);
      setSubmitting(false);
    }
  }

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
    <form onSubmit={handleSubmit} noValidate>
      <FormError message={formError} />

      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" name="title" value={form.title} onChange={handleChange} {...errorProps('title')} />
        {renderError('title')}
      </div>

      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          rows={6}
          value={form.description}
          onChange={handleChange}
          {...errorProps('description')}
        />
        <span className="hint">{form.description.trim().length} / 1000 characters (minimum 20)</span>
        {renderError('description')}
      </div>

      <div className="field">
        <label htmlFor="price">Price (R)</label>
        <input
          id="price"
          name="price"
          type="number"
          inputMode="decimal"
          min="1"
          step="0.01"
          value={form.price}
          onChange={handleChange}
          {...errorProps('price')}
        />
        {renderError('price')}
      </div>

      <div className="field">
        <label htmlFor="category">Category</label>
        <select id="category" name="category" value={form.category} onChange={handleChange} {...errorProps('category')}>
          <option value="">Choose a category…</option>
          {GIG_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        {renderError('category')}
      </div>

      <div className="field field-checkbox">
        <input id="isActive" name="isActive" type="checkbox" checked={form.isActive} onChange={handleChange} />
        <label htmlFor="isActive">Active (clients can find and book this gig)</label>
      </div>

      <button type="submit" className="btn" disabled={submitting}>
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}