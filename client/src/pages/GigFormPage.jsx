import { useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useApi } from '../hooks/useApi';
import { createGig, getGig, updateGig } from '../api/gigsApi';
import GigForm from '../components/GigForm';
import FormError from '../components/FormError';

const EMPTY_GIG = { title: '', description: '', price: '', category: '', isActive: true };

// /gigs/new creates a gig; /gigs/:id/edit edits one.
export default function GigFormPage() {
  const { id } = useParams();
  return id ? <EditGig id={id} /> : <CreateGig />;
}

function CreateGig() {
  const { token } = useAuth();
  const navigate = useNavigate();

  async function handleCreate(gig) {
    const result = await createGig(token, gig);
    navigate(`/gigs/${result.data.id}`, { replace: true });
  }

  return (
    <section className="card card-wide">
      <h1>Create a gig</h1>
      <GigForm initialValues={EMPTY_GIG} submitLabel="Create gig" onSubmit={handleCreate} />
    </section>
  );
}

function EditGig({ id }) {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const load = useCallback(() => getGig(token, id), [token, id]);
  const { data, error, loading } = useApi(load);

  if (loading) return <p className="muted">Loading gig…</p>;
  if (error) return <FormError message={error} />;

  const gig = data.data;
  const ownerId = gig.freelancer && typeof gig.freelancer === 'object' ? gig.freelancer.id : gig.freelancer;

  // The API refuses edits from anyone but the owner; this just explains it up front.
  if (String(ownerId) !== String(user.id)) {
    return (
      <section className="page">
        <h1>Not allowed</h1>
        <p className="muted">You can only edit gigs you created.</p>
        <Link to="/gigs/mine">Go to my gigs</Link>
      </section>
    );
  }

  async function handleUpdate(changes) {
    await updateGig(token, id, changes);
    navigate(`/gigs/${id}`, { replace: true });
  }

  const initialValues = {
    title: gig.title,
    description: gig.description,
    price: String(gig.price),
    category: gig.category,
    isActive: gig.isActive,
  };

  return (
    <section className="card card-wide">
      <h1>Edit gig</h1>
      <GigForm initialValues={initialValues} submitLabel="Save changes" onSubmit={handleUpdate} />
    </section>
  );
}