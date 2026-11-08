import { useCallback, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useApi } from '../hooks/useApi';
import { listMyGigs, deleteGig } from '../api/gigsApi';
import { formatPrice } from '../utils/format';
import FormError from '../components/FormError';

export default function MyGigsPage() {
  const { token } = useAuth();
  const location = useLocation();
  const load = useCallback(() => listMyGigs(token), [token]);
  const { data, error, loading, reload } = useApi(load);
  const [actionError, setActionError] = useState('');

  const gigs = data?.data ?? [];
  const flash = location.state?.message;

  async function handleDelete(gig) {
    if (!window.confirm(`Delete "${gig.title}"? This cannot be undone.`)) return;
    setActionError('');
    try {
      await deleteGig(token, gig.id);
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <h1>My gigs</h1>
        <Link to="/gigs/new" className="btn btn-inline">
          Create gig
        </Link>
      </div>

      {flash && (
        <div className="alert alert-success" role="status">
          {flash}
        </div>
      )}
      <FormError message={error || actionError} />
      {loading && <p className="muted">Loading your gigs…</p>}

      {!loading && !error && gigs.length === 0 && (
        <p className="muted">You haven't listed any gigs yet.</p>
      )}

      {gigs.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Category</th>
                <th scope="col">Price</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {gigs.map((gig) => (
                <tr key={gig.id}>
                  <td>
                    <Link to={`/gigs/${gig.id}`}>{gig.title}</Link>
                  </td>
                  <td>{gig.category}</td>
                  <td>{formatPrice(gig.price)}</td>
                  <td>{gig.isActive ? 'Active' : 'Paused'}</td>
                  <td>
                    <div className="row-actions">
                      <Link to={`/gigs/${gig.id}/edit`} aria-label={`Edit ${gig.title}`}>
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="btn-link btn-link-danger"
                        onClick={() => handleDelete(gig)}
                        aria-label={`Delete ${gig.title}`}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}