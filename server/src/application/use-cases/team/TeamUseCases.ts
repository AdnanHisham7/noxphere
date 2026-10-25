import mongoose from "mongoose";
import { TeamModel } from "../../../infrastructure/database/models/Team.model";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { NotFoundError, BadRequestError } from "../../../shared/errors/AppError";

export interface CreateTeamInput {
  name: string;
  ageGroup: string;
  teamFormat?: string;
  franchiseId?: string;
  academyId?: string;
  coachId?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export interface UpdateTeamInput {
  name?: string;
  ageGroup?: string;
  teamFormat?: string;
  coachId?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export interface FormationPresetInput {
  id: string;
  label: string;
  formationType: string;
  teamFormat?: string;
  squad: Record<string, string>;
}

export class TeamUseCases {
  async createTeam(input: CreateTeamInput) {
    let academyId = input.academyId;
    if (!academyId && input.franchiseId) {
      const franchise = await FranchiseModel.findById(input.franchiseId).select("academyId").lean();
      if (franchise) {
        academyId = franchise.academyId.toString();
      }
    }
    const team = await TeamModel.create({
      ...input,
      academyId,
    });
    return team.toJSON();
  }

  async listTeams(filter: { franchiseId?: string; academyId?: string }) {
    if (!filter.franchiseId && !filter.academyId) {
      throw new BadRequestError("franchiseId or academyId is required");
    }
    let query: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (filter.academyId) {
      const franchises = await FranchiseModel.find({ academyId: filter.academyId }).select("_id").lean();
      const franchiseIds = franchises.map((f) => f._id);
      query.$or = [
        { academyId: filter.academyId },
        { franchiseId: { $in: franchiseIds } },
      ];
    } else if (filter.franchiseId) {
      const franchise = await FranchiseModel.findById(filter.franchiseId).select("academyId").lean();
      const academyId = franchise?.academyId;
      if (academyId) {
        const franchises = await FranchiseModel.find({ academyId }).select("_id").lean();
        const franchiseIds = franchises.map((f) => f._id);
        query.$or = [
          { academyId: academyId },
          { franchiseId: { $in: franchiseIds } },
        ];
      } else {
        query.franchiseId = filter.franchiseId;
      }
    }

    const teams = await TeamModel.find(query)
      .populate("coachId", "firstName lastName")
      .populate("franchiseId", "name")
      .populate("academyId", "name")
      .sort({ name: 1 })
      .lean();

    const teamObjectIds = teams.map((t) => t._id);
    const counts = await StudentModel.aggregate([
      {
        $match: {
          $or: [
            { teamId: { $in: teamObjectIds } },
            { teamIds: { $in: teamObjectIds } },
          ],
          deletedAt: { $exists: false },
        },
      },
      {
        $project: {
          allTeams: {
            $setUnion: [
              { $ifNull: ["$teamIds", []] },
              { $cond: [{ $ifNull: ["$teamId", false] }, ["$teamId"], []] },
            ],
          },
        },
      },
      { $unwind: "$allTeams" },
      { $match: { allTeams: { $in: teamObjectIds } } },
      { $group: { _id: "$allTeams", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

    return teams.map((t: any) => ({
      id: t._id.toString(),
      name: t.name,
      ageGroup: t.ageGroup,
      teamFormat: t.teamFormat || "11s",
      academyId: t.academyId?._id?.toString() || t.academyId?.toString(),
      franchiseId: t.franchiseId?._id?.toString() || t.franchiseId?.toString(),
      franchise: t.franchiseId && typeof t.franchiseId === 'object' ? {
        id: t.franchiseId._id.toString(),
        name: t.franchiseId.name
      } : undefined,
      coach: t.coachId,
      description: t.description,
      logoUrl: t.logoUrl,
      bannerUrl: t.bannerUrl,
      primaryColor: t.primaryColor,
      secondaryColor: t.secondaryColor,
      studentCount: countMap.get(t._id.toString()) ?? 0,
    }));
  }

  async getTeamById(id: string): Promise<Record<string, unknown>> {
    const team = await TeamModel.findOne({ _id: id, deletedAt: { $exists: false } })
      .populate("coachId", "firstName lastName")
      .populate("franchiseId", "name")
      .populate("academyId", "name")
      .lean();
    if (!team) throw new NotFoundError("Team not found");

    const teamObjId = new mongoose.Types.ObjectId(id);
    const students = await StudentModel.find({
      $or: [{ teamId: teamObjId }, { teamIds: teamObjId }],
      deletedAt: { $exists: false },
    })
      .select("firstName lastName photo jerseyNumber position attendancePercentage overallRating teamId teamIds franchiseId")
      .populate("franchiseId", "name")
      .lean();

    const formattedStudents = students.map((s: any) => ({
      ...s,
      _id: s._id.toString(),
      franchiseId: s.franchiseId?._id?.toString() || s.franchiseId?.toString(),
      franchise: s.franchiseId && typeof s.franchiseId === "object" ? {
        id: s.franchiseId._id?.toString() || s.franchiseId.toString(),
        name: s.franchiseId.name,
      } : undefined,
      branchName: s.franchiseId && typeof s.franchiseId === "object" ? s.franchiseId.name : undefined,
    }));

    // Normalize formationPresets: squad stored as Mongoose Map, convert to plain object
    const formationPresets = ((team as any).formationPresets ?? []).map((fp: any) => ({
      id: fp.id,
      label: fp.label,
      formationType: fp.formationType,
      teamFormat: fp.teamFormat || "11s",
      squad: fp.squad instanceof Map
        ? Object.fromEntries(fp.squad)
        : (fp.squad && typeof fp.squad === "object" ? { ...fp.squad } : {}),
    }));

    return {
      ...team,
      id: team._id.toString(),
      teamFormat: (team as any).teamFormat || "11s",
      students: formattedStudents,
      formationPresets,
    };
  }

  async updateTeam(id: string, input: UpdateTeamInput) {
    const team = await TeamModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      { $set: input },
      { new: true },
    );
    if (!team) throw new NotFoundError("Team not found");
    return team.toJSON();
  }

  async deleteTeam(id: string) {
    const team = await TeamModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      { $set: { deletedAt: new Date() } },
    );
    if (!team) throw new NotFoundError("Team not found");
  }

  async saveFormationPreset(teamId: string, preset: FormationPresetInput) {
    const team = await TeamModel.findOne({ _id: teamId, deletedAt: { $exists: false } });
    if (!team) throw new NotFoundError("Team not found");

    // Replace if same id exists, otherwise push
    const presets: any[] = (team as any).formationPresets ?? [];
    const idx = presets.findIndex((p: any) => p.id === preset.id);
    if (idx >= 0) {
      presets[idx] = preset;
    } else {
      presets.push(preset);
    }
    (team as any).formationPresets = presets;
    await team.save();

    return preset;
  }

  async deleteFormationPreset(teamId: string, presetId: string) {
    const team = await TeamModel.findOne({ _id: teamId, deletedAt: { $exists: false } });
    if (!team) throw new NotFoundError("Team not found");

    const presets: any[] = (team as any).formationPresets ?? [];
    (team as any).formationPresets = presets.filter((p: any) => p.id !== presetId);
    await team.save();
  }

  async addStudentToTeam(teamId: string, studentId: string) {
    const team = await TeamModel.findOne({ _id: teamId, deletedAt: { $exists: false } });
    if (!team) throw new NotFoundError("Team not found");

    const student = await StudentModel.findOne({ _id: studentId, deletedAt: { $exists: false } });
    if (!student) throw new NotFoundError("Student not found");

    const teamObjId = new mongoose.Types.ObjectId(teamId);
    await StudentModel.findByIdAndUpdate(studentId, {
      $addToSet: { teamIds: teamObjId },
      ...(!student.teamId ? { $set: { teamId: teamObjId } } : {}),
    });
  }

  async removeStudentFromTeam(teamId: string, studentId: string) {
    const student = await StudentModel.findById(studentId);
    if (!student) throw new NotFoundError("Student not found");

    const teamObjId = new mongoose.Types.ObjectId(teamId);
    const remainingTeamIds = (student.teamIds || [])
      .filter((tid: any) => tid.toString() !== teamId);

    const update: Record<string, unknown> = {
      $pull: { teamIds: teamObjId },
    };

    if (student.teamId?.toString() === teamId) {
      update.$set = {
        teamId: remainingTeamIds.length > 0 ? remainingTeamIds[0] : null,
      };
    }

    await StudentModel.findByIdAndUpdate(studentId, update);
  }
}