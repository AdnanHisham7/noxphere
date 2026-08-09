import { TeamModel } from "../../../infrastructure/database/models/Team.model";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { NotFoundError, BadRequestError } from "../../../shared/errors/AppError";

export interface CreateTeamInput {
  name: string;
  ageGroup: string;
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
  coachId?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export class TeamUseCases {
  async createTeam(input: CreateTeamInput) {
    let academyId = input.academyId;
    if (input.franchiseId) {
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
    if (filter.franchiseId) {
      const franchise = await FranchiseModel.findById(filter.franchiseId).select("academyId").lean();
      const academyId = franchise?.academyId;
      query.$or = [
        { franchiseId: filter.franchiseId },
        { academyId: academyId, franchiseId: { $exists: false } },
        { academyId: academyId, franchiseId: null }
      ];
    } else {
      query.academyId = filter.academyId;
    }

    const teams = await TeamModel.find(query)
      .populate("coachId", "firstName lastName")
      .populate("franchiseId", "name")
      .sort({ name: 1 })
      .lean();

    const counts = await StudentModel.aggregate([
      { $match: { teamId: { $in: teams.map((t) => t._id) }, deletedAt: { $exists: false } } },
      { $group: { _id: "$teamId", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

    return teams.map((t: any) => ({
      id: t._id.toString(),
      name: t.name,
      ageGroup: t.ageGroup,
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
      .lean();
    if (!team) throw new NotFoundError("Team not found");
    const students = await StudentModel.find({ teamId: id, deletedAt: { $exists: false } })
      .select("firstName lastName photo jerseyNumber position attendancePercentage overallRating")
      .lean();
    return { ...team, id: team._id.toString(), students };
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
}