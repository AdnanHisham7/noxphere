// src/interfaces/http/controllers/DashboardController.ts
import { Request, Response, NextFunction } from "express";
import { DashboardUseCases } from "../../../application/use-cases/dashboard/DashboardUseCases";
import { ResponseHandler } from "../../../shared/utils/ResponseHandler";

export class DashboardController {
  constructor(private readonly dashboardUseCases: DashboardUseCases) {}

  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { franchiseId, academyId } = req.query;
      const isSuperAdmin = req.user?.role === "super_admin";
      const data = await this.dashboardUseCases.getStats({
        franchiseId: franchiseId as string | undefined,
        academyId: academyId as string | undefined,
        isSuperAdmin,
      });
      ResponseHandler.success(res, data, "Dashboard stats retrieved");
    } catch (err) {
      next(err);
    }
  };

  getAttendanceTrend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { franchiseId, academyId, days } = req.query;
      const data = await this.dashboardUseCases.getAttendanceTrend(
        {
          franchiseId: franchiseId as string | undefined,
          academyId: academyId as string | undefined,
        },
        days ? parseInt(days as string) : undefined,
      );
      ResponseHandler.success(res, data, "Attendance trend retrieved");
    } catch (err) {
      next(err);
    }
  };

  getSkillRadar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { franchiseId, academyId } = req.query;
      const data = await this.dashboardUseCases.getSkillRadar({
        franchiseId: franchiseId as string | undefined,
        academyId: academyId as string | undefined,
      });
      ResponseHandler.success(res, data, "Skill radar retrieved");
    } catch (err) {
      next(err);
    }
  };

  getTeamHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { franchiseId, academyId } = req.query;
      const data = await this.dashboardUseCases.getTeamHealth({
        franchiseId: franchiseId as string | undefined,
        academyId: academyId as string | undefined,
      });
      ResponseHandler.success(res, data, "Team health retrieved");
    } catch (err) {
      next(err);
    }
  };

  getTopPerformers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { franchiseId, academyId, limit } = req.query;
      const data = await this.dashboardUseCases.getTopPerformers(
        {
          franchiseId: franchiseId as string | undefined,
          academyId: academyId as string | undefined,
        },
        limit ? parseInt(limit as string) : undefined,
      );
      ResponseHandler.success(res, data, "Top performers retrieved");
    } catch (err) {
      next(err);
    }
  };

  getRecentActivity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { franchiseId, academyId, limit } = req.query;
      const data = await this.dashboardUseCases.getRecentActivity(
        {
          franchiseId: franchiseId as string | undefined,
          academyId: academyId as string | undefined,
        },
        limit ? parseInt(limit as string) : undefined,
      );
      ResponseHandler.success(res, data, "Recent activity retrieved");
    } catch (err) {
      next(err);
    }
  };
}
