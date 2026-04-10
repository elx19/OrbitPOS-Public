export const API_BASE_URL =
  window.orbit?.backendUrl ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3030';

const apiResponseCache = new Map();

function clonePayload(payload) {
  if (payload === null || typeof payload !== 'object') {
    return payload;
  }

  if (typeof structuredClone === 'function') {
    return structuredClone(payload);
  }

  return JSON.parse(JSON.stringify(payload));
}

function buildCacheId(path, cacheKey, token) {
  return `${cacheKey || path}::${token ? token.slice(-18) : 'guest'}`;
}

function clearExpiredApiCache() {
  const now = Date.now();

  Array.from(apiResponseCache.entries()).forEach(([key, entry]) => {
    if (!entry.promise && entry.expiresAt <= now) {
      apiResponseCache.delete(key);
    }
  });
}

export function invalidateApiCache(cacheKeyPrefix = '') {
  if (!cacheKeyPrefix) {
    apiResponseCache.clear();
    return;
  }

  Array.from(apiResponseCache.keys()).forEach((key) => {
    if (key.startsWith(`${cacheKeyPrefix}::`)) {
      apiResponseCache.delete(key);
    }
  });
}

export async function apiRequest(path, { method = 'GET', body, token, cacheMs = 0, cacheKey, forceFresh = false, signal } = {}) {
  const normalizedMethod = String(method || 'GET').toUpperCase();
  const shouldCache = normalizedMethod === 'GET' && cacheMs > 0;
  const resolvedCacheId = shouldCache ? buildCacheId(path, cacheKey, token) : null;

  if (shouldCache) {
    clearExpiredApiCache();

    const cachedEntry = apiResponseCache.get(resolvedCacheId);
    if (!forceFresh && cachedEntry?.promise) {
      return clonePayload(await cachedEntry.promise);
    }

    if (!forceFresh && cachedEntry && Object.prototype.hasOwnProperty.call(cachedEntry, 'value') && cachedEntry.expiresAt > Date.now()) {
      return clonePayload(cachedEntry.value);
    }
  }

  const requestPromise = fetch(`${API_BASE_URL}${path}`, {
    method: normalizedMethod,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal
  }).then(async (response) => {
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await response.json() : null;

    if (!response.ok) {
      throw new Error(payload?.message || 'No fue posible completar la solicitud.');
    }

    if (shouldCache) {
      apiResponseCache.set(resolvedCacheId, {
        value: clonePayload(payload),
        expiresAt: Date.now() + cacheMs
      });
    }

    return payload;
  }).catch((error) => {
    if (shouldCache) {
      apiResponseCache.delete(resolvedCacheId);
    }
    throw error;
  });

  if (shouldCache) {
    apiResponseCache.set(resolvedCacheId, {
      promise: requestPromise,
      expiresAt: Date.now() + cacheMs
    });
  }

  return clonePayload(await requestPromise);
}
