// src/interfaces/http/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../../config/app.config';
import { UnauthorizedError, ForbiddenError } from '../../../shared/errors/AppError';
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

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
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
        await geoLocationService.assertAcademyGeoAccess(req, academyId, req.user.role);
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
