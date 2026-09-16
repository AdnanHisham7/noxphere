// src/shared/utils/phone.ts

/**
 * Normalizes phone numbers to standard digits-only format without leading zeros.
 * e.g., '09037532036'    -> '919037532036'
 *       '+91 90375 32036' -> '919037532036'
 *       '9037532036'      -> '919037532036'
 *       '919037532036'    -> '919037532036'
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  let digits = phone.replace(/[^\d]/g, '');
  // Strip leading 0 if 11 digits (e.g. 09037532036 -> 9037532036)
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  // Default 10 digits to +91 (India)
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

/**
 * Returns all common format variants for a given phone number so queries
 * can match numbers regardless of how they were historically saved in MongoDB.
 */
export function getPhoneMatchVariants(phone: string): string[] {
  const norm = normalizePhone(phone);
  if (!norm) return [];
  const variants = new Set<string>();
  variants.add(norm);
  variants.add(`+${norm}`);

  if (norm.startsWith('91') && norm.length === 12) {
    const raw10 = norm.slice(2);
    variants.add(raw10);
    variants.add(`0${raw10}`);
    variants.add(`+91${raw10}`);
    variants.add(`+91 ${raw10}`);
    variants.add(`${raw10.slice(0, 5)} ${raw10.slice(5)}`);
    variants.add(`+91 ${raw10.slice(0, 5)} ${raw10.slice(5)}`);
  }
  return Array.from(variants);
}
