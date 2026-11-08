import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/format';

export default function GigCard({ gig }) {
  const freelancerName =
    gig.freelancer && typeof gig.freelancer === 'object' ? gig.freelancer.fullName : null;

  return (
    <li className="gig-card">
      <Link to={`/gigs/${gig.id}`} className="gig-card-link">
        <span className="gig-category">{gig.category}</span>
        <span className="gig-title">{gig.title}</span>
        <span className="gig-description">{gig.description}</span>
        <span className="gig-footer">
          <span className="muted">{freelancerName ? `by ${freelancerName}` : ''}</span>
          <strong>{formatPrice(gig.price)}</strong>
        </span>
      </Link>
    </li>
  );
}