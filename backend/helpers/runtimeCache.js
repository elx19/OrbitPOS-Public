const runtimeCache = new Map();

function getValidEntry(key) {
  const entry = runtimeCache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    runtimeCache.delete(key);
    return null;
  }

  return entry;
}

function setRuntimeCache(key, value, ttlMs = 5000) {
  runtimeCache.set(key, {
    value,
    expiresAt: Date.now() + Math.max(1, Number(ttlMs) || 0)
  });
  return value;
}

function withRuntimeCache(key, ttlMs, factory) {
  const cached = getValidEntry(key);
  if (cached) {
    return cached.value;
  }

  return setRuntimeCache(key, factory(), ttlMs);
}

function clearRuntimeCache(prefix = '') {
  if (!prefix) {
    runtimeCache.clear();
    return;
  }

  Array.from(runtimeCache.keys()).forEach((key) => {
    if (key.startsWith(prefix)) {
      runtimeCache.delete(key);
    }
  });
}

module.exports = {
  clearRuntimeCache,
  setRuntimeCache,
  withRuntimeCache
};
