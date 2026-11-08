export const GIG_CATEGORIES = [
  'Design',
  'Development',
  'Writing',
  'Marketing',
  'Video & Animation',
  'Music & Audio',
  'Business',
  'Other',
];

const NO_HTML = /[<>]/;

export function validateGig({ title, description, price, category }) {
  const errors = {};
  const cleanTitle = title.trim();
  const cleanDescription = description.trim();
  const amount = Number(price);

  if (!cleanTitle) errors.title = 'Title is required.';
  else if (cleanTitle.length < 5 || cleanTitle.length > 100)
    errors.title = 'Title must be between 5 and 100 characters.';
  else if (NO_HTML.test(cleanTitle)) errors.title = 'Title must not contain < or >.';

  if (!cleanDescription) errors.description = 'Description is required.';
  else if (cleanDescription.length < 20 || cleanDescription.length > 1000)
    errors.description = 'Description must be between 20 and 1000 characters.';
  else if (NO_HTML.test(cleanDescription)) errors.description = 'Description must not contain < or >.';

  if (String(price).trim() === '' || !Number.isFinite(amount)) errors.price = 'Price must be a number.';
  else if (amount < 1 || amount > 1000000) errors.price = 'Price must be between R1 and R1,000,000.';
  else if (Math.round(amount * 100) !== amount * 100) errors.price = 'Price can have at most 2 decimal places.';

  if (!GIG_CATEGORIES.includes(category)) errors.category = 'Choose a category.';

  return errors;
}

export function toGigPayload({ title, description, price, category, isActive }) {
  return {
    title: title.trim(),
    description: description.trim(),
    price: Number(price),
    category,
    isActive,
  };
}