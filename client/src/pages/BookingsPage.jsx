import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useApi } from '../hooks/useApi';
import { getClientBookings, getFreelancerBookings } from '../api/bookingsApi';
import { formatDate, formatPrice } from '../utils/format';
import { ROLES } from '../auth/roles';
import FormError from '../components/FormError';

// Clients see the gigs they booked; freelancers see bookings of their gigs.
export default function BookingsPage() {
  const { user, token } = useAuth();
  const isClient = user.role === ROLES.CLIENT;

  const load = useCallback(
    () => (isClient ? getClientBookings(token) : getFreelancerBookings(token)),
    [isClient, token]
  );
  const { data, error, loading } = useApi(load);
  const bookings = data?.bookings ?? [];

  return (
    <section className="page">
      <h1>My bookings</h1>
      <p className="muted">
        {isClient ? 'Gigs you have booked.' : 'Bookings clients have made for your gigs.'}
      </p>

      <FormError message={error} />
      {loading && <p className="muted">Loading bookings…</p>}

      {!loading && !error && bookings.length === 0 && (
        <p className="muted">
          No bookings yet.{isClient && <> <Link to="/gigs">Browse gigs</Link> to make one.</>}
        </p>
      )}

      {bookings.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Gig</th>
                <th scope="col">{isClient ? 'Freelancer' : 'Client'}</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
                <th scope="col">Date</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => {
                const otherParty = isClient ? booking.freelancer : booking.client;
                return (
                  <tr key={booking._id}>
                    <td>
                      {booking.gig ? (
                        <Link to={`/gigs/${booking.gig._id}`}>{booking.gig.title}</Link>
                      ) : (
                        <span className="muted">Gig no longer available</span>
                      )}
                    </td>
                    <td>{otherParty?.fullName ?? '–'}</td>
                    <td>{formatPrice(booking.gig?.price)}</td>
                    <td className="capitalize">{booking.status}</td>
                    <td>{formatDate(booking.bookingDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}