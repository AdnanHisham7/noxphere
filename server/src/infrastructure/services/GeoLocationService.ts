// src/infrastructure/services/GeoLocationService.ts
import { Request } from 'express';
import geoip from 'geoip-lite';
import { AcademyModel } from '../database/models/Academy.model';
import { GeoRestrictionError, UnauthorizedError } from '../../shared/errors/AppError';

export interface CurrencyConfigItem {
  currency: string;
  countryCode: string;
  countryName: string;
  symbol: string;
  defaultRatePerStudentPerDay: number;
  defaultStaffRatePerStaffPerMonth: number;
}

export const SUPPORTED_CURRENCY_MAP: Record<string, CurrencyConfigItem> = {
  INR: {
    currency: 'INR',
    countryCode: 'IN',
    countryName: 'India',
    symbol: '₹',
    defaultRatePerStudentPerDay: 1,
    defaultStaffRatePerStaffPerMonth: 10,
  },
  SAR: {
    currency: 'SAR',
    countryCode: 'SA',
    countryName: 'Saudi Arabia',
    symbol: 'SAR',
    defaultRatePerStudentPerDay: 0.25,
    defaultStaffRatePerStaffPerMonth: 5,
  },
  OMR: {
    currency: 'OMR',
    countryCode: 'OM',
    countryName: 'Oman',
    symbol: 'OMR',
    defaultRatePerStudentPerDay: 0.05,
    defaultStaffRatePerStaffPerMonth: 1,
  },
  USD: {
    currency: 'USD',
    countryCode: 'US',
    countryName: 'United States',
    symbol: '$',
    defaultRatePerStudentPerDay: 0.1,
    defaultStaffRatePerStaffPerMonth: 2,
  },
  AED: {
    currency: 'AED',
    countryCode: 'AE',
    countryName: 'United Arab Emirates',
    symbol: 'AED',
    defaultRatePerStudentPerDay: 0.25,
    defaultStaffRatePerStaffPerMonth: 5,
  },
  KWD: {
    currency: 'KWD',
    countryCode: 'KW',
    countryName: 'Kuwait',
    symbol: 'KWD',
    defaultRatePerStudentPerDay: 0.04,
    defaultStaffRatePerStaffPerMonth: 0.8,
  },
  QAR: {
    currency: 'QAR',
    countryCode: 'QA',
    countryName: 'Qatar',
    symbol: 'QAR',
    defaultRatePerStudentPerDay: 0.25,
    defaultStaffRatePerStaffPerMonth: 5,
  },
  BHD: {
    currency: 'BHD',
    countryCode: 'BH',
    countryName: 'Bahrain',
    symbol: 'BHD',
    defaultRatePerStudentPerDay: 0.05,
    defaultStaffRatePerStaffPerMonth: 1,
  },
  EUR: {
    currency: 'EUR',
    countryCode: 'EU',
    countryName: 'European Union',
    symbol: '€',
    defaultRatePerStudentPerDay: 0.09,
    defaultStaffRatePerStaffPerMonth: 1.8,
  },
  GBP: {
    currency: 'GBP',
    countryCode: 'GB',
    countryName: 'United Kingdom',
    symbol: '£',
    defaultRatePerStudentPerDay: 0.08,
    defaultStaffRatePerStaffPerMonth: 1.6,
  },
};

export const COUNTRY_NAMES: Record<string, string> = {
  IN: 'India',
  SA: 'Saudi Arabia',
  OM: 'Oman',
  US: 'United States',
  AE: 'United Arab Emirates',
  KW: 'Kuwait',
  QA: 'Qatar',
  BH: 'Bahrain',
  EU: 'European Union',
  GB: 'United Kingdom',
};

class GeoLocationService {
  /**
   * Returns standard 2-letter uppercase country code from request
   */
  detectClientCountry(req: Request): string {
    // 1. Simulation header for testing / local QA / super admin evaluation
    const simulated =
      req.headers['x-simulated-country'] ||
      req.headers['x-client-country'] ||
      (req.query?.simulatedCountry as string);
    if (simulated && typeof simulated === 'string') {
      return simulated.trim().toUpperCase();
    }

    // 2. Standard CDN / Reverse Proxy Headers
    const cfCountry = req.headers['cf-ipcountry'];
    if (cfCountry && typeof cfCountry === 'string' && cfCountry !== 'XX' && cfCountry !== 'T1') {
      return cfCountry.trim().toUpperCase();
    }

    const customCountry =
      req.headers['x-country-code'] ||
      req.headers['x-vercel-ip-country'] ||
      req.headers['x-geo-country'];
    if (customCountry && typeof customCountry === 'string') {
      return customCountry.trim().toUpperCase();
    }

    // 3. Check client IP
    const rawIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string)?.trim() ||
      req.socket.remoteAddress ||
      req.ip ||
      '';

