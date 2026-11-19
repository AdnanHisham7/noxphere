// src/hooks/usePhonePlaceholder.ts
import { useMemo } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { useCurrentAcademyId } from "./useCurrentAcademyId";
import { academyApi } from "../store/api/academyApi";
import { getPhonePlaceholder, getPhoneDialCode } from "../utils/phone";

/**
 * Hook that resolves a dynamic, country-appropriate phone number placeholder
 * and international dial code based on:
 * 1. Explicit override (if provided)
 * 2. Active Academy's country or currency
 * 3. Geo-restriction jurisdiction (requiredCountry, currency, or detectedCountry)
 * 4. User's browser timezone or locale
 */
export function usePhonePlaceholder(overrideCountryOrCurrency?: string | null) {
  const academyId = useCurrentAcademyId();
  const geo = useSelector((s: RootState) => s.auth?.geoRestriction);

  const { data: academy } = academyApi.useGetAcademyByIdQuery(academyId ?? "", {
    skip: !academyId,
  });

  const resolvedCountryOrCurrency = useMemo(() => {
    if (overrideCountryOrCurrency && overrideCountryOrCurrency.trim()) {
      return overrideCountryOrCurrency.trim();
    }
    const acadCountry = academy?.country;
    if (acadCountry && typeof acadCountry === "string" && acadCountry.trim()) {
      return acadCountry.trim();
    }
    const acadCurr = academy?.currency;
    if (acadCurr && typeof acadCurr === "string" && acadCurr.trim()) {
      return acadCurr.trim();
    }
    if (geo?.requiredCountry) {
      return geo.requiredCountry;
    }
    if (geo?.currency) {
      return geo.currency;
    }
    if (geo?.detectedCountry) {
      return geo.detectedCountry;
    }
    return null;
  }, [overrideCountryOrCurrency, academy, geo]);

  const placeholder = useMemo(() => {
    return getPhonePlaceholder(resolvedCountryOrCurrency);
  }, [resolvedCountryOrCurrency]);

  const dialCode = useMemo(() => {
    return getPhoneDialCode(resolvedCountryOrCurrency);
  }, [resolvedCountryOrCurrency]);

  return {
    placeholder,
    dialCode,
  };
}

