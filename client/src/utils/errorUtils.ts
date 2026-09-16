// src/utils/errorUtils.ts

/**
 * Parses and formats any error (RTK Query error, Fetch error, Zod stringified error,
 * backend ValidationError, Error object, or raw string) into a clean, human-readable single message.
 */
export const extractErrorMessage = (err: unknown, fallback: string = "An unexpected error occurred"): string => {
  if (!err) return fallback;

  // Case 1: Error is already a string
  if (typeof err === "string") {
    return cleanRawMessage(err) || fallback;
  }

  // Case 2: Object error (RTK Query / Axios / Standard Error)
  if (typeof err === "object" && err !== null) {
    const errorObj = err as Record<string, any>;

    // 2a: Check err.data (standard RTK Query API response body)
    if (errorObj.data) {
      const data = errorObj.data;

      // data is string (e.g., HTML response or raw text)
      if (typeof data === "string") {
        const cleaned = cleanRawMessage(data);
        if (cleaned) return cleaned;
      }

      // data is object with message
      if (typeof data === "object" && data !== null) {
        // First check if there's a specific message
        if (data.message) {
          const cleaned = cleanRawMessage(data.message);
          // If the message is generic "Validation failed" and there are specific field errors, format them
          if (
            (cleaned === "Validation failed" || cleaned === "Validation error") &&
            Array.isArray(data.errors) &&
            data.errors.length > 0
          ) {
            const fieldMsgs = formatErrorsArray(data.errors);
            if (fieldMsgs) return fieldMsgs;
          }
          if (cleaned) return cleaned;
        }

        // Check if data has an errors array
        if (Array.isArray(data.errors) && data.errors.length > 0) {
          const fieldMsgs = formatErrorsArray(data.errors);
          if (fieldMsgs) return fieldMsgs;
        }

        if (data.error && typeof data.error === "string") {
          const cleaned = cleanRawMessage(data.error);
          if (cleaned) return cleaned;
        }
      }
    }

    // 2b: Check top-level err.message (standard JS Error)
    if (typeof errorObj.message === "string") {
      const cleaned = cleanRawMessage(errorObj.message);
      if (cleaned) return cleaned;
    }

    // 2c: Check top-level err.error (RTK Query status error)
    if (typeof errorObj.error === "string") {
      const cleaned = cleanRawMessage(errorObj.error);
      if (cleaned) return cleaned;
    }

    // 2d: Check if err has errors array directly
    if (Array.isArray(errorObj.errors) && errorObj.errors.length > 0) {
      const fieldMsgs = formatErrorsArray(errorObj.errors);
      if (fieldMsgs) return fieldMsgs;
    }
  }

  return fallback;
};

/**
 * Inspects a string to see if it contains stringified JSON (such as raw Zod issues).
 * If it is JSON, parses and joins the messages cleanly.
 */
export const cleanRawMessage = (msg: unknown): string => {
  if (typeof msg !== "string") return "";
  const trimmed = msg.trim();
  if (!trimmed) return "";

  // Check if string looks like JSON array or object
  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"))
  ) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const msgs = parsed
          .map((item: any) => {
            if (!item) return "";
            if (typeof item === "string") return item;
            return item.message || item.msg || item.error || "";
          })
          .filter(Boolean);

        const unique = Array.from(new Set(msgs));
        if (unique.length > 0) {
          return unique.join(", ");
        }
      } else if (parsed && typeof parsed === "object") {
        if (parsed.message) return cleanRawMessage(parsed.message);
        if (parsed.msg) return cleanRawMessage(parsed.msg);
        if (parsed.error) return cleanRawMessage(parsed.error);
        if (Array.isArray(parsed.errors)) {
          const msgs = formatErrorsArray(parsed.errors);
          if (msgs) return msgs;
        }
      }
    } catch {
      // Not valid JSON, continue to return trimmed
    }
  }

  return trimmed;
};

/**
 * Formats an array of error objects into a readable comma-separated string.
 */
const formatErrorsArray = (errors: any[]): string => {
  const msgs = errors
    .map((e) => {
      if (!e) return "";
      if (typeof e === "string") return e;
      if (e.message) return e.message;
      if (e.field && e.msg) return `${e.field}: ${e.msg}`;
      if (e.field && e.message) return `${e.field}: ${e.message}`;
      return "";
    })
    .filter(Boolean);

  const unique = Array.from(new Set(msgs));
  return unique.join(", ");
};
