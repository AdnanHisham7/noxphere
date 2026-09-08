// src/application/use-cases/public-player/PublicPlayerUseCases.ts
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { TeamModel } from "../../../infrastructure/database/models/Team.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { AcademyModel } from "../../../infrastructure/database/models/Academy.model";
import { PerformanceModel } from "../../../infrastructure/database/models/Performance.model";
import { NotFoundError } from "../../../shared/errors/AppError";

export interface TacticalAttributes {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

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
  attributes?: TacticalAttributes | null;
  totalEvaluations?: number;
}

/**
 * Computes authentic tactical attributes (1-99) and overall rating from
 * verified coach session evaluations recorded in PerformanceModel.
 */
function computeTacticalAttributes(
  performances: Array<{ overallScore: number; skillScores: { parameter: string; score: number }[] }>
): { attributes: TacticalAttributes; overallRating: number } {
  const buckets = {
    pace: [] as number[],
    shooting: [] as number[],
    passing: [] as number[],
    dribbling: [] as number[],
    defending: [] as number[],
    physical: [] as number[],
  };

  const allScores: number[] = [];

  for (const perf of performances) {
    if (typeof perf.overallScore === "number" && !isNaN(perf.overallScore) && perf.overallScore > 0) {
      allScores.push(perf.overallScore);
    }
    for (const item of perf.skillScores || []) {
      const p = item.parameter.toLowerCase().trim();
      const s = item.score;
      if (typeof s !== "number" || isNaN(s)) continue;

      let matched = false;

      // Pace / Speed
      if (
        p.includes("speed") ||
        p.includes("pace") ||
        p.includes("sprint") ||
        p.includes("acceleration") ||
        p.includes("quick") ||
        p.includes("agility")
      ) {
        buckets.pace.push(s);
        matched = true;
      }
      // Shooting / Finishing
      if (
        p.includes("shoot") ||
        p.includes("finish") ||
        p.includes("shot") ||
        p.includes("strike") ||
        p.includes("striking") ||
        p.includes("heading") ||
        p.includes("goal") ||
        p.includes("volley")
      ) {
        buckets.shooting.push(s);
        matched = true;
      }
      // Passing / Vision
      if (
        p.includes("pass") ||
        p.includes("vision") ||
        p.includes("cross") ||
        p.includes("crossing") ||
        p.includes("distribution") ||
        p.includes("playmak")
      ) {
        buckets.passing.push(s);
        matched = true;
      }
      // Dribbling / Technique / Ball control
      if (
        p.includes("dribbl") ||
        p.includes("ball control") ||
        p.includes("touch") ||
        p.includes("technique") ||
        p.includes("skill") ||
        p.includes("flair")
      ) {
        buckets.dribbling.push(s);
        matched = true;
      }
      // Defending / Tactical awareness
      if (
        p.includes("defen") ||
        p.includes("tackl") ||
        p.includes("tactical") ||
        p.includes("marking") ||
        p.includes("intercept") ||
        p.includes("position")
      ) {
        buckets.defending.push(s);
        matched = true;
      }
      // Physicality / Attitude / Stamina
      if (
        p.includes("attitude") ||
        p.includes("physical") ||
        p.includes("stamina") ||
        p.includes("strength") ||
        p.includes("fitness") ||
        p.includes("endurance") ||
        p.includes("power") ||
        p.includes("work rate")
      ) {
        buckets.physical.push(s);
        matched = true;
      }

      if (!matched) {
        allScores.push(s);
      }
    }
  }

  const baselineScore = allScores.length
    ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length
    : 7.0;

  const toRating = (values: number[]): number => {
    const raw = values.length
      ? values.reduce((sum, score) => sum + score, 0) / values.length
      : baselineScore;
    // Map 0-10 score to standard 1-99 rating
    return Math.min(99, Math.max(40, Math.round(raw * 10)));
  };

  const calculatedOverall = Math.min(99, Math.max(40, Math.round(baselineScore * 10)));

  return {
    attributes: {
      pace: toRating(buckets.pace),
      shooting: toRating(buckets.shooting),
      passing: toRating(buckets.passing),
      dribbling: toRating(buckets.dribbling),
      defending: toRating(buckets.defending),
      physical: toRating(buckets.physical),
    },
    overallRating: calculatedOverall,
  };
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

    // Dynamic attribute calculation:
    // Only calculate attributes for players enrolled in an academy who have real performance records
    let attributes: TacticalAttributes | null = null;
    let computedOverallRating: number | undefined;
    let totalEvaluations = 0;

    if (!isFreeAgent) {
      const performances = await PerformanceModel.find({ studentId: student._id })
        .sort({ sessionDate: -1 })
        .limit(20)
        .lean();

      totalEvaluations = performances.length;

      if (performances.length > 0) {
        const computed = computeTacticalAttributes(performances);
        if (showRating) {
          attributes = computed.attributes;
          computedOverallRating = computed.overallRating;
        }
      } else if (showRating && student.overallRating && student.overallRating > 0) {
        // Fallback to existing overallRating if recorded on student
        computedOverallRating = Math.min(99, Math.max(40, Math.round(student.overallRating * 10)));
      }
    }

    return {
      firstName: student.firstName,
      lastName: student.lastName,
      photo: showPhoto ? student.photo : undefined,
      position: showPosition ? student.position : undefined,
      jerseyNumber: showJerseyNumber ? student.jerseyNumber : undefined,
      ageGroup: showAgeGroup ? student.ageGroup : undefined,
      overallRating: computedOverallRating,
      teamName,
      franchiseName,
      academyName,
      bio: settings.bio?.trim() || undefined,
      preferredFoot: settings.preferredFoot?.trim() || undefined,
      isFreeAgent,
      attributes,
      totalEvaluations,
    };
  }
}