const businessProfiles = require('../../shared/business-profiles.json');
const { getDb } = require('../database');

function getBusinessType() {
  return getDb().prepare("SELECT value FROM config WHERE key = 'business_type'").get()?.value || 'colmado';
}

function getBusinessCategories() {
  const profile = businessProfiles[getBusinessType()] || businessProfiles.colmado;
  return profile.categories || businessProfiles.colmado.categories;
}

function isAllowedBusinessCategory(category) {
  const normalized = String(category || '').trim().toLowerCase();
  return !normalized || getBusinessCategories().some((allowed) => allowed.toLowerCase() === normalized);
}

function categoryPlaceholders(alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return {
    sql: `${prefix}category IN (${getBusinessCategories().map(() => '?').join(', ')})`,
    values: getBusinessCategories()
  };
}

module.exports = {
  getBusinessType,
  getBusinessCategories,
  isAllowedBusinessCategory,
  categoryPlaceholders
};
