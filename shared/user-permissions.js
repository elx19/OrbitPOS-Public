const definition = require('./user-permissions.json');

const ALL_PERMISSION = '*';

function normalizePermissions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return Object.entries(value).reduce((result, [moduleKey, actions]) => {
    if (Array.isArray(actions)) {
      result[moduleKey] = [...new Set(actions.map((action) => String(action).trim()).filter(Boolean))];
    }
    return result;
  }, {});
}

function parseStoredPermissions(value) {
  if (!value) return null;
  if (typeof value === 'object') return normalizePermissions(value);

  try {
    return normalizePermissions(JSON.parse(String(value)));
  } catch (error) {
    return null;
  }
}

function getDefaultPermissions(role = 'cashier') {
  const defaults = definition.defaults?.[role] || definition.defaults?.cashier || {};
  return defaults === 'all' ? ALL_PERMISSION : normalizePermissions(defaults) || {};
}

function getEffectivePermissions(role = 'cashier', storedPermissions = null) {
  if (role === 'admin') return ALL_PERMISSION;
  return parseStoredPermissions(storedPermissions) || getDefaultPermissions(role);
}

function hasPermission(role, storedPermissions, moduleKey, action = 'view') {
  const permissions = getEffectivePermissions(role, storedPermissions);
  if (permissions === ALL_PERMISSION) return true;
  const actions = permissions[moduleKey] || [];
  return actions.includes(action) || actions.includes(ALL_PERMISSION);
}

function hasModulePermission(role, storedPermissions, moduleKey) {
  return hasPermission(role, storedPermissions, moduleKey, 'view');
}

function serializePermissions(value) {
  const normalized = normalizePermissions(value);
  return normalized ? JSON.stringify(normalized) : null;
}

module.exports = {
  ALL_PERMISSION,
  PERMISSION_GROUPS: definition.groups || [],
  normalizePermissions,
  parseStoredPermissions,
  getDefaultPermissions,
  getEffectivePermissions,
  hasPermission,
  hasModulePermission,
  serializePermissions
};
