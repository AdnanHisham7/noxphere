// src/hooks/useCurrency.ts
import { useMemo } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { useCurrentAcademyId } from "./useCurrentAcademyId";
import { academyApi } from "../store/api/academyApi";
import { formatCurrency, getCurrencySymbol, FormatCurrencyOptions } from "../utils/currency";

/**
 * Hook to resolve the currency for the active user/academy context.
 * Automatically resolves the academy currency configured during registration
 * (e.g., OMR, SAR, USD, INR) and provides formatted helper functions.
 */
export function useCurrency(overrideCurrency?: string) {
  const academyId = useCurrentAcademyId();
  const { user } = useSelector((s: RootState) => s.auth);

  const { data: academy } = academyApi.useGetAcademyByIdQuery(academyId ?? "", {
    skip: !academyId,
  });

  const currency = useMemo(() => {
    if (overrideCurrency && overrideCurrency.trim()) {
      return overrideCurrency.toUpperCase().trim();
    }
    const acadCurr = academy?.currency ?? (academy as any)?.data?.currency;
    if (acadCurr && typeof acadCurr === "string" && acadCurr.trim()) {
      return acadCurr.toUpperCase().trim();
    }
    // Fall back to INR if not set
    return "INR";
  }, [overrideCurrency, academy]);

  const currencySymbol = useMemo(() => getCurrencySymbol(currency), [currency]);

  const format = useMemo(() => {
    return (amount: number | null | undefined, options?: FormatCurrencyOptions) =>
      formatCurrency(amount, currency, options);
  }, [currency]);

  return {
    currency,
    currencySymbol,
    format,
  };
}
