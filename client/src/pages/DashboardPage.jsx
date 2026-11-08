import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { linksForRole } from '../navigation';

const DESCRIPTIONS = {
  '/gigs': 'See the services freelancers are offering.',
  '/gigs/mine': 'View and manage the gigs you have listed.',
  '/gigs/new': 'List a new service for clients to book.',
  '/bookings': 'Track the bookings linked to your account.',
  '/income': 'See your total income from bookings.',
  '/admin': 'Review users and remove inappropriate gigs.',
  '/profile': 'View your account details.',
};

export default function DashboardPage() {
  const { user } = useAuth();
  // Every link except the dashboard itself becomes a card.
  const cards = linksForRole(user.role).filter((link) => link.to !== '/');

  return (
    <section className="page">
      <h1>Welcome, {user.fullName}</h1>
      <p className="muted">
        You are logged in as a <strong>{user.role}</strong>.
      </p>

      <ul className="card-grid">
        {cards.map((card) => (
          <li key={card.to}>
            <Link to={card.to} className="tile">
              <span className="tile-title">{card.label}</span>
              <span className="tile-text">{DESCRIPTIONS[card.to]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}