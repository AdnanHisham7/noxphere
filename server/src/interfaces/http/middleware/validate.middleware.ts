// src/interfaces/http/middleware/validate.middleware.ts
import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { ValidationError } from "../../../shared/errors/AppError";

export const validate = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      const messages = Array.from(
        new Set(
          result.error.errors.map((e) => {
            const path = e.path.join(".");
            const isGenericZod =
              e.message.startsWith("String must contain") ||
              e.message.startsWith("Number must be") ||
              e.message.startsWith("Expected") ||
              e.message === "Required";
            return isGenericZod && path ? `${path}: ${e.message}` : e.message;
          })
        )
      ).filter(Boolean);
      const message = messages.length > 0 ? messages.join(", ") : "Validation failed";
      next(new ValidationError(message, errors));
      return;
    }
    (req as any).body = result.data;
    next();
  };
};
