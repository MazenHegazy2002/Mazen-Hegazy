
/**
 * Zylos Validation Service
 * Standard: E.164 International Phone Format
 * Requires leading +, 1-3 digit country code, and 4-12 digit subscriber number.
 */

export const validatePhone = (phone: string): boolean => {
  // Regex for international phone format: + [country code] [number]
  // Must start with +
  // Then 1-9 (first digit of country code cannot be 0)
  // Followed by 6 to 14 more digits
  const phoneRegex = /^\+[1-9]\d{6,14}$/;
  
  // Strip spaces, dashes, and parentheses for validation
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  return phoneRegex.test(cleaned);
};

export const formatPhoneDisplay = (value: string): string => {
  // 1. Remove all non-digits except the leading +
  let cleaned = value.replace(/[^\d+]/g, '');
  
  // 2. If it's empty, return empty
  if (cleaned.length === 0) return '';
  
  // 3. Ensure it starts with +
  if (cleaned[0] !== '+') {
    cleaned = '+' + cleaned.replace(/\+/g, '');
  } else {
    // Keep only one + at the start
    cleaned = '+' + cleaned.slice(1).replace(/\+/g, '');
  }
  
  // 4. Limit length to E.164 max (15 digits + plus sign = 16)
  return cleaned.substring(0, 16);
};

export const getRussiaStatus = (phone: string): string => {
  if (phone.startsWith('+7')) {
    return "Region: Russia/CIS (Optimized)";
  }
  return "Region: Global";
};
