// src/application/use-cases/student/StudentUseCases.ts
import { IStudentRepository } from "@domain/repositories/IStudentRepository";
import { IUserRepository } from "@domain/repositories/IUserRepository";
import { StudentEntity } from "@domain/entities/Student.entity";
import {
  defaultPermissions,
  UserEntity,
  UserRole,
} from "@domain/entities/User.entity";
import {
  AppError,
  NotFoundError,
  ConflictError,
} from "@shared/errors/AppError";
import {
  CreateStudentDto,
  UpdateStudentDto,
  AddPerformanceDto,
  MarkAttendanceDto,
  AddCoachRemarkDto,
  ListOnTransferDto,
} from "../../dtos/student.dto";
import bcrypt from "bcryptjs";
import mongoose, { Types } from "mongoose";
import { PerformanceModel } from "@infrastructure/database/models/Performance.model";
import { AttendanceModel } from "@infrastructure/database/models/Attendance.model";
import { CoachRemarkModel } from "@infrastructure/database/models/CoachRemark.model";

export class StudentUseCases {
  constructor(
    private studentRepo: IStudentRepository,
    private userRepo: IUserRepository,
  ) {}

  async createStudent(
    dto: CreateStudentDto,
    createdBy: string,
  ): Promise<StudentEntity> {
    // 1. Create user account for student using guardian email
    let user = await this.userRepo.findByEmail(dto.email);
    if (!user) {
      const tempPassword = Math.random().toString(36).slice(-8); // generate random password
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      user = await this.userRepo.create({
        email: dto.email,
        passwordHash,
        role: "student",
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.guardian.phone,
        isActive: true,
        isEmailVerified: false,
        permissions: defaultPermissions["student" as UserRole],
        fcmTokens: [],
      });
      // TODO: Send email with temp password
    }
    // 2. Create student document
    const studentData: Partial<StudentEntity> = {
      userId: user.id,
      campId: dto.campId,
      teamId: dto.teamId,
      coachId: dto.coachId,
      guardianIds: [],
      guardian: dto.guardian,
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: new Date(dto.dateOfBirth),
      ageGroup: dto.ageGroup,
      jerseyNumber: dto.jerseyNumber,
      jerseySize: dto.jerseySize,
      position: dto.position,
      medicalInfo: dto.medicalInfo,
      enrollmentDate: new Date(),
      isActive: true,
      attendancePercentage: 0,
      overallRating: 0,
      selectionStatus: "pending",
      transferStatus: "not_listed",
    };
    return await this.studentRepo.create(studentData);
  }

  async getStudents(
    campId: string,
    filters: any,
    page = 1,
    limit = 20,
  ): Promise<{ items: StudentEntity[]; total: number }> {
    const filter: any = { campId, isActive: true };
    if (filters.teamId) filter.teamId = filters.teamId;
    if (filters.ageGroup) filter.ageGroup = filters.ageGroup;
    if (filters.selectionStatus)
      filter.selectionStatus = filters.selectionStatus;
    if (filters.search) {
      filter.$or = [
        { firstName: { $regex: filters.search, $options: "i" } },
        { lastName: { $regex: filters.search, $options: "i" } },
      ];
    }
    return await this.studentRepo.findAll(filter, page, limit);
  }

  async getStudentById(id: string): Promise<StudentEntity> {
    const student = await this.studentRepo.findById(id);
    if (!student) throw new NotFoundError("Student");
    return student;
  }

  async updateStudent(
    id: string,
    dto: UpdateStudentDto,
  ): Promise<StudentEntity> {
    const { dateOfBirth, ...rest } = dto;
    const updateData: Partial<StudentEntity> = {
      ...rest,
    };
    if (dateOfBirth) {
      updateData.dateOfBirth = new Date(dateOfBirth);
    }
    const student = await this.studentRepo.update(id, updateData);
    if (!student) throw new NotFoundError("Student");
    return student;
  }

