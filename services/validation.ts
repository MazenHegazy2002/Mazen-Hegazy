
import { COUNTRIES } from '../constants';

/**
 * Zylos Validation Service
 * Standard: E.164 International Phone Format
 */

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^\+[1-9]\d{6,14}$/;
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  return phoneRegex.test(cleaned);
};

export const formatPhoneDisplay = (value: string): string => {
  let cleaned = value.replace(/[^\d+]/g, '');
  if (cleaned.length === 0) return '';
  if (cleaned[0] !== '+') {
    cleaned = '+' + cleaned.replace(/\+/g, '');
  } else {
    cleaned = '+' + cleaned.slice(1).replace(/\+/g, '');
  }
  return cleaned.substring(0, 16);
};

/**
 * Detects the region based on the phone code and returns an optimization status
 */
export const getRegionStatus = (phone: string): string => {
  if (!phone || !phone.startsWith('+')) return "Region: Global";
  
  // Try to find the country by matching the start of the phone number
  // Sort countries by code length descending to match +1-809 before +1
  const sortedCountries = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length);
  const matchedCountry = sortedCountries.find(c => phone.startsWith(`+${c.code}`));
  
  if (matchedCountry) {
    return `Region: ${matchedCountry.name} (Neural Sync Active)`;
  }
  
  return "Region: Global (Optimized)";
};
