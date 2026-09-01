// src/application/use-cases/public-player/PublicPlayerUseCases.ts
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { TeamModel } from "../../../infrastructure/database/models/Team.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { AcademyModel } from "../../../infrastructure/database/models/Academy.model";
import { NotFoundError } from "../../../shared/errors/AppError";

export interface PublicPlayerProfile {
  firstName: string;
  lastName: string;
  photo?: string;
  position?: string;
  jerseyNumber?: number;
  ageGroup: string;
  overallRating: number;
  teamName?: string;
  franchiseName: string;
  academyName: string;
}

export class PublicPlayerUseCases {
  // Deliberately returns a small, hand-picked subset of fields — never
  // date of birth (only ageGroup), guardian contact info, medical info,
  // fee records, or coach remarks, regardless of what's added to Student
  // in the future. A public, unauthenticated NFC/QR page is the highest-
  // exposure surface in the whole app, so this stays an explicit
  // allowlist rather than "everything except a blocklist".
  async getByToken(token: string): Promise<PublicPlayerProfile> {
    const student = await StudentModel.findOne({ publicProfileToken: token, publicProfileEnabled: true })
      .select("firstName lastName photo position jerseyNumber ageGroup overallRating teamId franchiseId")
      .lean();
    if (!student) throw new NotFoundError("Player page");

    const [team, franchise] = await Promise.all([
      student.teamId ? TeamModel.findById(student.teamId).select("name").lean() : null,
      FranchiseModel.findById(student.franchiseId).select("name academyId").lean(),
    ]);
    if (!franchise) throw new NotFoundError("Player page");

    const academy = await AcademyModel.findById(franchise.academyId).select("name").lean();

    return {
      firstName: student.firstName,
      lastName: student.lastName,
      photo: student.photo,
      position: student.position,
      jerseyNumber: student.jerseyNumber,
      ageGroup: student.ageGroup,
      overallRating: student.overallRating,
      teamName: team?.name,
      franchiseName: franchise.name,
      academyName: academy?.name ?? "",
    };
  }
}