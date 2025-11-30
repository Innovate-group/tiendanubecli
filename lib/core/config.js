// config.js - Centralized configuration management

import dotenv from "dotenv";
import path from "path";

dotenv.config();

/**
 * Application configuration loaded from environment variables
 */
export const config = {
  ftp: {
    host: process.env.FTP_HOST || "example.com",
    user: process.env.FTP_USER || "user",
    password: process.env.FTP_PASSWORD || "password",
    port: parseInt(process.env.FTP_PORT || "21"),
    secure: process.env.FTP_SECURE === "true",
    basePath: process.env.FTP_BASE_PATH || "/",
    timeout: parseInt(process.env.FTP_TIMEOUT || "30000"),
  },

  local: {
    themeFolderPath: path.join(process.cwd(), "theme"),
  },

  watcher: {
    stabilityThreshold: 300,
    pollInterval: 100,
    ignoreInitial: true,
  },

  connection: {
    idleTimeout: 5 * 60 * 1000, // 5 minutes
    maxRetries: 2,
    retryDelay: 1000,
  },

  debug: process.env.DEBUG === "true",
};

/**
 * Validate required configuration
 * @throws {Error} If configuration is invalid
 */
export function validateConfig() {
  const errors = [];

  if (!config.ftp.host || config.ftp.host === "example.com") {
    errors.push("FTP_HOST not configured in .env");
  }

  if (!config.ftp.user || config.ftp.user === "user") {
    errors.push("FTP_USER not configured in .env");
  }

  if (!config.ftp.password || config.ftp.password === "password") {
    errors.push("FTP_PASSWORD not configured in .env");
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid configuration:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }

  return true;
}
