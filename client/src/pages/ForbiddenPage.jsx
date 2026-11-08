import { Link } from 'react-router-dom';

export default function ForbiddenPage() {
  return (
    <section className="page">
      <h1>Not allowed</h1>
      <p className="muted">Your account type doesn't have access to that page.</p>
      <Link to="/">Back to your dashboard</Link>
    </section>
  );
}