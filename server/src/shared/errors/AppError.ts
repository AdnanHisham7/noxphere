// src/shared/errors/AppError.ts
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400, 'BAD_REQUEST');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ValidationError extends AppError {
  public readonly errors: Record<string, string>[];
  constructor(message: string, errors: Record<string, string>[] = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class PaymentError extends AppError {
  constructor(message: string) {
    super(message, 402, 'PAYMENT_ERROR');
  }
}

export class SubscriptionRequiredError extends AppError {
  constructor(message = 'An active subscription is required for this academy') {
    super(message, 402, 'SUBSCRIPTION_REQUIRED');
  }
}

export class SubscriptionCapacityExceededError extends AppError {
  constructor(message = 'This academy has reached its subscribed player capacity') {
    super(message, 402, 'SUBSCRIPTION_CAPACITY_EXCEEDED');
  }
}

export class GeoRestrictionError extends AppError {
  public readonly detectedCountry?: string;
  public readonly requiredCountry?: string;
  public readonly currency?: string;

  constructor(
    message = 'Access restricted: operations for this academy are only permitted within its registered country',
    detectedCountry?: string,
    requiredCountry?: string,
    currency?: string
  ) {
    super(message, 403, 'GEO_RESTRICTION_ERROR');
    this.detectedCountry = detectedCountry;
    this.requiredCountry = requiredCountry;
    this.currency = currency;
  }
}

export class TrialExpiredError extends AppError {
  constructor(message = 'Academy trial period has expired. Please subscribe to continue.') {
    super(message, 402, 'TRIAL_EXPIRED');
  }
}