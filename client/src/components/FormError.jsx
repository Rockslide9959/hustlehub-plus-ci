// Shows a form-level error. role="alert" makes screen readers announce it.
export default function FormError({ message }) {
  if (!message) return null;
  return (
    <div className="alert alert-error" role="alert">
      {message}
    </div>
  );
}
