// src/interfaces/http/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../../config/app.config';
import { UnauthorizedError, ForbiddenError, GeoRestrictionError } from '../../../shared/errors/AppError';
import { UserRole } from '../../../domain/entities/User.entity';
import { geoLocationService } from '../../../infrastructure/services/GeoLocationService';
import { AcademyModel } from '../../../infrastructure/database/models/Academy.model';
import { FranchiseModel } from '../../../infrastructure/database/models/Franchise.model';
import { StudentModel } from '../../../infrastructure/database/models/Student.model';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  franchiseId?: string;
  academyId?: string;
  permissions: Record<string, boolean>;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;
    req.user = payload;

    if (req.user && req.user.role !== 'super_admin') {
      let academyId = req.user.academyId;
      if (!academyId && (req.user.role === 'manager' || req.user.role === 'operational_manager')) {
        const managed = await AcademyModel.findOne({ managerId: req.user.sub }).select('_id').lean();
        if (managed) {
          academyId = managed._id.toString();
          req.user.academyId = academyId;
        }
      } else if (!academyId && req.user.franchiseId) {
        const franchise = await FranchiseModel.findById(req.user.franchiseId).select('academyId').lean();
        if (franchise?.academyId) {
          academyId = franchise.academyId.toString();
          req.user.academyId = academyId;
        }
      } else if (!academyId && (req.user.role === 'guardian' || req.user.role === 'student')) {
        const student = await StudentModel.findOne({
          $or: [{ guardianIds: req.user.sub }, { userId: req.user.sub }],
          deletedAt: { $exists: false },
        }).select('franchiseId academyId').lean();
        if (student?.franchiseId) {
          const franchise = await FranchiseModel.findById(student.franchiseId).select('academyId').lean();
          if (franchise?.academyId) {
            academyId = franchise.academyId.toString();
            req.user.academyId = academyId;
          }
        } else if ((student as any)?.academyId) {
          academyId = (student as any).academyId.toString();
          req.user.academyId = academyId;
        }
      }

      if (academyId) {
        const academy = await AcademyModel.findById(academyId).select('isActive name deletedAt').lean();
        if (!academy || academy.isActive === false || academy.deletedAt) {
          throw new UnauthorizedError(`Academy "${academy?.name || 'Your academy'}" has been deactivated by the administrator. Access is denied.`);
        }

        const geoStatus = await geoLocationService.checkAcademyGeoAccess(req, academyId, req.user.role);
        if (geoStatus) {
          (req as any).geoStatus = geoStatus;
          res.setHeader('x-geo-restricted', geoStatus.isRestricted ? 'true' : 'false');
          if (geoStatus.detectedCountry) res.setHeader('x-detected-country', geoStatus.detectedCountry);
          if (geoStatus.requiredCountry) res.setHeader('x-required-country', geoStatus.requiredCountry);
          if (geoStatus.allowedCountryName) res.setHeader('x-allowed-country-name', geoStatus.allowedCountryName);
          if (geoStatus.detectedCountryName) res.setHeader('x-detected-country-name', geoStatus.detectedCountryName);
          if (geoStatus.academyName) res.setHeader('x-academy-name', encodeURIComponent(geoStatus.academyName));
          res.setHeader(
            'Access-Control-Expose-Headers',
            'x-geo-restricted, x-detected-country, x-required-country, x-allowed-country-name, x-detected-country-name, x-academy-name'
          );

          if (geoStatus.isRestricted) {
            const isSafeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
            const isAuthExempt = req.originalUrl?.includes('/auth/logout') || req.originalUrl?.includes('/auth/refresh');
            if (!isSafeMethod && !isAuthExempt) {
              throw new GeoRestrictionError(
                `Access Denied (Read-Only Mode): Performing operations or modifying data for "${geoStatus.academyName}" is restricted to its registered country (${geoStatus.allowedCountryName}). You are currently connected from ${geoStatus.detectedCountryName} (${geoStatus.detectedCountry}). Data can be viewed in read-only mode, but creation, edits, and deletions are disabled.`,
                geoStatus.detectedCountry,
                geoStatus.requiredCountry,
                geoStatus.currency
              );
            }
          }
        }
      }
    }

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired'));
    } else if (err instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else {
      next(err);
    }
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError(`Insufficient role permissions. Required: ${roles.join(', ')}, Got: ${req.user?.role}`));
      return;
    }
    next();
  };
};

export const requirePermission = (permission: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!req.user.permissions[permission]) {
      next(new ForbiddenError(`Missing permission: ${permission}`));
      return;
    }
    next();
  };
};
