// file-watcher.ts - File system watcher with FTP synchronization and strong typing

import chokidar, { FSWatcher } from "chokidar";
import { Logger } from "../utils/logger.js";
import { config } from "./config.js";
import { FtpService } from "../ftp/service.js";
import { PathUtils } from "../utils/path-utils.js";

/**
 * File watcher that monitors local file changes and synchronizes with FTP server.
 * Uses chokidar for robust file system monitoring with debouncing.
 */
export class FileWatcher {
  private readonly ftpService: FtpService;
  private readonly pathUtils: PathUtils;
  private readonly logger: Logger;
  private watcher: FSWatcher | null = null;

  /**
   * Create a new FileWatcher instance
   * @param ftpService - FTP service for file operations
   * @param pathUtils - Path utilities for path conversions
   */
  constructor(ftpService: FtpService, pathUtils: PathUtils) {
    this.ftpService = ftpService;
    this.pathUtils = pathUtils;
    this.logger = new Logger("Watcher");
  }

  /**
   * Start watching for file changes
   * Initializes chokidar watcher with configured options
   */
  public async start(): Promise<void> {
    this.logger.info(
      `Monitoring changes in: ${config.local.themeFolderPath}`,
    );
    this.logger.info("Changes will be automatically synchronized with FTP");
    this.logger.info("🛑 Press Ctrl+C to stop.\n");

    this.watcher = chokidar.watch(config.local.themeFolderPath, {
      persistent: true,
      ignoreInitial: config.watcher.ignoreInitial,
      awaitWriteFinish: {
        stabilityThreshold: config.watcher.stabilityThreshold,
        pollInterval: config.watcher.pollInterval,
      },
    });

    this.setupHandlers();
  }

  /**
   * Setup event handlers for file system events
   */
  private setupHandlers(): void {
    if (!this.watcher) {
      throw new Error("Watcher not initialized");
    }

    this.watcher
      .on("add", (filepath: string) => this.handleFileAdd(filepath))
      .on("change", (filepath: string) => this.handleFileChange(filepath))
      .on("unlink", (filepath: string) => this.handleFileDelete(filepath))
      .on("addDir", (dirpath: string) => this.handleDirAdd(dirpath))
      .on("unlinkDir", (dirpath: string) => this.handleDirDelete(dirpath))
      .on("error", (err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        this.handleError(error);
      });
  }

  /**
   * Handle file addition event
   * @param filepath - Absolute path to the added file
   */
  private async handleFileAdd(filepath: string): Promise<void> {
    const relPath = this.pathUtils.getRelativePath(filepath);
    const remotePath = this.pathUtils.getRemotePath(filepath);

    this.logger.info(`📝 [ADDED] Local file: ${relPath}`);

    try {
      await this.ftpService.uploadFile(filepath, remotePath);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error uploading file: ${relPath}`, error.message);
    }
  }

  /**
   * Handle file change event
   * @param filepath - Absolute path to the modified file
   */
  private async handleFileChange(filepath: string): Promise<void> {
    const relPath = this.pathUtils.getRelativePath(filepath);
    const remotePath = this.pathUtils.getRemotePath(filepath);

    this.logger.info(`🔄 [CHANGE] File modified: ${relPath}`);

    try {
      await this.ftpService.uploadFile(filepath, remotePath);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error uploading file: ${relPath}`, error.message);
    }
  }

  /**
   * Handle file deletion event
   * @param filepath - Absolute path to the deleted file
   */
  private async handleFileDelete(filepath: string): Promise<void> {
    const relPath = this.pathUtils.getRelativePath(filepath);
    const remotePath = this.pathUtils.getRemotePath(filepath);

    this.logger.info(`❌ [DELETED] File deleted: ${relPath}`);

    try {
      await this.ftpService.deleteFile(remotePath);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error deleting file: ${relPath}`, error.message);
    }
  }

  /**
   * Handle directory addition event
   * @param dirpath - Absolute path to the added directory
   */
  private async handleDirAdd(dirpath: string): Promise<void> {
    const relPath = this.pathUtils.getRelativePath(dirpath);
    const remotePath = this.pathUtils.getRemotePath(dirpath);

    this.logger.info(`📁 [FOLDER ADDED] New folder: ${relPath}`);

    try {
      await this.ftpService.createDirectory(remotePath);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error creating directory: ${relPath}`, error.message);
    }
  }

  /**
   * Handle directory deletion event
   * @param dirpath - Absolute path to the deleted directory
   */
  private async handleDirDelete(dirpath: string): Promise<void> {
    const relPath = this.pathUtils.getRelativePath(dirpath);
    const remotePath = this.pathUtils.getRemotePath(dirpath);

    this.logger.info(`🗑️ [FOLDER DELETED] Folder deleted: ${relPath}`);

    try {
      await this.ftpService.removeDirectory(remotePath);
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Error deleting directory: ${relPath}`,
        error.message,
      );
    }
  }

  /**
   * Handle watcher errors
   * @param error - Error from chokidar
   */
  private handleError(error: Error): void {
    this.logger.error("Monitoring error:", error.message);
  }

  /**
   * Stop watching for file changes and cleanup
   */
  public async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.logger.info("Monitoring stopped");
      this.watcher = null;
    }
  }

  /**
   * Check if the watcher is currently active
   * @returns true if watcher is running
   */
  public isWatching(): boolean {
    return this.watcher !== null;
  }
}
