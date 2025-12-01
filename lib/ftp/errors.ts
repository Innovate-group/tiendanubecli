// errors.ts - Custom error classes for FTP operations with strong typing

/**
 * Error codes for FTP operations
 */
export type FtpErrorCode =
  | "CONNECTION_ERROR"
  | "AUTH_ERROR"
  | "FILE_NOT_FOUND"
  | "PERMISSION_ERROR"
  | "TIMEOUT_ERROR"
  | "UNKNOWN_ERROR";

/**
 * Context information for error classification
 */
export interface ErrorContext {
  filePath?: string;
  [key: string]: unknown;
}

/**
 * Base FTP error class with strong typing
 */
export class FtpError extends Error {
  public readonly code: FtpErrorCode;
  public readonly originalError: Error | null;
  public readonly timestamp: string;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    code: FtpErrorCode,
    originalError: Error | null = null,
  ) {
    super(message);
    this.name = "FtpError";
    this.code = code;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
    this.isRetryable = false;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Connection-related errors (retryable)
 */
export class FtpConnectionError extends FtpError {
  public override readonly isRetryable = true;

  constructor(message: string, originalError: Error | null) {
    super(message, "CONNECTION_ERROR", originalError);
    this.name = "FtpConnectionError";
  }
}

/**
 * Authentication errors (not retryable)
 */
export class FtpAuthenticationError extends FtpError {
  public override readonly isRetryable = false;

  constructor(message: string, originalError: Error | null) {
    super(message, "AUTH_ERROR", originalError);
    this.name = "FtpAuthenticationError";
  }
}

/**
 * File not found errors (not retryable)
 */
export class FtpFileNotFoundError extends FtpError {
  public override readonly isRetryable = false;
  public readonly filePath: string | undefined;

  constructor(
    message: string,
    filePath: string | undefined,
    originalError: Error | null,
  ) {
    super(message, "FILE_NOT_FOUND", originalError);
    this.name = "FtpFileNotFoundError";
    this.filePath = filePath;
  }
}

/**
 * Permission denied errors (not retryable)
 */
export class FtpPermissionError extends FtpError {
  public override readonly isRetryable = false;
  public readonly filePath: string | undefined;

  constructor(
    message: string,
    filePath: string | undefined,
    originalError: Error | null,
  ) {
    super(message, "PERMISSION_ERROR", originalError);
    this.name = "FtpPermissionError";
    this.filePath = filePath;
  }
}

/**
 * Timeout errors (retryable)
 */
export class FtpTimeoutError extends FtpError {
  public override readonly isRetryable = true;

  constructor(message: string, originalError: Error | null) {
    super(message, "TIMEOUT_ERROR", originalError);
    this.name = "FtpTimeoutError";
  }
}

/**
 * Type guard to check if an error is an FtpError
 */
export function isFtpError(error: unknown): error is FtpError {
  return error instanceof FtpError;
}

/**
 * Type guard to check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (isFtpError(error)) {
    return error.isRetryable;
  }
  return false;
}

/**
 * Classify generic errors into specific FTP error types
 * @param error - The original error
 * @param context - Additional context (e.g., filePath)
 * @returns Classified FTP error
 */
export function classifyFtpError(
  error: Error | unknown,
  context: ErrorContext = {},
): FtpError {
  // Handle non-Error objects
  if (!(error instanceof Error)) {
    return new FtpError(
      `Unknown error: ${String(error)}`,
      "UNKNOWN_ERROR",
      null,
    );
  }

  const message = error.message?.toLowerCase() || "";

  // Connection errors
  if (
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("etimedout") ||
    message.includes("econnreset")
  ) {
    return new FtpConnectionError(
      `Could not connect to FTP server: ${error.message}`,
      error,
    );
  }

  // Authentication errors
  if (
    message.includes("login") ||
    message.includes("authentication") ||
    message.includes("530")
  ) {
    return new FtpAuthenticationError(
      `FTP authentication error: ${error.message}`,
      error,
    );
  }

  // File not found
  if (
    message.includes("no such file") ||
    message.includes("550") ||
    message.includes("not found")
  ) {
    return new FtpFileNotFoundError(
      `File not found: ${context.filePath || "unknown"}`,
      context.filePath,
      error,
    );
  }

  // Permission errors
  if (
    message.includes("permission") ||
    message.includes("553") ||
    message.includes("access denied")
  ) {
    return new FtpPermissionError(
      `Permission denied: ${context.filePath || "unknown"}`,
      context.filePath,
      error,
    );
  }

  // Timeout errors
  if (message.includes("timeout") || message.includes("timed out")) {
    return new FtpTimeoutError(`Timeout: ${error.message}`, error);
  }

  // Generic FTP error
  return new FtpError(`FTP error: ${error.message}`, "UNKNOWN_ERROR", error);
}
