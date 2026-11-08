import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useApi } from '../hooks/useApi';
import { listUsers, listAllGigs } from '../api/adminApi';
import { deleteGig } from '../api/gigsApi';
import { formatDate, formatPrice } from '../utils/format';
import FormError from '../components/FormError';

function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pages">
      <button
        type="button"
        className="btn btn-secondary btn-inline"
        disabled={pagination.page <= 1}
        onClick={() => onPage(pagination.page - 1)}
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
        onClick={() => onPage(pagination.page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

function UsersTable() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const load = useCallback(() => listUsers(token, page), [token, page]);
  const { data, error, loading } = useApi(load);
  const users = data?.data ?? [];

  return (
    <>
      <FormError message={error} />
      {loading && <p className="muted">Loading users…</p>}
      {!loading && !error && users.length === 0 && <p className="muted">No users found.</p>}
      {users.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className="role-badge">{u.role}</span>
                  </td>
                  <td>{formatDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination pagination={data?.pagination} onPage={setPage} />
    </>
  );
}

function GigsTable() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState('');
  const [flash, setFlash] = useState('');
  const load = useCallback(() => listAllGigs(token, page), [token, page]);
  const { data, error, loading, reload } = useApi(load);
  const gigs = data?.data ?? [];

  async function handleDelete(gig) {
    if (!window.confirm(`Remove "${gig.title}" from the platform? This cannot be undone.`)) return;
    setActionError('');
    setFlash('');
    try {
      await deleteGig(token, gig.id);
      setFlash(`"${gig.title}" was removed.`);
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  }

  return (
    <>
      {flash && (
        <div className="alert alert-success" role="status">
          {flash}
        </div>
      )}
      <FormError message={error || actionError} />
      {loading && <p className="muted">Loading gigs…</p>}
      {!loading && !error && gigs.length === 0 && <p className="muted">No gigs found.</p>}
      {gigs.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Freelancer</th>
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
                  <td>
                    {gig.freelancer?.fullName}
                    {gig.freelancer?.email && (
                      <span className="muted"> ({gig.freelancer.email})</span>
                    )}
                  </td>
                  <td>{gig.category}</td>
                  <td>{formatPrice(gig.price)}</td>
                  <td>{gig.isActive ? 'Active' : 'Paused'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-link btn-link-danger"
                      onClick={() => handleDelete(gig)}
                      aria-label={`Delete ${gig.title}`}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination pagination={data?.pagination} onPage={setPage} />
    </>
  );
}

// Admin moderation page. Admins can see every user and gig and remove any gig.
// They cannot create or edit gigs. The backend enforces all of this.
export default function AdminPage() {
  const [tab, setTab] = useState('gigs');

  return (
    <section className="page">
      <div className="page-header">
        <h1>Admin</h1>
      </div>
      <p className="muted">Moderate the platform: review accounts and remove inappropriate gigs.</p>

      <div className="row-actions" role="group" aria-label="Admin sections">
        <button
          type="button"
          className={`btn btn-inline ${tab === 'gigs' ? '' : 'btn-secondary'}`}
          aria-pressed={tab === 'gigs'}
          onClick={() => setTab('gigs')}
        >
          All gigs
        </button>
        <button
          type="button"
          className={`btn btn-inline ${tab === 'users' ? '' : 'btn-secondary'}`}
          aria-pressed={tab === 'users'}
          onClick={() => setTab('users')}
        >
          Users
        </button>
      </div>

      {tab === 'gigs' ? <GigsTable /> : <UsersTable />}
    </section>
  );
}