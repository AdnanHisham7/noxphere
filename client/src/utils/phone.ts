// src/utils/phone.ts

export interface CountryPhoneConfig {
  code: string;
  countryName: string;
  dialCode: string;
  placeholder: string;
}

export const COUNTRY_PHONE_MAP: Record<string, CountryPhoneConfig> = {
  IN: { code: "IN", countryName: "India", dialCode: "+91", placeholder: "+91 98765 43210" },
  SA: { code: "SA", countryName: "Saudi Arabia", dialCode: "+966", placeholder: "+966 50 123 4567" },
  OM: { code: "OM", countryName: "Oman", dialCode: "+968", placeholder: "+968 9123 4567" },
  AE: { code: "AE", countryName: "United Arab Emirates", dialCode: "+971", placeholder: "+971 50 123 4567" },
  QA: { code: "QA", countryName: "Qatar", dialCode: "+974", placeholder: "+974 3312 3456" },
  KW: { code: "KW", countryName: "Kuwait", dialCode: "+965", placeholder: "+965 9123 4567" },
  BH: { code: "BH", countryName: "Bahrain", dialCode: "+973", placeholder: "+973 3612 3456" },
  US: { code: "US", countryName: "United States", dialCode: "+1", placeholder: "+1 555 012 3456" },
  CA: { code: "CA", countryName: "Canada", dialCode: "+1", placeholder: "+1 555 012 3456" },
  GB: { code: "GB", countryName: "United Kingdom", dialCode: "+44", placeholder: "+44 7911 123456" },
  UK: { code: "GB", countryName: "United Kingdom", dialCode: "+44", placeholder: "+44 7911 123456" },
  DE: { code: "DE", countryName: "Germany", dialCode: "+49", placeholder: "+49 151 2345678" },
  FR: { code: "FR", countryName: "France", dialCode: "+33", placeholder: "+33 6 12 34 56 78" },
  ES: { code: "ES", countryName: "Spain", dialCode: "+34", placeholder: "+34 612 34 56 78" },
  IT: { code: "IT", countryName: "Italy", dialCode: "+39", placeholder: "+39 312 345 6789" },
  AU: { code: "AU", countryName: "Australia", dialCode: "+61", placeholder: "+61 412 345 678" },
  SG: { code: "SG", countryName: "Singapore", dialCode: "+65", placeholder: "+65 8123 4567" },
  MY: { code: "MY", countryName: "Malaysia", dialCode: "+60", placeholder: "+60 12 345 6789" },
  ZA: { code: "ZA", countryName: "South Africa", dialCode: "+27", placeholder: "+27 82 123 4567" },
  NG: { code: "NG", countryName: "Nigeria", dialCode: "+234", placeholder: "+234 801 234 5678" },
  KE: { code: "KE", countryName: "Kenya", dialCode: "+254", placeholder: "+254 712 345678" },
  BR: { code: "BR", countryName: "Brazil", dialCode: "+55", placeholder: "+55 11 91234-5678" },
};

export const CURRENCY_TO_COUNTRY: Record<string, string> = {
  INR: "IN",
  SAR: "SA",
  OMR: "OM",
  AED: "AE",
  QAR: "QA",
  KWD: "KW",
  BHD: "BH",
  USD: "US",
  CAD: "CA",
  GBP: "GB",
  EUR: "DE",
  AUD: "AU",
  SGD: "SG",
  MYR: "MY",
  ZAR: "ZA",
  NGN: "NG",
  KES: "KE",
  BRL: "BR",
};

export const DEFAULT_PHONE_PLACEHOLDER = "+1 555 012 3456";

/**
 * Attempts to detect the user's country code (e.g. "IN", "SA", "OM", "US")
 * using simulated country override, browser timezone, or browser language.
 */
export function detectBrowserCountry(): string | null {
  try {
    const sim = localStorage.getItem("nox_simulated_country");
    if (sim) return sim.toUpperCase().trim();

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.includes("Kolkata") || tz.includes("Calcutta")) return "IN";
    if (tz.includes("Riyadh")) return "SA";
    if (tz.includes("Muscat")) return "OM";
    if (tz.includes("Dubai")) return "AE";
    if (tz.includes("Qatar")) return "QA";
    if (tz.includes("Kuwait")) return "KW";
    if (tz.includes("Bahrain")) return "BH";
    if (tz.includes("London")) return "GB";
    if (tz.startsWith("America/")) return "US";
    if (tz.includes("Berlin") || tz.includes("Paris") || tz.includes("Madrid") || tz.includes("Rome")) return "DE";
    if (tz.includes("Singapore")) return "SG";
    if (tz.includes("Australia/")) return "AU";

    const lang = (navigator.language || "").split("-")[1];
    if (lang && lang.length === 2) {
      return lang.toUpperCase();
    }
  } catch {
    // fallback gracefully
  }
  return null;
}

/**
 * Returns a clean, localized phone number placeholder based on country code
 * or currency code (e.g. "SA" -> "+966 50 123 4567", "OM" -> "+968 9123 4567").
 */
export function getPhonePlaceholder(countryOrCurrency?: string | null): string {
  if (!countryOrCurrency) {
    const detected = detectBrowserCountry();
    if (detected && COUNTRY_PHONE_MAP[detected]) {
      return COUNTRY_PHONE_MAP[detected].placeholder;
    }
    return DEFAULT_PHONE_PLACEHOLDER;
  }

  const clean = countryOrCurrency.toUpperCase().trim();
  if (COUNTRY_PHONE_MAP[clean]) {
    return COUNTRY_PHONE_MAP[clean].placeholder;
  }

  const mappedCountry = CURRENCY_TO_COUNTRY[clean];
  if (mappedCountry && COUNTRY_PHONE_MAP[mappedCountry]) {
    return COUNTRY_PHONE_MAP[mappedCountry].placeholder;
  }

  return DEFAULT_PHONE_PLACEHOLDER;
}

/**
 * Returns the international dial code (e.g. "+966", "+968", "+971", "+91", "+1").
 */
export function getPhoneDialCode(countryOrCurrency?: string | null): string {
  const placeholder = getPhonePlaceholder(countryOrCurrency);
  return placeholder.split(" ")[0] || "+1";
}

