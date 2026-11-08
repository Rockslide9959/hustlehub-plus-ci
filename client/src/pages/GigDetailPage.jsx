import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useApi } from '../hooks/useApi';
import { getGig, deleteGig } from '../api/gigsApi';
import { createBooking } from '../api/bookingsApi';
import { formatDate, formatPrice } from '../utils/format';
import { ROLES } from '../auth/roles';
import FormError from '../components/FormError';

export default function GigDetailPage() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const load = useCallback(() => getGig(token, id), [token, id]);
  const { data, error, loading } = useApi(load);

  const [actionError, setActionError] = useState('');
  const [booked, setBooked] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <p className="muted">Loading gig…</p>;
  if (error) {
    return (
      <section className="page">
        <FormError message={error} />
        <Link to="/gigs">Back to all gigs</Link>
      </section>
    );
  }

  const gig = data.data;
  const ownerId = gig.freelancer && typeof gig.freelancer === 'object' ? gig.freelancer.id : gig.freelancer;
  const freelancerName = gig.freelancer && typeof gig.freelancer === 'object' ? gig.freelancer.fullName : null;

  const isOwner = user.role === ROLES.FREELANCER && String(ownerId) === String(user.id);
  const canBook = user.role === ROLES.CLIENT && gig.isActive && !booked;
  const canDelete = isOwner || user.role === ROLES.ADMIN;

  async function handleBook() {
    setBusy(true);
    setActionError('');
    try {
      const result = await createBooking(token, gig.id);
      setBooked(result.transaction ?? { amount: gig.price });
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${gig.title}"? This cannot be undone.`)) return;
    setBusy(true);
    setActionError('');
    try {
      await deleteGig(token, gig.id);
      navigate(isOwner ? '/gigs/mine' : '/gigs', { replace: true, state: { message: 'Gig deleted.' } });
    } catch (err) {
      setActionError(err.message);
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <p>
        <Link to="/gigs">← All gigs</Link>
      </p>

      <article className="gig-detail">
        <span className="gig-category">{gig.category}</span>
        <h1>{gig.title}</h1>
        <p className="muted">
          {freelancerName ? `Offered by ${freelancerName} · ` : ''}Listed {formatDate(gig.createdAt)}
          {!gig.isActive && ' · Paused (not visible to clients)'}
        </p>
        <p className="gig-price">{formatPrice(gig.price)}</p>
        <p className="gig-body">{gig.description}</p>

        <FormError message={actionError} />

        {booked && (
          <div className="alert alert-success" role="status">
            Booking confirmed. A payment of {formatPrice(booked.amount)} has been recorded.{' '}
            <Link to="/bookings">View my bookings</Link>
          </div>
        )}

        <div className="actions">
          {canBook && (
            <button type="button" className="btn btn-inline" onClick={handleBook} disabled={busy}>
              {busy ? 'Booking…' : 'Book this gig'}
            </button>
          )}
          {isOwner && (
            <Link to={`/gigs/${gig.id}/edit`} className="btn btn-secondary btn-inline">
              Edit
            </Link>
          )}
          {canDelete && (
            <button type="button" className="btn btn-danger btn-inline" onClick={handleDelete} disabled={busy}>
              Delete
            </button>
          )}
        </div>
      </article>
    </section>
  );
}