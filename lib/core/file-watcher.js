// file-watcher.js - File system watcher with FTP synchronization

import chokidar from "chokidar";
import { Logger } from "../utils/logger.js";
import { config } from "./config.js";

/**
 * File watcher that monitors local file changes and synchronizes with FTP
 */
export class FileWatcher {
  constructor(ftpService, pathUtils) {
    this.ftpService = ftpService;
    this.pathUtils = pathUtils;
    this.logger = new Logger("Watcher");
    this.watcher = null;
  }

  /**
   * Start watching for file changes
   */
  async start() {
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
  setupHandlers() {
    this.watcher
      .on("add", (filepath) => this.handleFileAdd(filepath))
      .on("change", (filepath) => this.handleFileChange(filepath))
      .on("unlink", (filepath) => this.handleFileDelete(filepath))
      .on("addDir", (dirpath) => this.handleDirAdd(dirpath))
      .on("unlinkDir", (dirpath) => this.handleDirDelete(dirpath))
      .on("error", (error) => this.handleError(error));
  }

  /**
   * Handle file addition
   */
  async handleFileAdd(filepath) {
    const relPath = this.pathUtils.getRelativePath(filepath);
    const remotePath = this.pathUtils.getRemotePath(filepath);

    this.logger.info(`📝 [ADDED] Local file: ${relPath}`);

    try {
      await this.ftpService.uploadFile(filepath, remotePath);
    } catch (err) {
      this.logger.error(`Error uploading file: ${relPath}`, err.message);
    }
  }

  /**
   * Handle file change
   */
  async handleFileChange(filepath) {
    const relPath = this.pathUtils.getRelativePath(filepath);
    const remotePath = this.pathUtils.getRemotePath(filepath);

    this.logger.info(`🔄 [CHANGE] File modified: ${relPath}`);

    try {
      await this.ftpService.uploadFile(filepath, remotePath);
    } catch (err) {
      this.logger.error(`Error uploading file: ${relPath}`, err.message);
    }
  }

  /**
   * Handle file deletion
   */
  async handleFileDelete(filepath) {
    const relPath = this.pathUtils.getRelativePath(filepath);
    const remotePath = this.pathUtils.getRemotePath(filepath);

    this.logger.info(`❌ [DELETED] File deleted: ${relPath}`);

    try {
      await this.ftpService.deleteFile(remotePath);
    } catch (err) {
      this.logger.error(`Error deleting file: ${relPath}`, err.message);
    }
  }

  /**
   * Handle directory addition
   */
  async handleDirAdd(dirpath) {
    const relPath = this.pathUtils.getRelativePath(dirpath);
    const remotePath = this.pathUtils.getRemotePath(dirpath);

    this.logger.info(`📁 [FOLDER ADDED] New folder: ${relPath}`);

    try {
      await this.ftpService.createDirectory(remotePath);
    } catch (err) {
      this.logger.error(`Error creating directory: ${relPath}`, err.message);
    }
  }

  /**
   * Handle directory deletion
   */
  async handleDirDelete(dirpath) {
    const relPath = this.pathUtils.getRelativePath(dirpath);
    const remotePath = this.pathUtils.getRemotePath(dirpath);

    this.logger.info(`🗑️ [FOLDER DELETED] Folder deleted: ${relPath}`);

    try {
      await this.ftpService.removeDirectory(remotePath);
    } catch (err) {
      this.logger.error(
        `Error deleting directory: ${relPath}`,
        err.message,
      );
    }
  }

  /**
   * Handle watcher errors
   */
  handleError(error) {
    this.logger.error("Monitoring error:", error.message);
  }

  /**
   * Stop watching for file changes
   */
  async stop() {
    if (this.watcher) {
      await this.watcher.close();
      this.logger.info("Monitoring stopped");
    }
  }
}
