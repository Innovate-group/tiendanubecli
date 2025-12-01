// logger.ts - Centralized logging utility with strong typing

/**
 * Available log levels
 */
export type LogLevel = "error" | "warn" | "info" | "success" | "debug";

/**
 * Emoji mapping for log levels
 */
interface EmojiMap {
  error: string;
  warn: string;
  info: string;
  success: string;
  debug: string;
}

/**
 * Logger class for consistent, structured logging throughout the application.
 * Provides different log levels with emoji prefixes for CLI clarity.
 */
export class Logger {
  /**
   * Log level constants
   */
  static readonly levels = {
    ERROR: "error" as const,
    WARN: "warn" as const,
    INFO: "info" as const,
    SUCCESS: "success" as const,
    DEBUG: "debug" as const,
  };

  private readonly context: string;

  /**
   * Create a new Logger instance
   * @param context - Context identifier for log messages (e.g., "FTP", "ConfigChecker")
   */
  constructor(context: string = "") {
    this.context = context;
  }

  /**
   * Core logging method
   * @param level - Log level
   * @param message - Log message
   * @param data - Optional data to log
   */
  private log(level: LogLevel, message: string, data?: unknown): void {
    const emoji = this.getEmoji(level);
    const prefix = this.context ? `[${this.context}]` : "";
    const logMessage = `${emoji} ${prefix} ${message}`;

    switch (level) {
      case Logger.levels.ERROR:
        console.error(logMessage, data ?? "");
        break;
      case Logger.levels.WARN:
        console.warn(logMessage, data ?? "");
        break;
      default:
        console.log(logMessage, data ?? "");
    }
  }

  /**
   * Get emoji for log level
   * @param level - Log level
   * @returns Emoji string
   */
  private getEmoji(level: LogLevel): string {
    const emojis: EmojiMap = {
      error: "❌",
      warn: "⚠️",
      info: "ℹ️",
      success: "✅",
      debug: "🔍",
    };
    return emojis[level] || "ℹ️";
  }

  /**
   * Log error message
   * @param message - Error message
   * @param data - Optional error data or object
   */
  public error(message: string, data?: unknown): void {
    this.log(Logger.levels.ERROR, message, data);
  }

  /**
   * Log warning message
   * @param message - Warning message
   * @param data - Optional warning data
   */
  public warn(message: string, data?: unknown): void {
    this.log(Logger.levels.WARN, message, data);
  }

  /**
   * Log info message
   * @param message - Info message
   * @param data - Optional info data
   */
  public info(message: string, data?: unknown): void {
    this.log(Logger.levels.INFO, message, data);
  }

  /**
   * Log success message
   * @param message - Success message
   * @param data - Optional success data
   */
  public success(message: string, data?: unknown): void {
    this.log(Logger.levels.SUCCESS, message, data);
  }

  /**
   * Log debug message (only when DEBUG=true in environment)
   * @param message - Debug message
   * @param data - Optional debug data
   */
  public debug(message: string, data?: unknown): void {
    if (process.env.DEBUG === "true") {
      this.log(Logger.levels.DEBUG, message, data);
    }
  }
}

/**
 * Export singleton instance for general use
 */
export const logger = new Logger("FTP");
