import { Router } from "express";

import healthRouter from "./health.routes";
import authRouter from "./auth.routes";
import academyRouter from "./academy.routes";
import studentRouter from "./student.routes";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/academies", academyRouter);
apiRouter.use("/students", studentRouter);

apiRouter.use("/health", healthRouter);
