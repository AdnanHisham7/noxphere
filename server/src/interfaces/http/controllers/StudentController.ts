// src/interfaces/http/controllers/StudentController.ts
import { Request, Response, NextFunction } from 'express';
import { StudentUseCases } from '../../../application/use-cases/student/StudentUseCases';
import { ResponseHandler } from '../../../shared/utils/ResponseHandler';
import { CreateStudentSchema, UpdateStudentSchema, AddPerformanceSchema, MarkAttendanceSchema, AddCoachRemarkSchema, ListOnTransferSchema } from '../../../application/dtos/student.dto';

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
      const { campId } = req.query;
      if (!campId) throw new Error('campId is required');
      const { page = 1, limit = 20, search, teamId, ageGroup, selectionStatus } = req.query;
      const result = await this.studentUseCases.getStudents(
        campId as string,
        { search, teamId, ageGroup, selectionStatus },
        Number(page),
        Number(limit),
      );
      ResponseHandler.success(res, result, 'Students retrieved');
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

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.studentUseCases.deleteStudent(req.params.id);
      ResponseHandler.noContent(res, 'Student deleted');
    } catch (err) { next(err); }
  };

  addPerformance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = AddPerformanceSchema.parse(req.body);
      const performance = await this.studentUseCases.addPerformance(req.params.id, dto, req.user!.sub);
      ResponseHandler.success(res, performance, 'Performance recorded');
    } catch (err) { next(err); }
  };

  markAttendance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = MarkAttendanceSchema.parse(req.body);
      const attendance = await this.studentUseCases.markAttendance(req.params.id, dto, req.user!.sub);
      ResponseHandler.success(res, attendance, 'Attendance marked');
    } catch (err) { next(err); }
  };

  addCoachRemark = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = AddCoachRemarkSchema.parse(req.body);
      const remark = await this.studentUseCases.addCoachRemark(req.params.id, dto, req.user!.sub);
      ResponseHandler.success(res, remark, 'Remark added');
    } catch (err) { next(err); }
  };

  listOnTransfer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = ListOnTransferSchema.parse(req.body);
      const student = await this.studentUseCases.listOnTransferWall(req.params.id, dto);
      ResponseHandler.success(res, student, 'Student listed on transfer wall');
    } catch (err) { next(err); }
  };

  getPlayerCard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.studentUseCases.getPlayerCard(req.params.id);
      ResponseHandler.success(res, data, 'Player card data');
    } catch (err) { next(err); }
  };
}