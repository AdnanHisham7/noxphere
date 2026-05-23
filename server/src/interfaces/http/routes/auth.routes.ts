// src/interfaces/http/routes/auth.routes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { authController } from "src/bootstrap/container";

const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);

router.post("/refresh", authController.refreshToken);
router.post("/logout", authenticate, authController.logout);
router.post("/change-password", authenticate, authController.changePassword);
router.get("/me", authenticate, authController.me);

export default router;