    const cleanIp = rawIp.replace(/^::ffff:/, '');

    // Private / Loopback IPs in development
    if (
      !cleanIp ||
      cleanIp === '127.0.0.1' ||
      cleanIp === '::1' ||
      cleanIp.startsWith('10.') ||
      cleanIp.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp)
    ) {
      return 'DEV_LOCAL';
    }

    // 4. Resolve country via geoip-lite lookup for public IPs
    try {
      const geo = geoip.lookup(cleanIp);
      if (geo && geo.country) {
        return geo.country.trim().toUpperCase();
      }
    } catch (err) {
      console.error('GeoIP lookup error for IP:', cleanIp, err);
    }

    // Fallback if IP cannot be resolved
    return 'IN';
  }

  getCountryForCurrency(currency: string): string {
    const cur = currency?.toUpperCase();
    return SUPPORTED_CURRENCY_MAP[cur]?.countryCode || 'IN';
  }

  getCountryName(countryCode: string): string {
    return COUNTRY_NAMES[countryCode?.toUpperCase()] || countryCode || 'Unknown';
  }

  getCurrencySymbol(currency: string): string {
    return getCurrencySymbol(currency);
  }

  /**
   * Checks whether the request originates from the country designated for the academy.
   * Does NOT throw; returns comprehensive status for reporting, headers, and UI alerts.
   */
  async checkAcademyGeoAccess(
    req: Request,
    academyId: string,
    userRole?: string
  ): Promise<GeoAccessStatus | null> {
    // Super admins manage the entire platform across all territories
    if (userRole === 'super_admin') return null;

    if (!academyId) return null;

    const academy = await AcademyModel.findById(academyId)
      .select('name currency country isActive')
      .lean();

    if (!academy) return null;

    if (academy.isActive === false) {
      throw new UnauthorizedError(
        `Academy "${academy.name || 'Your academy'}" has been deactivated by the administrator. Access is denied.`
      );
    }

    const requiredCountry = (
      academy.country ||
      this.getCountryForCurrency(academy.currency) ||
      'IN'
    ).toUpperCase();

    const detectedCountry = this.detectClientCountry(req);
    const allowedCountryName = this.getCountryName(requiredCountry);
    const detectedCountryName = this.getCountryName(detectedCountry);
    const currency = academy.currency || 'INR';
    const academyName = academy.name || 'Academy';

    // If running in local dev without explicit simulated header, allow access
    const isDevLocal = detectedCountry === 'DEV_LOCAL';
    const isRestricted = !isDevLocal && detectedCountry !== requiredCountry;

    return {
      isRestricted,
      detectedCountry,
      requiredCountry,
      allowedCountryName,
      detectedCountryName,
      currency,
      academyName,
    };
  }

  /**
   * Asserts that mutation operations originate from the academy's designated country.
   * Read-only requests (GET, HEAD, OPTIONS) and auth session endpoints are permitted globally.
   */
  async assertAcademyGeoAccess(
    req: Request,
    academyId: string,
    userRole?: string
  ): Promise<void> {
    const status = await this.checkAcademyGeoAccess(req, academyId, userRole);
    if (!status || !status.isRestricted) return;

    // Permit read requests globally so managers and coaches can view dashboards and reports abroad
    const method = req.method?.toUpperCase();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return;
    }

    // Exempt essential session management
    if (req.originalUrl?.includes('/auth/logout') || req.originalUrl?.includes('/auth/refresh')) {
      return;
    }

    throw new GeoRestrictionError(
      `Access Denied (Read-Only Mode): Performing operations or modifying data for "${status.academyName}" is restricted to its registered country (${status.allowedCountryName}). You are currently connected from ${status.detectedCountryName} (${status.detectedCountry}). Data can be viewed in read-only mode, but creation, edits, and deletions are disabled.`,
      status.detectedCountry,
      status.requiredCountry,
      status.currency
    );
  }
}

export interface GeoAccessStatus {
  isRestricted: boolean;
  detectedCountry: string;
  requiredCountry: string;
  allowedCountryName: string;
  detectedCountryName: string;
  currency: string;
  academyName: string;
}

export const geoLocationService = new GeoLocationService();

export function getCurrencySymbol(currency?: string): string {
  if (!currency) return '₹';
  return SUPPORTED_CURRENCY_MAP[currency.toUpperCase()]?.symbol || currency;
}
