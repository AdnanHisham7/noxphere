import { FranchiseModel, FranchiseDocument } from "../../../infrastructure/database/models/Franchise.model";
import { AcademyModel } from "../../../infrastructure/database/models/Academy.model";
import { AcademySubscriptionModel } from "../../../infrastructure/database/models/AcademySubscription.model";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { SessionModel } from "../../../infrastructure/database/models/Session.model";
import { NotFoundError, ConflictError } from "../../../shared/errors/AppError";
import { CreateFranchiseDto, UpdateFranchiseDto } from "../../dtos/franchise.dto";

function toCard(doc: FranchiseDocument) {
  const j = doc.toJSON() as any;
  return {
    id: j.id,
    academyId: j.academyId?.toString ? j.academyId.toString() : j.academyId,
    name: j.name,
    franchiseCode: j.franchiseCode,
    managerId: j.managerId?.toString ? j.managerId.toString() : j.managerId,
    location: j.location,
    sessionTimes: j.sessionTimes ?? [],
    ageGroups: j.ageGroups,
    maxStudents: j.maxStudents,
    isActive: j.isActive,
    alertBeforeMinutes: j.alertBeforeMinutes,
    notificationAlertAfterMinutes: j.notificationAlertAfterMinutes,
    skillParameters: j.skillParameters,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
  };
}

async function generateCode(baseName: string): Promise<string> {
  const prefix = baseName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, "");
  const random = Math.floor(1000 + Math.random() * 9000);
  let code = `${prefix}-F-${random}`;
  let exists = await FranchiseModel.findOne({ franchiseCode: code });
  let counter = 1;
  while (exists) {
    code = `${prefix}-F-${random}${counter}`;
    exists = await FranchiseModel.findOne({ franchiseCode: code });
    counter++;
  }
  return code;
}

