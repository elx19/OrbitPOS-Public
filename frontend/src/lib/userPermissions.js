import definition from '../../../shared/user-permissions.json';

export const PERMISSION_GROUPS = definition.groups || [];

function normalizePermissions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.entries(value).reduce((result, [moduleKey, actions]) => {
    if (Array.isArray(actions)) {
      result[moduleKey] = [...new Set(actions.map((action) => String(action).trim()).filter(Boolean))];
    }
    return result;
  }, {});
}

export function getDefaultPermissions(role = 'cashier') {
  const defaults = definition.defaults?.[role] || definition.defaults?.cashier || {};
  return defaults === 'all' ? '*' : normalizePermissions(defaults) || {};
}

export function getEffectivePermissions(user = {}) {
  if (user.role === 'admin') return '*';
  return normalizePermissions(user.permissions) || getDefaultPermissions(user.role);
}

export function hasModulePermission(user, moduleKey) {
  const permissions = getEffectivePermissions(user);
  if (permissions === '*') return true;
  return Boolean(permissions[moduleKey]?.includes('view'));
}

export function buildPermissionMap(user, checked = true) {
  if (user?.role === 'admin' && checked) return '*';
  return PERMISSION_GROUPS.reduce((result, group) => {
    group.permissions.forEach(({ module, action }) => {
      if (checked) {
        result[module] = [...new Set([...(result[module] || []), action])];
      } else if (!result[module]) {
        result[module] = [];
      }
    });
    return result;
  }, {});
}
