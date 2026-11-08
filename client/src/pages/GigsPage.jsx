import { useCallback, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { useApi } from '../hooks/useApi';
import { listGigs } from '../api/gigsApi';
import { GIG_CATEGORIES } from '../utils/gigValidation';
import GigCard from '../components/GigCard';
import FormError from '../components/FormError';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

export default function GigsPage() {
  const { token } = useAuth();
  const [form, setForm] = useState({ q: '', category: '', sort: 'newest' });
  const [filters, setFilters] = useState({ q: '', category: '', sort: 'newest', page: 1 });

  const load = useCallback(() => listGigs(token, filters), [token, filters]);
  const { data, error, loading } = useApi(load);

  const gigs = data?.data ?? [];
  const pagination = data?.pagination;

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function handleSearch(event) {
    event.preventDefault();
    setFilters({ ...form, q: form.q.trim(), page: 1 });
  }

  function goToPage(page) {
    setFilters((previous) => ({ ...previous, page }));
  }

  return (
    <section className="page">
      <h1>Browse gigs</h1>

      <form className="filters" onSubmit={handleSearch} role="search">
        <div className="field">
          <label htmlFor="q">Search</label>
          <input id="q" name="q" type="search" maxLength={100} value={form.q} onChange={handleChange} />
        </div>
        <div className="field">
          <label htmlFor="category">Category</label>
          <select id="category" name="category" value={form.category} onChange={handleChange}>
            <option value="">All categories</option>
            {GIG_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sort">Sort by</label>
          <select id="sort" name="sort" value={form.sort} onChange={handleChange}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-inline">
          Search
        </button>
      </form>

      <FormError message={error} />
      {loading && <p className="muted">Loading gigs…</p>}

      {!loading && !error && gigs.length === 0 && (
        <p className="muted">No gigs match your search.</p>
      )}

      {gigs.length > 0 && (
        <ul className="gig-grid" aria-label="Gigs">
          {gigs.map((gig) => (
            <GigCard key={gig.id} gig={gig} />
          ))}
        </ul>
      )}

      {pagination && pagination.pages > 1 && (
        <nav className="pagination" aria-label="Pages">
          <button
            type="button"
            className="btn btn-secondary btn-inline"
            disabled={pagination.page <= 1}
            onClick={() => goToPage(pagination.page - 1)}
          >
            Previous
          </button>
          <span className="muted">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-inline"
            disabled={pagination.page >= pagination.pages}
            onClick={() => goToPage(pagination.page + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}