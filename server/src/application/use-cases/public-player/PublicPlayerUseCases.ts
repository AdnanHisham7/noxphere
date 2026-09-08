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
  ageGroup?: string;
  overallRating?: number;
  teamName?: string;
  franchiseName?: string;
  academyName?: string;
  bio?: string;
  preferredFoot?: string;
  isFreeAgent: boolean;
}

export class PublicPlayerUseCases {
  // Deliberately returns a small, hand-picked subset of fields — never
  // date of birth (only ageGroup), guardian contact info, medical info,
  // fee records, or coach remarks, regardless of what's added to Student
  // in the future. A public, unauthenticated NFC/QR page is the highest-
  // exposure surface in the whole app, so this stays an explicit
  // allowlist rather than "everything except a blocklist".
  async getByToken(token: string): Promise<PublicPlayerProfile> {
    const student = await StudentModel.findOne({
      publicProfileToken: token,
      publicProfileEnabled: true,
    })
      .select(
        "firstName lastName photo position jerseyNumber ageGroup overallRating teamId franchiseId publicProfileSettings",
      )
      .lean();
    if (!student) throw new NotFoundError("Player page");

    const settings = student.publicProfileSettings || {};
    const showPhoto = settings.showPhoto !== false;
    const showPosition = settings.showPosition !== false;
    const showJerseyNumber = settings.showJerseyNumber !== false;
    const showAgeGroup = settings.showAgeGroup !== false;
    const showRating = settings.showRating !== false;
    const showTeam = settings.showTeam !== false;

    const isFreeAgent = !student.franchiseId;
    let franchiseName: string | undefined = isFreeAgent ? "Independent" : undefined;
    let academyName: string | undefined = isFreeAgent ? "Free Agent" : undefined;
    let teamName: string | undefined;

    if (showTeam && student.franchiseId) {
      const franchise = await FranchiseModel.findById(student.franchiseId).select("name academyId").lean();
      if (franchise) {
        franchiseName = franchise.name;
        const academy = await AcademyModel.findById(franchise.academyId).select("name").lean();
        if (academy) academyName = academy.name;
      }
    }

    if (showTeam && student.teamId) {
      const team = await TeamModel.findById(student.teamId).select("name").lean();
      teamName = team?.name;
    }

    return {
      firstName: student.firstName,
      lastName: student.lastName,
      photo: showPhoto ? student.photo : undefined,
      position: showPosition ? student.position : undefined,
      jerseyNumber: showJerseyNumber ? student.jerseyNumber : undefined,
      ageGroup: showAgeGroup ? student.ageGroup : undefined,
      overallRating: showRating ? student.overallRating : undefined,
      teamName,
      franchiseName,
      academyName,
      bio: settings.bio?.trim() || undefined,
      preferredFoot: settings.preferredFoot?.trim() || undefined,
      isFreeAgent,
    };
  }
}