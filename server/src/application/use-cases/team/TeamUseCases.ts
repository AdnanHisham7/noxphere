import { TeamModel } from "../../../infrastructure/database/models/Team.model";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { NotFoundError, BadRequestError } from "../../../shared/errors/AppError";

export interface CreateTeamInput {
  name: string;
  ageGroup: string;
  franchiseId: string;
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
    const team = await TeamModel.create(input);
    return team.toJSON();
  }

  async listTeams(filter: { franchiseId?: string; academyId?: string }) {
    if (!filter.franchiseId && !filter.academyId) {
      throw new BadRequestError("franchiseId or academyId is required");
    }
    let query: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (filter.franchiseId) {
      query.franchiseId = filter.franchiseId;
    } else {
      const franchises = await FranchiseModel.find({ academyId: filter.academyId }).select("_id").lean();
      query.franchiseId = { $in: franchises.map((f) => f._id) };
    }

    const teams = await TeamModel.find(query)
      .populate("coachId", "firstName lastName")
      .sort({ name: 1 })
      .lean();

    const counts = await StudentModel.aggregate([
      { $match: { teamId: { $in: teams.map((t) => t._id) }, deletedAt: { $exists: false } } },
      { $group: { _id: "$teamId", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

    return teams.map((t) => ({
      id: t._id.toString(),
      name: t.name,
      ageGroup: t.ageGroup,
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