// ftp-service.js - High-level FTP operations with retry logic

import fs from "fs";
import path from "path";
import { ftpConnectionManager } from "./connection-manager.js";
import { Logger } from "../utils/logger.js";
import { classifyFtpError, FtpError } from "./errors.js";
import { config } from "../core/config.js";

/**
 * High-level FTP service that provides business logic for FTP operations
 * Uses connection pooling and implements retry logic for transient failures
 */
export class FtpService {
  constructor() {
    this.logger = new Logger("FtpService");
    this.connectionManager = ftpConnectionManager;
  }

  /**
   * Upload a file to the FTP server
   * @param {string} localPath - Local file path
   * @param {string} remotePath - Remote FTP path
   * @returns {Promise<boolean>} Success status
   */
  async uploadFile(localPath, remotePath) {
    if (!fs.existsSync(localPath)) {
      throw new FtpError(
        `Local file does not exist: ${localPath}`,
        "LOCAL_FILE_NOT_FOUND",
      );
    }

    await this.executeOperation(
      async (client) => {
        const remoteDir = path.dirname(remotePath);
        await client.ensureDir(remoteDir);
        await client.uploadFrom(localPath, remotePath);
        this.logger.success(`File uploaded: ${remotePath}`);
        return true;
      },
      `upload file ${remotePath}`,
      { filePath: remotePath },
    );

    return true;
  }

  /**
   * Delete a file from the FTP server
   * @param {string} remotePath - Remote FTP path
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(remotePath) {
    await this.executeOperation(
      async (client) => {
        await client.remove(remotePath);
        this.logger.success(`File deleted: ${remotePath}`);
        return true;
      },
      `delete file ${remotePath}`,
      { filePath: remotePath },
    );

    return true;
  }

  /**
   * Create a directory on the FTP server
   * @param {string} remotePath - Remote directory path
   * @returns {Promise<boolean>} Success status
   */
  async createDirectory(remotePath) {
    await this.executeOperation(
      async (client) => {
        await client.ensureDir(remotePath);
        this.logger.success(`Directory created: ${remotePath}`);
        return true;
      },
      `create directory ${remotePath}`,
      { filePath: remotePath },
    );

    return true;
  }

  /**
   * Remove a directory from the FTP server
   * @param {string} remotePath - Remote directory path
   * @returns {Promise<boolean>} Success status
   */
  async removeDirectory(remotePath) {
    await this.executeOperation(
      async (client) => {
        await client.removeDir(remotePath);
        this.logger.success(`Directory deleted: ${remotePath}`);
        return true;
      },
      `delete directory ${remotePath}`,
      { filePath: remotePath },
    );

    return true;
  }

  /**
   * Download a file from the FTP server
   * @param {string} remoteFilePath - Remote file path
   * @param {string} localFilePath - Local destination path
   * @returns {Promise<boolean>} Success status
   */
  async downloadFile(remoteFilePath, localFilePath) {
    await this.executeOperation(
      async (client) => {
        // Create local directory if needed
        const localDir = path.dirname(localFilePath);
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
          this.logger.info(`Local directory created: ${localDir}`);
        }

        await client.downloadTo(localFilePath, remoteFilePath);

        const relativeLocalPath = path.relative(process.cwd(), localFilePath);
        this.logger.success(`File downloaded: ${relativeLocalPath}`);
        return true;
      },
      `download file ${remoteFilePath}`,
      { filePath: remoteFilePath },
    );

