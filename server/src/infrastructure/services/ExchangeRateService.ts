// src/infrastructure/services/ExchangeRateService.ts
import { SUPPORTED_CURRENCY_MAP } from "./GeoLocationService";

interface CachedRates {
  timestamp: number;
  ratesToInr: Record<string, number>;
  isLive: boolean;
}

// 1 hour cache TTL for verified live rates
const SUCCESS_CACHE_TTL_MS = 60 * 60 * 1000;
// 20 seconds cache TTL for fallback so errors recover almost immediately
const FALLBACK_CACHE_TTL_MS = 20 * 1000;

export class ExchangeRateService {
  private cache: CachedRates | null = null;
  private pendingFetch: Promise<Record<string, number>> | null = null;

  /**
   * Clear in-memory cache to force a fresh live fetch.
   */
  clearCache(): void {
    this.cache = null;
  }

  /**
   * Fetch live exchange rates against INR using USD as the global anchor.
   * Rates are retrieved from open.er-api.com (free, covers all GCC + global currencies),
   * with secondary fallback to Frankfurter API.
   */
  private async fetchRates(): Promise<Record<string, number>> {
    const now = Date.now();
    if (this.cache) {
      const ttl = this.cache.isLive ? SUCCESS_CACHE_TTL_MS : FALLBACK_CACHE_TTL_MS;
      if (now - this.cache.timestamp < ttl) {
        return this.cache.ratesToInr;
      }
    }

    if (this.pendingFetch) {
      return this.pendingFetch;
    }

    this.pendingFetch = (async () => {
      const liveRates: Record<string, number> = { INR: 1 };
      let fetchSucceeded = false;

      try {
        // Primary: open.er-api.com anchor on USD (gives live INR, AED, SAR, OMR, KWD, QAR, BHD, EUR, GBP)
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch("https://open.er-api.com/v6/latest/USD", {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data: any = await res.json();
          if (data && data.rates && typeof data.rates === "object" && data.rates.INR) {
            const inrPerUsd = Number(data.rates.INR);
            liveRates["USD"] = Math.round(inrPerUsd * 10000) / 10000;

            for (const [code, rateAgainstUsd] of Object.entries<number>(data.rates)) {
              if (rateAgainstUsd && rateAgainstUsd > 0) {
                // 1 unit of Code = (INR per USD) / (Code per USD)
                const inrRate = inrPerUsd / rateAgainstUsd;
                liveRates[code.toUpperCase()] = Math.round(inrRate * 10000) / 10000;
              }
            }
            fetchSucceeded = true;
          }
        }
      } catch (err: any) {
        console.warn(`[ExchangeRateService] Primary USD live rate fetch failed (${err?.message}), attempting secondary fallback...`);
      }

      if (!fetchSucceeded) {
        try {
          // Secondary fallback: Frankfurter API for ECB-tracked currencies
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          const fRes = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR,EUR,GBP", {
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (fRes.ok) {
            const fData: any = await fRes.json();
            if (fData?.rates?.INR) {
              const inrPerUsd = Number(fData.rates.INR);
              liveRates["USD"] = Math.round(inrPerUsd * 10000) / 10000;
              if (fData.rates.EUR) liveRates["EUR"] = Math.round((inrPerUsd / fData.rates.EUR) * 10000) / 10000;
              if (fData.rates.GBP) liveRates["GBP"] = Math.round((inrPerUsd / fData.rates.GBP) * 10000) / 10000;
              fetchSucceeded = true;
            }
          }
        } catch (err: any) {
          console.warn(`[ExchangeRateService] Secondary live rate fetch failed (${err?.message}), applying baseline fallback.`);
        }
      }

      // Fill in any missing currencies with baseline values
      for (const [code, config] of Object.entries(SUPPORTED_CURRENCY_MAP)) {
        if (!liveRates[code] || liveRates[code] <= 0) {
          liveRates[code] = config.exchangeRateToInr || 1;
        }
      }

      this.cache = {
        timestamp: Date.now(),
        ratesToInr: liveRates,
        isLive: fetchSucceeded,
      };

      return liveRates;
    })().finally(() => {
      this.pendingFetch = null;
    });

    return this.pendingFetch;
  }

  /**
   * Get live exchange rate of 1 unit of foreign currency into INR.
   * e.g. getRateToInr("USD") -> ~86.5
   */
  async getRateToInr(currency?: string): Promise<number> {
    if (!currency) return 1;
    const code = currency.toUpperCase().trim();
    if (code === "INR") return 1;

    try {
      const rates = await this.fetchRates();
      if (rates[code] && rates[code] > 0) {
        return rates[code];
      }
    } catch {
      // Fallback
    }

    return this.getFallbackRate(code);
  }

  /**
   * Convert an amount in foreign currency to INR at the current live spot rate.
   * Returns both the rate used and the calculated amountInInr for snapshotting.
   */
  async convertToInr(
    amount: number,
    fromCurrency?: string
  ): Promise<{ rate: number; amountInInr: number }> {
    if (!amount || isNaN(amount)) {
      return { rate: 1, amountInInr: 0 };
    }
    const code = (fromCurrency || "INR").toUpperCase().trim();
    if (code === "INR") {
      const rounded = Math.round(amount * 100) / 100;
      return { rate: 1, amountInInr: rounded };
    }

    const rate = await this.getRateToInr(code);
    const amountInInr = Math.round(amount * rate * 100) / 100;
    return { rate, amountInInr };
  }

  /**
   * Get all live rates to INR for supported platform currencies.
   */
  async getAllLiveRates(): Promise<Record<string, number>> {
    const rates = await this.fetchRates();
    const result: Record<string, number> = {};
    for (const code of Object.keys(SUPPORTED_CURRENCY_MAP)) {
      result[code] = rates[code] || this.getFallbackRate(code);
    }
    return result;
  }

  /**
   * Synchronous static fallback
   */
  getFallbackRate(currency?: string): number {
    if (!currency) return 1;
    const code = currency.toUpperCase().trim();
    if (code === "INR") return 1;
    return SUPPORTED_CURRENCY_MAP[code]?.exchangeRateToInr || 1;
  }
}

export const exchangeRateService = new ExchangeRateService();
