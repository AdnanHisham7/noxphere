/**
 * Calculates the age category (e.g. U-13, U-15) based on a date of birth string or Date.
 * Uses the player's age in the current year plus 1, bounded between U-5 and U-25.
 */
export const calculateAgeCategory = (dob: string | Date | undefined): string => {
  if (!dob) return 'U-13';
  const dobDate = typeof dob === 'string' ? new Date(dob) : dob;
  if (isNaN(dobDate.getTime())) return 'U-13';
  const today = new Date();
  let age = today.getFullYear() - dobDate.getFullYear();
  const m = today.getMonth() - dobDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
    age--;
  }
  const categoryNum = Math.max(5, Math.min(25, age + 1));
  return `U-${categoryNum}`;
};