    return true;
  }

  /**
   * List contents of a directory on the FTP server
   * @param {string} remotePath - Remote directory path
   * @returns {Promise<Array>} Array of file/directory objects
   */
  async listDirectory(remotePath) {
    const result = await this.executeOperation(
      async (client) => {
        const list = await client.list(remotePath);
        return list;
      },
      `list directory ${remotePath}`,
      { filePath: remotePath },
    );

    return result;
  }

  /**
   * Download all files recursively from a remote directory
   * @param {string} remotePath - Remote directory path
   * @param {string} localPath - Local destination path
   * @param {string} themeFolderPath - Theme folder base path for logging
   */
  async downloadDirectory(remotePath, localPath, themeFolderPath) {
    this.logger.info(`Exploring directory: ${remotePath}`);

    const client = await this.connectionManager.getConnection();

    try {
      const list = await client.list(remotePath);

      if (!list || list.length === 0) {
        this.logger.warn(`No files found in: ${remotePath}`);
        return;
      }

      this.logger.success(
        `Found ${list.length} items in ${remotePath}`,
      );

      for (const item of list) {
        const remoteItemPath = path.posix.join(remotePath, item.name);
        const localItemPath = path.join(localPath, item.name);

        const isDirectory =
          item.type === "d" || item.type === "2" || item.type === 2;

        if (isDirectory) {
          this.logger.info(`📂 Processing directory: ${item.name}`);

          if (!fs.existsSync(localItemPath)) {
            fs.mkdirSync(localItemPath, { recursive: true });
            this.logger.info(
              `Local directory created: ${path.relative(themeFolderPath, localItemPath)}`,
            );
          }

          await this.downloadDirectory(
            remoteItemPath,
            localItemPath,
            themeFolderPath,
          );
        } else if (item.type === "-" || item.type === "1" || item.type === 1) {
          try {
            this.logger.info(`⏳ Downloading: ${remoteItemPath}`);
            await client.downloadTo(localItemPath, remoteItemPath);
            this.logger.success(
              `File downloaded: ${path.relative(themeFolderPath, localItemPath)}`,
            );
          } catch (err) {
            this.logger.error(
              `Error downloading ${remoteItemPath}:`,
              err.message,
            );
          }
        } else {
          this.logger.warn(
            `Unknown item type: ${item.type} (${item.name})`,
          );
        }
      }
    } catch (err) {
      const ftpError = classifyFtpError(err, { filePath: remotePath });
      this.logger.error(
        `Error listing directory ${remotePath}:`,
        ftpError.message,
      );
      throw ftpError;
    }
  }

  /**
   * Download all contents from FTP server
   * @param {string} remoteBasePath - Remote base path
   * @param {string} localBasePath - Local base path
   * @returns {Promise<boolean>} Success status
   */
  async downloadAll(remoteBasePath, localBasePath) {
    this.logger.info("\n📥 Starting complete FTP download...");
    this.logger.info(
      `🔸 Source: ${config.ftp.host}:${config.ftp.port}${remoteBasePath}`,
    );
    this.logger.info(`🔸 Destination: ${localBasePath}`);

    try {
      // Create local directory if needed
      if (!fs.existsSync(localBasePath)) {
        fs.mkdirSync(localBasePath, { recursive: true });
        this.logger.info(`Local directory created: ${localBasePath}`);
      }

      // Verify access to remote directory
      const client = await this.connectionManager.getConnection();
      const testList = await client.list(remoteBasePath);
      this.logger.success(
        `Access confirmed. ${testList.length} items found.`,
      );

      // Download recursively
      await this.downloadDirectory(
        remoteBasePath,
        localBasePath,
        localBasePath,
      );

      this.logger.success("\n✅ Complete download finished");
      this.logger.info(`📂 Files downloaded to: ${localBasePath}`);
      return true;
    } catch (err) {
      const ftpError = classifyFtpError(err);
      this.logger.error("Error during download:", ftpError.message);
      throw ftpError;
    }
  }

  /**
   * Execute an FTP operation with retry logic
   * @param {Function} operation - Operation to execute (receives client as parameter)
   * @param {string} operationName - Name for logging
   * @param {Object} context - Additional context (e.g., filePath)
   * @returns {Promise<any>} Operation result
   * @throws {FtpError} If operation fails after all retries
   */
  async executeOperation(operation, operationName, context = {}) {
    const maxRetries = config.connection.maxRetries;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const client = await this.connectionManager.getConnection();
        const result = await operation(client);
        return result;
      } catch (err) {
        const ftpError = classifyFtpError(err, context);
        lastError = ftpError;

        this.logger.error(
          `Error in ${operationName} (attempt ${attempt}/${maxRetries}):`,
          ftpError.message,
        );

        // Only retry if error is retryable
        if (!ftpError.isRetryable || attempt === maxRetries) {
          break;
        }

        // Invalidate connection for retryable errors
        this.connectionManager.client = null;

        // Exponential backoff
        const delay = Math.min(
          config.connection.retryDelay * Math.pow(2, attempt - 1),
          5000,
        );
        this.logger.info(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Upload a directory recursively to the FTP server
   * @param {string} localPath - Local directory path
   * @param {string} remotePath - Remote FTP path
   * @param {string} themeFolderPath - Theme folder base path for logging
   */
  async uploadDirectory(localPath, remotePath, themeFolderPath) {
    this.logger.info(`📁 Exploring local directory: ${localPath}`);

    try {
      const entries = fs.readdirSync(localPath, { withFileTypes: true });

      if (entries.length === 0) {
        this.logger.warn(`No files found in: ${localPath}`);
        return;
      }

      this.logger.success(
        `Found ${entries.length} items in ${localPath}`,
      );

      for (const entry of entries) {
        const localItemPath = path.join(localPath, entry.name);
        const remoteItemPath = path.posix.join(remotePath, entry.name);

        if (entry.isDirectory()) {
          this.logger.info(`📂 Processing directory: ${entry.name}`);

          // Create remote directory
          await this.createDirectory(remoteItemPath);

          // Upload contents recursively
          await this.uploadDirectory(
            localItemPath,
            remoteItemPath,
            themeFolderPath,
          );
        } else if (entry.isFile()) {
          try {
            this.logger.info(`⏳ Uploading: ${remoteItemPath}`);
            await this.uploadFile(localItemPath, remoteItemPath);
          } catch (err) {
            this.logger.error(
              `Error uploading ${path.relative(themeFolderPath, localItemPath)}:`,
              err.message,
            );
          }
        } else {
          this.logger.warn(`Unknown item type: ${entry.name}`);
        }
      }
    } catch (err) {
      const ftpError = classifyFtpError(err, { filePath: localPath });
      this.logger.error(
        `Error listing directory ${localPath}:`,
        ftpError.message,
      );
      throw ftpError;
    }
  }

  /**
   * Upload all local contents to FTP server (push all)
   * @param {string} localBasePath - Local base path
   * @param {string} remoteBasePath - Remote base path
   * @returns {Promise<boolean>} Success status
   */
  async uploadAll(localBasePath, remoteBasePath) {
    this.logger.info("\n📤 Starting complete FTP upload...");
    this.logger.info(`🔸 Source: ${localBasePath}`);
    this.logger.info(
      `🔸 Destination: ${config.ftp.host}:${config.ftp.port}${remoteBasePath}`,
    );

    try {
      // Verify local directory exists
      if (!fs.existsSync(localBasePath)) {
        throw new FtpError(
          `Local directory does not exist: ${localBasePath}`,
          "LOCAL_DIR_NOT_FOUND",
        );
      }

      const entries = fs.readdirSync(localBasePath);
      this.logger.success(
        `Local directory verified. ${entries.length} items found.`,
      );

      // Ensure remote base directory exists
      const client = await this.connectionManager.getConnection();
      await client.ensureDir(remoteBasePath);
      this.logger.success(`Remote directory verified: ${remoteBasePath}`);

      // Upload recursively
      await this.uploadDirectory(localBasePath, remoteBasePath, localBasePath);

      this.logger.success("\n✅ Complete upload finished");
      this.logger.info(`📂 Files uploaded from: ${localBasePath}`);
      return true;
    } catch (err) {
      const ftpError = classifyFtpError(err);
      this.logger.error("Error during upload:", ftpError.message);
      throw ftpError;
    }
  }

  /**
   * Shutdown the service and close connections
   */
  async shutdown() {
    await this.connectionManager.shutdown();
  }
}
