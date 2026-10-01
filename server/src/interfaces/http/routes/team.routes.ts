import { Router } from "express";
import { authenticate, requirePermission } from "../middleware/auth.middleware";

export const teamRouter = Router();

teamRouter.post("/", authenticate, requirePermission("canManageFranchises"), (req, res, next) => {
  req.app.locals.controllers.team.create(req, res, next);
});
teamRouter.get("/", authenticate, (req, res, next) => {
  req.app.locals.controllers.team.list(req, res, next);
});
teamRouter.get("/:id", authenticate, (req, res, next) => {
  req.app.locals.controllers.team.getById(req, res, next);
});
teamRouter.put("/:id", authenticate, requirePermission("canManageFranchises"), (req, res, next) => {
  req.app.locals.controllers.team.update(req, res, next);
});
teamRouter.delete("/:id", authenticate, requirePermission("canManageFranchises"), (req, res, next) => {
  req.app.locals.controllers.team.delete(req, res, next);
});

// Formation presets (accessible by coaches and managers)
teamRouter.post("/:id/formation-presets", authenticate, (req, res, next) => {
  req.app.locals.controllers.team.saveFormationPreset(req, res, next);
});
teamRouter.delete("/:id/formation-presets/:presetId", authenticate, (req, res, next) => {
  req.app.locals.controllers.team.deleteFormationPreset(req, res, next);
});