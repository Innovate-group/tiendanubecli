// ftp-errors.js - Custom error classes for FTP operations

/**
 * Base FTP error class
 */
export class FtpError extends Error {
  constructor(message, code, originalError = null) {
    super(message);
    this.name = "FtpError";
    this.code = code;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Connection-related errors (retryable)
 */
export class FtpConnectionError extends FtpError {
  constructor(message, originalError) {
    super(message, "CONNECTION_ERROR", originalError);
    this.name = "FtpConnectionError";
    this.isRetryable = true;
  }
}

/**
 * Authentication errors (not retryable)
 */
export class FtpAuthenticationError extends FtpError {
  constructor(message, originalError) {
    super(message, "AUTH_ERROR", originalError);
    this.name = "FtpAuthenticationError";
    this.isRetryable = false;
  }
}

/**
 * File not found errors (not retryable)
 */
export class FtpFileNotFoundError extends FtpError {
  constructor(message, filePath, originalError) {
    super(message, "FILE_NOT_FOUND", originalError);
    this.name = "FtpFileNotFoundError";
    this.filePath = filePath;
    this.isRetryable = false;
  }
}

/**
 * Permission denied errors (not retryable)
 */
export class FtpPermissionError extends FtpError {
  constructor(message, filePath, originalError) {
    super(message, "PERMISSION_ERROR", originalError);
    this.name = "FtpPermissionError";
    this.filePath = filePath;
    this.isRetryable = false;
  }
}

/**
 * Timeout errors (retryable)
 */
export class FtpTimeoutError extends FtpError {
  constructor(message, originalError) {
    super(message, "TIMEOUT_ERROR", originalError);
    this.name = "FtpTimeoutError";
    this.isRetryable = true;
  }
}

/**
 * Classify generic errors into specific FTP error types
 * @param {Error} error - The original error
 * @param {Object} context - Additional context (e.g., filePath)
 * @returns {FtpError} Classified error
 */
export function classifyFtpError(error, context = {}) {
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
    return new FtpTimeoutError(
      `Timeout: ${error.message}`,
      error,
    );
  }

  // Generic FTP error
  return new FtpError(`FTP error: ${error.message}`, "UNKNOWN_ERROR", error);
}
