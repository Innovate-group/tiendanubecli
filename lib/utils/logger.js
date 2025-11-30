// logger.js - Centralized logging utility

/**
 * Logger class for consistent, structured logging throughout the application.
 * Provides different log levels with emoji prefixes for CLI clarity.
 */
export class Logger {
  static levels = {
    ERROR: "error",
    WARN: "warn",
    INFO: "info",
    SUCCESS: "success",
    DEBUG: "debug",
  };

  constructor(context = "") {
    this.context = context;
  }

  log(level, message, data = null) {
    const emoji = this.getEmoji(level);
    const prefix = this.context ? `[${this.context}]` : "";

    const logMessage = `${emoji} ${prefix} ${message}`;

    switch (level) {
      case Logger.levels.ERROR:
        console.error(logMessage, data || "");
        break;
      case Logger.levels.WARN:
        console.warn(logMessage, data || "");
        break;
      default:
        console.log(logMessage, data || "");
    }
  }

  getEmoji(level) {
    const emojis = {
      error: "❌",
      warn: "⚠️",
      info: "ℹ️",
      success: "✅",
      debug: "🔍",
    };
    return emojis[level] || "ℹ️";
  }

  error(message, data) {
    this.log(Logger.levels.ERROR, message, data);
  }

  warn(message, data) {
    this.log(Logger.levels.WARN, message, data);
  }

  info(message, data) {
    this.log(Logger.levels.INFO, message, data);
  }

  success(message, data) {
    this.log(Logger.levels.SUCCESS, message, data);
  }

  debug(message, data) {
    if (process.env.DEBUG === "true") {
      this.log(Logger.levels.DEBUG, message, data);
    }
  }
}

// Export singleton instance for general use
export const logger = new Logger("FTP");
