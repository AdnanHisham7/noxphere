// src/interfaces/http/controllers/FranchiseController.ts
import { Request, Response, NextFunction } from "express";
import { FranchiseUseCases } from "../../../application/use-cases/franchise/FranchiseUseCases";
import { ResponseHandler } from "../../../shared/utils/ResponseHandler";
import { BadRequestError, ForbiddenError } from "../../../shared/errors/AppError";
import { CreateFranchiseSchema, UpdateFranchiseSchema } from "../../../application/dtos/franchise.dto";

export class FranchiseController {
  constructor(private readonly franchiseUseCases: FranchiseUseCases) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { academyId, isActive } = req.query;
      const franchises = await this.franchiseUseCases.list({
        academyId: academyId as string | undefined,
        isActive: isActive === "true" ? true : isActive === "false" ? false : undefined,
      });
      ResponseHandler.success(res, franchises, "Franchises retrieved");
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const franchise = await this.franchiseUseCases.getById(req.params.id);
      ResponseHandler.success(res, franchise, "Franchise retrieved");
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user!.role === "manager") {
        if (req.user!.franchiseId) {
          throw new ForbiddenError("Only Head Office can create new franchises");
        }
        if (req.user!.academyId && req.user!.academyId !== req.body.academyId) {
          throw new ForbiddenError("You can only create franchises for your own academy");
        }
      }
      const dto = CreateFranchiseSchema.parse(req.body);
      const franchise = await this.franchiseUseCases.create(dto);
      ResponseHandler.created(res, franchise, "Franchise created");
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user!.role === "manager") {
        if (req.user!.franchiseId && req.user!.franchiseId !== req.params.id) {
          throw new ForbiddenError("You cannot edit another franchise");
        }
        if (!req.user!.franchiseId && req.user!.academyId) {
          const franchise = await this.franchiseUseCases.getById(req.params.id);
          if (franchise.academyId !== req.user!.academyId) {
            throw new ForbiddenError("You cannot edit a franchise belonging to another academy");
          }
        }
      }
      const dto = UpdateFranchiseSchema.parse(req.body);
      const franchise = await this.franchiseUseCases.update(req.params.id, dto);
      ResponseHandler.success(res, franchise, "Franchise updated");
    } catch (err) {
      next(err);
    }
  };

  toggleActive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user!.role === "manager") {
        if (req.user!.franchiseId) {
          throw new ForbiddenError("Only Head Office can toggle franchise status");
        }
        if (req.user!.academyId) {
          const franchise = await this.franchiseUseCases.getById(req.params.id);
          if (franchise.academyId !== req.user!.academyId) {
            throw new ForbiddenError("You cannot manage a franchise belonging to another academy");
          }
        }
      }
      const franchise = await this.franchiseUseCases.toggleActive(req.params.id);
      ResponseHandler.success(res, franchise, `Franchise ${franchise.isActive ? "activated" : "deactivated"}`);
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user!.role === "manager") {
        if (req.user!.franchiseId) {
          throw new ForbiddenError("Only Head Office can delete franchises");
        }
        if (req.user!.academyId && req.user!.academyId !== req.body.academyId) {
          throw new ForbiddenError("You cannot delete a franchise belonging to another academy");
        }
      }
      const { academyId } = req.body;
      if (!academyId) throw new BadRequestError("academyId is required");
      await this.franchiseUseCases.delete(req.params.id, academyId);
      ResponseHandler.noContent(res, "Franchise removed");
    } catch (err) {
      next(err);
    }
  };
}
