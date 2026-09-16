// src/interfaces/http/controllers/PublicPlayerController.ts
import { Request, Response, NextFunction } from "express";
import { PublicPlayerUseCases } from "../../../application/use-cases/public-player/PublicPlayerUseCases";
import { ResponseHandler } from "../../../shared/utils/ResponseHandler";

export class PublicPlayerController {
  constructor(private publicPlayerUseCases: PublicPlayerUseCases) {}

  getByToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await this.publicPlayerUseCases.getByToken(req.params.token);
      ResponseHandler.success(res, profile, "Player profile retrieved");
    } catch (err) {
      next(err);
    }
  };
}