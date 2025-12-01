// service.ts - High-level FTP operations with retry logic and strong typing

import { promises as fs } from "fs";
import fsSync from "fs";
import path from "path";
import { Client, FileInfo } from "basic-ftp";
import { ftpConnectionManager } from "./connection-manager.js";
import { Logger } from "../utils/logger.js";
import { classifyFtpError, FtpError, ErrorContext } from "./errors.js";
import { config } from "../core/config.js";

/**
 * Type for FTP operation functions
 */
type FtpOperation<T> = (client: Client) => Promise<T>;

/**
 * High-level FTP service that provides business logic for FTP operations.
 * Uses connection pooling and implements retry logic for transient failures.
 * Now with async file system operations for better performance.
 */
export class FtpService {
  private readonly logger: Logger;
  private readonly connectionManager: typeof ftpConnectionManager;

  constructor() {
    this.logger = new Logger("FtpService");
    this.connectionManager = ftpConnectionManager;
  }

  /**
   * Upload a file to the FTP server
   * @param localPath - Local file path
   * @param remotePath - Remote FTP path
   * @returns Success status
   * @throws {FtpError} If upload fails
   */
  public async uploadFile(
    localPath: string,
    remotePath: string,
  ): Promise<boolean> {
    // Check if file exists using sync method (fast check)
    if (!fsSync.existsSync(localPath)) {
      throw new FtpError(
        `Local file does not exist: ${localPath}`,
        "FILE_NOT_FOUND",
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
   * @param remotePath - Remote FTP path
   * @returns Success status
   * @throws {FtpError} If deletion fails
   */
  public async deleteFile(remotePath: string): Promise<boolean> {
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
   * @param remotePath - Remote directory path
   * @returns Success status
   * @throws {FtpError} If creation fails
   */
  public async createDirectory(remotePath: string): Promise<boolean> {
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
   * @param remotePath - Remote directory path
   * @returns Success status
   * @throws {FtpError} If removal fails
   */
  public async removeDirectory(remotePath: string): Promise<boolean> {
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
   * @param remoteFilePath - Remote file path
   * @param localFilePath - Local destination path
   * @returns Success status
   * @throws {FtpError} If download fails
   */
  public async downloadFile(
    remoteFilePath: string,
    localFilePath: string,
  ): Promise<boolean> {
    await this.executeOperation(
      async (client) => {
        // Create local directory if needed
        const localDir = path.dirname(localFilePath);
        if (!fsSync.existsSync(localDir)) {
          await fs.mkdir(localDir, { recursive: true });
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
   * @param remotePath - Remote directory path
   * @returns Array of file/directory objects
   * @throws {FtpError} If listing fails
   */
  public async listDirectory(remotePath: string): Promise<FileInfo[]> {
    const result = await this.executeOperation<FileInfo[]>(
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
   * @param remotePath - Remote directory path
   * @param localPath - Local destination path
   * @param themeFolderPath - Theme folder base path for logging
   * @throws {FtpError} If download fails
   */
  public async downloadDirectory(
    remotePath: string,
    localPath: string,
    themeFolderPath: string,
  ): Promise<void> {
    this.logger.info(`Exploring directory: ${remotePath}`);

    const client = await this.connectionManager.getConnection();

    try {
      const list = await client.list(remotePath);

      if (!list || list.length === 0) {
        this.logger.warn(`No files found in: ${remotePath}`);
        return;
      }

      this.logger.success(`Found ${list.length} items in ${remotePath}`);

      for (const item of list) {
        const remoteItemPath = path.posix.join(remotePath, item.name);
        const localItemPath = path.join(localPath, item.name);

        // FileType can be number (1=file, 2=directory) or string from FTP response
        const typeStr = String(item.type);
        const isDirectory = typeStr === "d" || typeStr === "2" || item.type === 2;

        if (isDirectory) {
          this.logger.info(`📂 Processing directory: ${item.name}`);

          if (!fsSync.existsSync(localItemPath)) {
            await fs.mkdir(localItemPath, { recursive: true });
            this.logger.info(
              `Local directory created: ${path.relative(themeFolderPath, localItemPath)}`,
            );
          }

          await this.downloadDirectory(
            remoteItemPath,
            localItemPath,
            themeFolderPath,
          );
        } else if (typeStr === "-" || typeStr === "1" || item.type === 1) {
          try {
            this.logger.info(`⏳ Downloading: ${remoteItemPath}`);
            await client.downloadTo(localItemPath, remoteItemPath);
            this.logger.success(
              `File downloaded: ${path.relative(themeFolderPath, localItemPath)}`,
            );
          } catch (err) {
            const error = err as Error;
            this.logger.error(
              `Error downloading ${remoteItemPath}:`,
              error.message,
            );
          }
        } else {
          this.logger.warn(`Unknown item type: ${item.type} (${item.name})`);
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
   * @param remoteBasePath - Remote base path
   * @param localBasePath - Local base path
   * @returns Success status
   * @throws {FtpError} If download fails
   */
  public async downloadAll(
    remoteBasePath: string,
    localBasePath: string,
  ): Promise<boolean> {
    this.logger.info("\n📥 Starting complete FTP download...");
    this.logger.info(
      `🔸 Source: ${config.ftp.host}:${config.ftp.port}${remoteBasePath}`,
    );
    this.logger.info(`🔸 Destination: ${localBasePath}`);

    try {
      // Create local directory if needed
      if (!fsSync.existsSync(localBasePath)) {
        await fs.mkdir(localBasePath, { recursive: true });
        this.logger.info(`Local directory created: ${localBasePath}`);
      }

      // Verify access to remote directory
      const client = await this.connectionManager.getConnection();
      const testList = await client.list(remoteBasePath);
      this.logger.success(`Access confirmed. ${testList.length} items found.`);

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
   * @param operation - Operation to execute (receives client as parameter)
   * @param operationName - Name for logging
   * @param context - Additional context (e.g., filePath)
   * @returns Operation result
   * @throws {FtpError} If operation fails after all retries
   */
  private async executeOperation<T>(
    operation: FtpOperation<T>,
    operationName: string,
    context: ErrorContext = {},
  ): Promise<T> {
    const maxRetries = config.connection.maxRetries;
    let lastError: FtpError | undefined;

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
        this.connectionManager.invalidateConnection();

        // Exponential backoff
        const delay = Math.min(
          config.connection.retryDelay * Math.pow(2, attempt - 1),
          5000,
        );
        this.logger.info(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    if (!lastError) {
      throw new FtpError(
        `Operation ${operationName} failed without error`,
        "UNKNOWN_ERROR",
      );
    }

    throw lastError;
  }

  /**
   * Upload a directory recursively to the FTP server (ASYNC version for performance)
   * @param localPath - Local directory path
   * @param remotePath - Remote FTP path
   * @param themeFolderPath - Theme folder base path for logging
   * @throws {FtpError} If upload fails
   */
  public async uploadDirectory(
    localPath: string,
    remotePath: string,
    themeFolderPath: string,
  ): Promise<void> {
    this.logger.info(`📁 Exploring local directory: ${localPath}`);

    try {
      // ✨ PERFORMANCE FIX: Use async fs.readdir instead of sync fs.readdirSync
      const entries = await fs.readdir(localPath, { withFileTypes: true });

      if (entries.length === 0) {
        this.logger.warn(`No files found in: ${localPath}`);
        return;
      }

      this.logger.success(`Found ${entries.length} items in ${localPath}`);

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
            const error = err as Error;
            this.logger.error(
              `Error uploading ${path.relative(themeFolderPath, localItemPath)}:`,
              error.message,
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
   * Upload all local contents to FTP server (push all) with async file operations
   * @param localBasePath - Local base path
   * @param remoteBasePath - Remote base path
   * @returns Success status
   * @throws {FtpError} If upload fails
   */
  public async uploadAll(
    localBasePath: string,
    remoteBasePath: string,
  ): Promise<boolean> {
    this.logger.info("\n📤 Starting complete FTP upload...");
    this.logger.info(`🔸 Source: ${localBasePath}`);
    this.logger.info(
      `🔸 Destination: ${config.ftp.host}:${config.ftp.port}${remoteBasePath}`,
    );

    try {
      // Verify local directory exists
      if (!fsSync.existsSync(localBasePath)) {
        throw new FtpError(
          `Local directory does not exist: ${localBasePath}`,
          "FILE_NOT_FOUND",
        );
      }

      // ✨ PERFORMANCE FIX: Use async fs.readdir instead of sync fs.readdirSync
      const entries = await fs.readdir(localBasePath);
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
   * Test FTP connection (useful for validation before operations)
   * @returns Success status
   * @throws {FtpError} If connection fails
   */
  public async testConnection(): Promise<boolean> {
    await this.connectionManager.getConnection();
    return true;
  }

  /**
   * Shutdown the service and close connections
   */
  public async shutdown(): Promise<void> {
    await this.connectionManager.shutdown();
  }
}
