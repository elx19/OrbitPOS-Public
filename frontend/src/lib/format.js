export function formatCurrency(value) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export function formatDate(value) {
  if (!value) {
    return '--';
  }

  return new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'medium'
  }).format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) {
    return '--';
  }

  return new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

