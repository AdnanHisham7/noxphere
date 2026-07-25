// src/interfaces/http/routes/student.routes.ts
import { Router } from "express";
import { authenticate, requirePermission } from "../middleware/auth.middleware";
import { studentController } from "@bootstrap/container";

const router = Router();

router.post(
  "/",
  authenticate,
  requirePermission("canManageCamps"),
  studentController.create,
);
router.get("/", authenticate, studentController.list);
router.get("/:id", authenticate, studentController.getById);
router.put(
  "/:id",
  authenticate,
  requirePermission("canManageCamps"),
  studentController.update,
);
router.delete(
  "/:id",
  authenticate,
  requirePermission("canManageCamps"),
  studentController.delete,
);

// Performance
router.post(
  "/:id/performance",
  authenticate,
  requirePermission("canManagePerformance"),
  studentController.addPerformance,
);

// Attendance
router.post(
  "/:id/attendance",
  authenticate,
  requirePermission("canManageAttendance"),
  studentController.markAttendance,
);

// Coach Remarks
router.post(
  "/:id/remarks",
  authenticate,
  requirePermission("canManagePerformance"),
  studentController.addCoachRemark,
);

// Transfer Wall
router.post(
  "/:id/transfer",
  authenticate,
  requirePermission("canManageCamps"),
  studentController.listOnTransfer,
);

// Player Card (public? use authentication)
router.get("/:id/playercard", authenticate, studentController.getPlayerCard);

export default router;