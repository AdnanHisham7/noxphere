// src/interfaces/http/middleware/geoRestriction.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { geoLocationService } from '../../../infrastructure/services/GeoLocationService';

export const enforceAcademyGeoRestriction = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next();
    }

    if (req.user.role === 'super_admin') {
      return next();
    }

    const academyId = req.user.academyId || req.params.academyId;
    if (academyId) {
      await geoLocationService.assertAcademyGeoAccess(req, academyId, req.user.role);
    }
    next();
  } catch (err) {
    next(err);
  }
};