  async deleteStudent(id: string): Promise<void> {
    const success = await this.studentRepo.delete(id);
    if (!success) throw new NotFoundError("Student");
  }

  async addPerformance(
    studentId: string,
    dto: AddPerformanceDto,
    coachId: string,
  ): Promise<any> {
    const student = await this.studentRepo.findById(studentId);
    if (!student) throw new NotFoundError("Student");
    const overallScore =
      dto.skillScores.reduce((sum, s) => sum + s.score, 0) /
      dto.skillScores.length;
    const performance = await this.studentRepo.addPerformance({
      studentId: new mongoose.Types.ObjectId(studentId),
      campId: new mongoose.Types.ObjectId(student.campId),
      teamId: student.teamId
        ? new mongoose.Types.ObjectId(student.teamId)
        : undefined,
      coachId: new mongoose.Types.ObjectId(coachId),
      sessionDate: new Date(dto.sessionDate),
      skillScores: dto.skillScores,
      overallScore,
      remarks: dto.remarks,

      videoUrl: dto.videoUrl,
    });
    // Update student overallRating (e.g., average of last 5 performances)
    const recentPerformances = await this.studentRepo.getPerformanceHistory(
      studentId,
      5,
    );
    const avgRating =
      recentPerformances.reduce((sum, p) => sum + p.overallScore, 0) /
      recentPerformances.length;
    await this.studentRepo.update(studentId, {
      overallRating: parseFloat(avgRating.toFixed(1)),
    });
    return performance;
  }

  async markAttendance(
    studentId: string,
    dto: MarkAttendanceDto,
    markedBy: string,
  ): Promise<any> {
    const student = await this.studentRepo.findById(studentId);
    if (!student) throw new NotFoundError("Student");
    const studentObjectId = new Types.ObjectId(studentId);
    const campObjectId = new Types.ObjectId(student.campId);
    const attendance = await this.studentRepo.markAttendance({
      studentId: studentObjectId,
      campId: campObjectId,
      date: new Date(dto.date),
      status: dto.status,
      remarks: dto.remarks,
      markedBy,
    });
    // Recalculate attendance percentage
    const totalDays = await AttendanceModel.countDocuments({
      studentId: studentObjectId,
      campId: campObjectId,
    });
    const presentDays = await AttendanceModel.countDocuments({
      studentId: studentObjectId,
      campId: campObjectId,
      status: "present",
    });
    const percentage = totalDays ? (presentDays / totalDays) * 100 : 0;
    await this.studentRepo.update(studentId, {
      attendancePercentage: parseFloat(percentage.toFixed(1)),
    });
    return attendance;
  }

  async addCoachRemark(
    studentId: string,
    dto: AddCoachRemarkDto,
    coachId: string,
  ): Promise<any> {
    const student = await this.studentRepo.findById(studentId);
    if (!student) throw new NotFoundError("Student");
    return await this.studentRepo.addRemark({
      studentId: new mongoose.Types.ObjectId(studentId),
      coachId: new mongoose.Types.ObjectId(coachId),
      text: dto.text,
      date: new Date(),
    });
  }

  async listOnTransferWall(
    studentId: string,
    dto: ListOnTransferDto,
  ): Promise<StudentEntity> {
    const student = await this.studentRepo.update(studentId, {
      transferStatus: "listed",
      transferPrice: dto.price,
      transferNote: dto.note,
      transferListedAt: new Date(),
    });
    if (!student) throw new NotFoundError("Student");
    return student;
  }

  async getPlayerCard(studentId: string): Promise<any> {
    const student = await this.getStudentById(studentId);
    const performances = await this.studentRepo.getPerformanceHistory(
      studentId,
      10,
    );
    const attendance = await this.studentRepo.getAttendanceHistory(
      studentId,
      30,
    );
    const remarks = await this.studentRepo.getRemarks(studentId);
    return { student, performances, attendance, remarks };
  }
}
