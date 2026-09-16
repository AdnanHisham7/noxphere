// src/interfaces/http/controllers/SquadInvitationController.ts
import { Request, Response, NextFunction } from 'express';
import { SquadInvitationUseCases } from '../../../application/use-cases/student/SquadInvitationUseCases';
import { ResponseHandler } from '../../../shared/utils/ResponseHandler';
import { BadRequestError } from '../../../shared/errors/AppError';

export class SquadInvitationController {
  constructor(private readonly useCases: SquadInvitationUseCases) {}

  send = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) {
        throw new BadRequestError('User is not associated with an academy');
      }

      const { studentId, franchiseId, teamId, jerseyNumber, position, notes } = req.body;
      if (!studentId || !franchiseId) {
        throw new BadRequestError('studentId and franchiseId are required');
      }

      const result = await this.useCases.sendInvitation(req.user!.sub, academyId, {
        studentId,
        franchiseId,
        teamId,
        jerseyNumber: jerseyNumber ? Number(jerseyNumber) : undefined,
        position,
        notes,
      });

      ResponseHandler.created(res, result, 'Squad invitation sent successfully');
    } catch (err) {
      next(err);
    }
  };

  getMyInvitations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.useCases.getMyInvitations(req.user!.sub);
      ResponseHandler.success(res, result, 'Retrieved invitations');
    } catch (err) {
      next(err);
    }
  };

  sendGuardianOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { guardianEmail, invitationId } = req.body;
      if (!guardianEmail || !invitationId) {
        throw new BadRequestError('guardianEmail and invitationId are required');
      }

      const result = await this.useCases.sendGuardianOtp(
        req.user!.sub,
        invitationId,
        guardianEmail
      );
      ResponseHandler.success(res, result, result.message);
    } catch (err) {
      next(err);
    }
  };

  respond = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const {
        action,
        rejectionReason,
        guardianEmail,
        guardianName,
        guardianPhone,
        guardianPassword,
        otp,
      } = req.body;

      if (!id || id === 'undefined') {
        throw new BadRequestError('A valid squad invitation ID is required');
      }

      if (!action || !['accept', 'reject'].includes(action)) {
        throw new BadRequestError('Action must be either "accept" or "reject"');
      }

      const result = await this.useCases.respondToInvitation(
        req.user!.sub,
        id,
        {
          action,
          rejectionReason,
          guardianEmail,
          guardianName,
          guardianPhone,
          guardianPassword,
          otp,
        }
      );

      ResponseHandler.success(
        res,
        result,
        action === 'accept'
          ? 'Squad invitation accepted! Welcome to the squad.'
          : 'Squad invitation declined.'
      );
    } catch (err) {
      next(err);
    }
  };

  getAcademyInvitations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) {
        throw new BadRequestError('User is not associated with an academy');
      }

      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const result = await this.useCases.getAcademyInvitations(academyId, status);
      ResponseHandler.success(res, result, 'Retrieved academy squad invitations');
    } catch (err) {
      next(err);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) {
        throw new BadRequestError('User is not associated with an academy');
      }

      const { id } = req.params;
      const result = await this.useCases.cancelInvitation(academyId, id);
      ResponseHandler.success(res, result, 'Squad invitation cancelled');
    } catch (err) {
      next(err);
    }
  };
}
