// src/interfaces/http/routes/publicPlayer.routes.ts
import { Router } from "express";

export const publicPlayerRouter = Router();

// No `authenticate` middleware — this is the whole point: it's meant to
// be opened by scanning an NFC-embedded or QR-printed ID card, by anyone,
// with no login. See PublicPlayerUseCases.getByToken for exactly what
// (little) it returns.
publicPlayerRouter.get("/:token", (req, res, next) => {
  req.app.locals.controllers.publicPlayer.getByToken(req, res, next);
});