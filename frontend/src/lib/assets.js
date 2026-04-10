export function resolveAssetUrl(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) {
    return '';
  }

  if (/^(https?:|data:|file:)/i.test(rawValue)) {
    return rawValue;
  }

  const normalized = rawValue.replace(/\\/g, '/');
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return encodeURI(`file:///${normalized}`);
  }

  if (normalized.startsWith('/')) {
    return encodeURI(`file://${normalized}`);
  }

  return rawValue;
}

export function getInitials(value) {
  const words = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!words.length) {
    return 'OP';
  }

  return words.map((word) => word[0]?.toUpperCase() || '').join('');
}
