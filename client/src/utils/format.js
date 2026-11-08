const priceFormatter = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });
const dateFormatter = new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium' });

export function formatPrice(amount) {
  return typeof amount === 'number' ? priceFormatter.format(amount) : '–';
}

export function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '–' : dateFormatter.format(date);
}