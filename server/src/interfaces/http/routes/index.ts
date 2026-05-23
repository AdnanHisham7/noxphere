import { Router } from "express";

import healthRouter from "./health.routes";
import authRouter from "./auth.routes";
import academyRouter from "./academy.routes";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/academies", academyRouter);

apiRouter.use("/health", healthRouter);
