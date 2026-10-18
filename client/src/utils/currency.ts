// src/utils/currency.ts

export const SUPPORTED_CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  OMR: "OMR",
  SAR: "SAR",
  USD: "$",
  AED: "AED",
  EUR: "€",
  GBP: "£",
  QAR: "QAR",
  KWD: "KWD",
  BHD: "BHD",
};

/**
 * Returns the display symbol or code for a given currency code.
 * Defaults to '₹' if no currency is specified.
 */
export function getCurrencySymbol(currency?: string): string {
  if (!currency) return "₹";
  const code = currency.toUpperCase().trim();
  return SUPPORTED_CURRENCY_SYMBOLS[code] || code;
}

export interface FormatCurrencyOptions {
  hideSymbol?: boolean;
  compact?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

/**
 * Standard monetary formatting function that adapts to the academy's currency.
 * - For OMR (Oman Rial), formats with up to 3 decimal places when needed.
 * - For INR, uses 'en-IN' numbering system (e.g. Lakhs / Crores when compact).
 * - For international currencies, uses standard 2-decimal formatting or compact notation.
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency?: string,
  options?: FormatCurrencyOptions
): string {
  const num = Number(amount || 0);
  const code = (currency || "INR").toUpperCase().trim();
  const symbol = getCurrencySymbol(code);
  const isOMR = code === "OMR";
  const isINR = code === "INR";

  if (options?.compact) {
    if (isINR && Math.abs(num) >= 10000000) {
      const val = `${(num / 10000000).toFixed(2)}Cr`;
      return options.hideSymbol ? val : `${symbol}${val}`;
    }
    if (isINR && Math.abs(num) >= 100000) {
      const val = `${(num / 100000).toFixed(1)}L`;
      return options.hideSymbol ? val : `${symbol}${val}`;
    }
    if (Math.abs(num) >= 1000) {
      const val = `${(num / 1000).toFixed(1)}k`;
      const sep = symbol.length > 1 ? " " : "";
      return options.hideSymbol ? val : `${symbol}${sep}${val}`;
    }
  }

  // Fraction digits handling
  const defaultMin = isOMR ? (num % 1 !== 0 ? 3 : 0) : num % 1 !== 0 ? 2 : 0;
  const defaultMax = isOMR ? 3 : 2;

  const minDigits = options?.minimumFractionDigits ?? defaultMin;
  const maxDigits = options?.maximumFractionDigits ?? defaultMax;

  const formattedNum = num.toLocaleString(isINR ? "en-IN" : "en-US", {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  });

  if (options?.hideSymbol) return formattedNum;

  // Multi-letter symbols like OMR, SAR, AED get a separating space; single glyphs (₹, $, €) do not.
  const separator = symbol.length > 1 ? " " : "";
  return `${symbol}${separator}${formattedNum}`;
}
