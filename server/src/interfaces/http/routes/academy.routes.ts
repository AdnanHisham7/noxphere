import { Router } from "express";
import { authenticate, authorize } from "@interfaces/http/middleware/auth.middleware";
import { validate } from "@interfaces/http/middleware/validate.middleware";
import {
  CreateAcademySchema,
  UpdateAcademySchema,
  AcademyConfigSchema,
} from "@application/dtos/academy.dto";
import { academyController } from "src/bootstrap/container";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Public read (any authenticated user)
router.get("/", academyController.getAll);
router.get("/:id", academyController.getById);

// Write operations require super_admin role
router.post(
  "/",
  authorize("super_admin"),
  validate(CreateAcademySchema),
  academyController.create,
);

router.put(
  "/:id",
  authorize("super_admin"),
  validate(UpdateAcademySchema),
  academyController.update,
);

router.patch(
  "/:id/config",
  authorize("super_admin"),
  validate(AcademyConfigSchema),
  academyController.updateConfig,
);

router.patch(
  "/:id/toggle-status",
  authorize("super_admin"),
  academyController.toggleStatus,
);

router.delete("/:id", authorize("super_admin"), academyController.delete);

export default router;