import profiles from '../../../shared/business-profiles.json';

export const BUSINESS_PROFILES = profiles;

export function getBusinessProfile(type = 'colmado') {
  return profiles[type] || profiles.colmado;
}

export function getBusinessCategories(type = 'colmado') {
  return getBusinessProfile(type).categories;
}
