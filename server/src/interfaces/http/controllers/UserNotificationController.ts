// src/interfaces/http/controllers/UserNotificationController.ts
import { Request, Response, NextFunction } from "express";
import { UserNotificationUseCases } from "../../../application/use-cases/notification/UserNotificationUseCases";
import { ResponseHandler } from "../../../shared/utils/ResponseHandler";

export class UserNotificationController {
  constructor(private userNotificationUseCases: UserNotificationUseCases) {}

  listMine = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await this.userNotificationUseCases.listMine(
        req.user!.sub,
        Number(page),
        Number(limit),
      );
      ResponseHandler.success(res, result, "Notifications retrieved");
    } catch (err) {
      next(err);
    }
  };

  markRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notification = await this.userNotificationUseCases.markRead(req.params.id, req.user!.sub);
      ResponseHandler.success(res, notification, "Marked as read");
    } catch (err) {
      next(err);
    }
  };

  markAllRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.userNotificationUseCases.markAllRead(req.user!.sub);
      ResponseHandler.success(res, result, "All notifications marked as read");
    } catch (err) {
      next(err);
    }
  };
}