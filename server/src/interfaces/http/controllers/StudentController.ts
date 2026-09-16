import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { StudentUseCases } from '../../../application/use-cases/student/StudentUseCases';
import { ResponseHandler } from '../../../shared/utils/ResponseHandler';
import {
  CreateStudentSchema,
  UpdateStudentSchema,
  AddCoachRemarkSchema,
  UpdateStudentStatusSchema,
  TransferStudentFranchiseSchema,
  RegisterPublicStudentSchema,
  ClaimStudentSchema,
} from '../../../application/dtos/student.dto';
import { ForbiddenError } from '../../../shared/errors/AppError';


export class StudentController {
  constructor(private studentUseCases: StudentUseCases) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = CreateStudentSchema.parse(req.body);
      const student = await this.studentUseCases.createStudent(dto, req.user!.sub);
      ResponseHandler.created(res, student, 'Student enrolled successfully');
    } catch (err) { next(err); }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { franchiseId } = req.query;
      if (!franchiseId) throw new Error('franchiseId is required');
      const { page = 1, limit = 20, search, teamId, ageGroup, selectionStatus } = req.query;
      // A coach only ever sees players on a team assigned to them (or
      // explicitly assigned to them directly), regardless of what else
      // is requested.
      const restrictToCoachId = req.user!.role === 'coach' ? req.user!.sub : undefined;
      const result = await this.studentUseCases.getStudents(
        franchiseId as string,
        { search, teamId, ageGroup, selectionStatus },
        Number(page),
        Number(limit),
        restrictToCoachId,
      );
      ResponseHandler.success(res, result, 'Students retrieved');
    } catch (err) { next(err); }
  };

  getAgeCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { franchiseId, academyId } = req.query;
      const categories = await this.studentUseCases.getDistinctAgeCategories(
        franchiseId as string | undefined,
        academyId as string | undefined,
      );
      ResponseHandler.success(res, categories, 'Age categories retrieved');
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const student = await this.studentUseCases.getStudentById(req.params.id);
      ResponseHandler.success(res, student, 'Student retrieved');
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = UpdateStudentSchema.parse(req.body);
      const student = await this.studentUseCases.updateStudent(req.params.id, dto);
      ResponseHandler.success(res, student, 'Student updated');
    } catch (err) { next(err); }
  };

  updatePhoto = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { photo } = z.object({ photo: z.string().url() }).parse(req.body);
      const student = await this.studentUseCases.updateStudentPhoto(req.params.id, photo);
      ResponseHandler.success(res, student, 'Photo updated');
    } catch (err) { next(err); }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.studentUseCases.deleteStudent(req.params.id);
      ResponseHandler.noContent(res, 'Student deleted');
    } catch (err) { next(err); }
  };

  // NOTE: freeform per-student addPerformance/markAttendance endpoints used
  // to live here. Attendance/performance can now only be recorded against
  // a real scheduled session — see ScheduleController.markAttendance /
  // logPerformance (POST /schedule/:id/attendance, /schedule/:id/performance).

  addCoachRemark = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = AddCoachRemarkSchema.parse(req.body);
      const remark = await this.studentUseCases.addCoachRemark(req.params.id, dto, req.user!.sub);
      ResponseHandler.success(res, remark, 'Remark added');
    } catch (err) { next(err); }
  };

  getPlayerCard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.studentUseCases.getPlayerCard(req.params.id);
      ResponseHandler.success(res, data, 'Player card data');
    } catch (err) { next(err); }
  };

  getReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.studentUseCases.getStudentReport(req.params.id, {
        userId: req.user!.sub,
        role: req.user!.role,
        academyId: req.user!.academyId,
        franchiseId: req.user!.franchiseId,
        permissions: req.user!.permissions,
      });
      ResponseHandler.success(res, data, 'Student report data');
    } catch (err) { next(err); }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = UpdateStudentStatusSchema.parse(req.body);
      const student = await this.studentUseCases.updateStudentStatus(req.params.id, dto.status);
      ResponseHandler.success(res, student, 'Player status updated');
    } catch (err) { next(err); }
  };

  transferFranchise = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Only Head Office (an academy-owner manager with no franchiseId of
      // their own, or super_admin) may move a player between franchises —
      // a manager locked to a single franchise has no authority over the
      // destination franchise. Mirrors FranchiseController's role checks.
      if (req.user!.role === 'manager' && req.user!.franchiseId) {
        throw new ForbiddenError('Only Head Office can transfer players between franchises');
      }
      const dto = TransferStudentFranchiseSchema.parse(req.body);
      const student = await this.studentUseCases.transferStudentFranchise(req.params.id, dto, {
        userId: req.user!.sub,
        academyId: req.user!.academyId,
        isSuperAdmin: req.user!.role === 'super_admin',
      });
      ResponseHandler.success(res, student, 'Player transferred to new franchise');
    } catch (err) { next(err); }
  };

  getTransferHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const history = await this.studentUseCases.getFranchiseTransferHistory(req.params.id);
      ResponseHandler.success(res, history, 'Transfer history retrieved');
    } catch (err) { next(err); }
  };

  registerPublic = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = RegisterPublicStudentSchema.parse(req.body);
      const result = await this.studentUseCases.registerPublicStudent(dto);
      ResponseHandler.created(res, result, 'Public student account created');
    } catch (err) { next(err); }
  };

  getUnattached = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, ageGroup, page = 1, limit = 50 } = req.query;
      const result = await this.studentUseCases.getUnattachedStudents(
        search as string,
        ageGroup as string,
        Number(page),
        Number(limit),
      );
      ResponseHandler.success(res, result, 'Unattached students retrieved');
    } catch (err) { next(err); }
  };

  claimUnattached = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = ClaimStudentSchema.parse(req.body);
      const academyId = (req.user as any)?.academyId;
      if (!academyId) throw new ForbiddenError('Academy context required to add student');
      const student = await this.studentUseCases.claimUnattachedStudent(req.params.id, dto, academyId);
      ResponseHandler.success(res, student, 'Student enrolled into franchise');
    } catch (err) { next(err); }
  };
}