export class FranchiseUseCases {
  async list(filters: { academyId?: string; isActive?: boolean } = {}) {
    const query: Record<string, unknown> = {};
    if (filters.academyId) query.academyId = filters.academyId;
    if (filters.isActive !== undefined) query.isActive = filters.isActive;
    const franchises = await FranchiseModel.find(query)
      .populate("academyId", "name")
      .sort({ createdAt: 1 });

    const franchiseIds = franchises.map((f) => f._id);
    const [counts, sessions] = await Promise.all([
      StudentModel.aggregate([
        {
          $match: {
            franchiseId: { $in: franchiseIds },
            isActive: true,
            deletedAt: { $exists: false },
          },
        },
        {
          $group: {
            _id: { franchiseId: "$franchiseId", ageGroup: "$ageGroup" },
            count: { $sum: 1 },
          },
        },
      ]),
      SessionModel.find({
        franchiseId: { $in: franchiseIds },
        deletedAt: { $exists: false },
      })
        .select("franchiseId date startTime endTime status type category")
        .sort({ date: 1, startTime: 1 })
        .lean(),
    ]);

    const countMap = new Map<string, number>();
    const batchesMap = new Map<string, { ageGroup: string; count: number }[]>();

    counts.forEach((c: any) => {
      const fId = c._id.franchiseId?.toString();
      if (!fId) return;
      countMap.set(fId, (countMap.get(fId) ?? 0) + c.count);
      if (c._id.ageGroup) {
        if (!batchesMap.has(fId)) batchesMap.set(fId, []);
        batchesMap.get(fId)!.push({ ageGroup: c._id.ageGroup, count: c.count });
      }
    });

    // Sort batches by age group (e.g. U-8, U-10, U-14...)
    batchesMap.forEach((batchList) => {
      batchList.sort((a, b) => {
        const numA = parseInt(a.ageGroup.replace(/\D/g, "") || "0", 10);
        const numB = parseInt(b.ageGroup.replace(/\D/g, "") || "0", 10);
        return numA - numB;
      });
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const sessionTimesMap = new Map<string, { dayOfWeek: number; startTime: string; endTime: string }[]>();
    const sessionCountMap = new Map<string, number>();
    const nextSessionMap = new Map<string, { date: string; startTime: string; endTime: string; type: string; category?: string }>();

    for (const s of sessions) {
      if (!s.franchiseId) continue;
      const fId = s.franchiseId.toString();
      sessionCountMap.set(fId, (sessionCountMap.get(fId) ?? 0) + 1);

      if (s.status !== "cancelled" && s.date && s.startTime && s.endTime) {
        // Track next upcoming session today or in future
        if (s.date >= todayStr && !nextSessionMap.has(fId)) {
          nextSessionMap.set(fId, {
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            type: s.type || "training",
            category: s.category,
          });
        }

        if (!sessionTimesMap.has(fId)) {
          sessionTimesMap.set(fId, []);
        }
        const list = sessionTimesMap.get(fId)!;
        const [year, month, day] = s.date.split("-").map(Number);
        if (year && month && day) {
          const d = new Date(year, month - 1, day);
          const dayOfWeek = d.getDay();
          const alreadyExists = list.some(
            (item) => item.dayOfWeek === dayOfWeek && item.startTime === s.startTime,
          );
          if (!alreadyExists) {
            list.push({ dayOfWeek, startTime: s.startTime, endTime: s.endTime });
          }
        }
      }
    }

    return franchises.map((f) => {
      const card = toCard(f);
      const academy = (f as any).academyId;
      const fId = f._id.toString();
      const derivedTimes = sessionTimesMap.get(fId) ?? [];
      const sessionTimes = card.sessionTimes && card.sessionTimes.length > 0 ? card.sessionTimes : derivedTimes;

      return {
        ...card,
        sessionTimes,
        academyId: academy?._id ? academy._id.toString() : card.academyId,
        academyName: academy?.name,
        totalStudents: countMap.get(fId) ?? 0,
        totalSessions: sessionCountMap.get(fId) ?? 0,
        batches: batchesMap.get(fId) ?? [],
        nextSession: nextSessionMap.get(fId) ?? null,
      };
    });
  }

  async getById(id: string) {
    const franchise = await FranchiseModel.findById(id);
    if (!franchise) throw new NotFoundError("Franchise");

    const [batchCounts, sessions] = await Promise.all([
      StudentModel.aggregate([
        {
          $match: {
            franchiseId: franchise._id,
            isActive: true,
            deletedAt: { $exists: false },
          },
        },
        {
          $group: {
            _id: "$ageGroup",
            count: { $sum: 1 },
          },
        },
      ]),
      SessionModel.find({
        franchiseId: id,
        deletedAt: { $exists: false },
      })
        .select("date startTime endTime status type category")
        .sort({ date: 1, startTime: 1 })
        .lean(),
    ]);

    const batches = batchCounts
      .filter((b: any) => b._id)
      .map((b: any) => ({ ageGroup: b._id, count: b.count }))
      .sort((a: any, b: any) => {
        const numA = parseInt(a.ageGroup.replace(/\D/g, "") || "0", 10);
        const numB = parseInt(b.ageGroup.replace(/\D/g, "") || "0", 10);
        return numA - numB;
      });

    const totalStudents = batchCounts.reduce((sum: number, b: any) => sum + b.count, 0);

    const todayStr = new Date().toISOString().slice(0, 10);
    const nextSession = sessions.find((s) => s.status !== "cancelled" && s.date >= todayStr);

    const card = toCard(franchise);
    let sessionTimes = card.sessionTimes;
    if (!sessionTimes || sessionTimes.length === 0) {
      const derivedTimes: { dayOfWeek: number; startTime: string; endTime: string }[] = [];
      for (const s of sessions) {
        if (s.status !== "cancelled" && s.date && s.startTime && s.endTime) {
          const [year, month, day] = s.date.split("-").map(Number);
          if (year && month && day) {
            const d = new Date(year, month - 1, day);
            const dayOfWeek = d.getDay();
            if (!derivedTimes.some((it) => it.dayOfWeek === dayOfWeek && it.startTime === s.startTime)) {
              derivedTimes.push({ dayOfWeek, startTime: s.startTime, endTime: s.endTime });
            }
          }
        }
      }
      sessionTimes = derivedTimes;
    }

    return {
      ...card,
      sessionTimes,
      totalStudents,
      totalSessions: sessions.length,
      batches,
      nextSession: nextSession ? {
        date: nextSession.date,
        startTime: nextSession.startTime,
        endTime: nextSession.endTime,
        type: nextSession.type || "training",
        category: nextSession.category,
      } : null,
    };
  }

  async create(dto: CreateFranchiseDto) {
    const academy = await AcademyModel.findById(dto.academyId);
    if (!academy) throw new NotFoundError("Academy");

    const subscription = await AcademySubscriptionModel.findOne({ academyId: dto.academyId }).lean();
    const purchasedCapacity = subscription?.provisionedCapacity;
    const finalMaxStudents = dto.maxStudents ?? (purchasedCapacity && purchasedCapacity > 0 ? purchasedCapacity : 100);

    const franchiseCode = await generateCode(dto.name);
    const franchise = await FranchiseModel.create({
      academyId: dto.academyId,
      name: dto.name,
      franchiseCode,
      managerId: dto.managerId,
      location: dto.location,
      sessionTimes: dto.sessionTimes ?? [],
      ageGroups: dto.ageGroups,
      maxStudents: finalMaxStudents,
      alertBeforeMinutes: dto.alertBeforeMinutes,
      notificationAlertAfterMinutes: dto.notificationAlertAfterMinutes,
      skillParameters: academy.skillParameters,
      isActive: true,
    });
    return toCard(franchise);
  }

  async update(id: string, dto: UpdateFranchiseDto) {
    const franchise = await FranchiseModel.findById(id);
    if (!franchise) throw new NotFoundError("Franchise");

    if (dto.name !== undefined) franchise.name = dto.name;
    if (dto.managerId !== undefined) franchise.managerId = dto.managerId as any;
    if (dto.location) franchise.location = { ...franchise.location, ...dto.location } as any;
    if (dto.sessionTimes !== undefined) franchise.sessionTimes = dto.sessionTimes as any;
    if (dto.ageGroups !== undefined) franchise.ageGroups = dto.ageGroups;
    if (dto.maxStudents !== undefined) franchise.maxStudents = dto.maxStudents;
    if (dto.alertBeforeMinutes !== undefined) franchise.alertBeforeMinutes = dto.alertBeforeMinutes;
    if (dto.notificationAlertAfterMinutes !== undefined) franchise.notificationAlertAfterMinutes = dto.notificationAlertAfterMinutes;

    await franchise.save();
    return toCard(franchise);
  }

  async toggleActive(id: string) {
    const franchise = await FranchiseModel.findById(id);
    if (!franchise) throw new NotFoundError("Franchise");
    franchise.isActive = !franchise.isActive;
    await franchise.save();
    return toCard(franchise);
  }

  async delete(id: string, academyId: string): Promise<void> {
    const remaining = await FranchiseModel.countDocuments({ academyId, isActive: true });
    const franchise = await FranchiseModel.findById(id);
    if (!franchise) throw new NotFoundError("Franchise");
    if (remaining <= 1 && franchise.isActive) {
      throw new ConflictError("Cannot delete the only active franchise in an academy");
    }
    franchise.deletedAt = new Date();
    franchise.isActive = false;
    await franchise.save();
  }
}
