// src/interfaces/http/middleware/errorHandler.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '../../../shared/errors/AppError';
import { logger } from '../../../shared/utils/logger';

const formatZodErrorMessage = (err: ZodError): string => {
  const messages = err.issues.map((issue) => {
    const path = issue.path.filter((p) => typeof p === 'string' || typeof p === 'number').join('.');
    const isGenericZod =
      issue.message.startsWith('String must contain') ||
      issue.message.startsWith('Number must be') ||
      issue.message.startsWith('Expected') ||
      issue.message === 'Required';
    if (isGenericZod && path) {
      return `${path}: ${issue.message}`;
    }
    return issue.message;
  });

  const unique = Array.from(new Set(messages)).filter(Boolean);
  return unique.length > 0 ? unique.join(', ') : 'Validation failed';
};

const sanitizeErrorMessage = (msg: unknown): string => {
  if (typeof msg !== 'string') return 'An error occurred';
  const trimmed = msg.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const msgs = parsed.map((item) => item?.message || item?.msg || item?.error || String(item)).filter(Boolean);
        if (msgs.length > 0) return msgs.join(', ');
      } else if (parsed && typeof parsed === 'object') {
        return parsed.message || parsed.msg || parsed.error || 'Validation error';
      }
    } catch {
      // Not valid JSON, keep original trimmed
    }
  }
  return trimmed;
};

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Zod schema validation error
  if (err instanceof ZodError || err.name === 'ZodError') {
    const zodErr = err as ZodError;
    const message = formatZodErrorMessage(zodErr);
    const errors = zodErr.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    res.status(400).json({
      success: false,
      message,
      errors,
      code: 'VALIDATION_ERROR',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (err instanceof ValidationError) {
    res.status(400).json({
      success: false,
      message: sanitizeErrorMessage(err.message),
      errors: err.errors,
      code: 'VALIDATION_ERROR',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error('Non-operational error:', err);
    }
    res.status(err.statusCode).json({
      success: false,
      message: sanitizeErrorMessage(err.message),
      code: err.code,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Mongoose duplicate key error
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue || {})[0];
    console.error('Duplicate key error:', err);
    res.status(409).json({
      success: false,
      message: `${field} already exists`,
      code: 'CONFLICT',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const details = (err as any).errors
      ? Object.values((err as any).errors)
          .map((e: any) => e.message)
          .join(', ')
      : err.message;
    logger.error('Mongoose validation error:', details, err);
    res.status(400).json({
      success: false,
      message: sanitizeErrorMessage(details) || 'Database validation failed',
      code: 'VALIDATION_ERROR',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  logger.error('Unhandled error:', err);

  const fallbackMessage =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : sanitizeErrorMessage(err.message) || 'Internal server error';

  res.status(500).json({
    success: false,
    message: fallbackMessage,
    code: 'INTERNAL_SERVER_ERROR',
    timestamp: new Date().toISOString(),
  });
};