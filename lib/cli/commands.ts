// commands.ts - CLI command implementations with strong typing

import fs from "fs";
import { config, validateConfig } from "../core/config.js";
import { FtpService } from "../ftp/service.js";
import { FileWatcher } from "../core/file-watcher.js";
import { PathUtils } from "../utils/path-utils.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("CLI");

/**
 * Ensure theme folder exists, creating it if necessary
 * @returns Theme folder path
 */
function ensureThemeFolder(): string {
  if (!fs.existsSync(config.local.themeFolderPath)) {
    logger.info("Creating theme folder...");
    fs.mkdirSync(config.local.themeFolderPath, { recursive: true });
    logger.success("Theme folder created successfully.");
  }
  return config.local.themeFolderPath;
}

/**
 * Setup graceful shutdown handlers for SIGINT and SIGTERM
 * @param ftpService - FTP service to shutdown
 * @param watcher - File watcher to stop (optional)
 */
function setupShutdownHandlers(
  ftpService: FtpService,
  watcher?: FileWatcher,
): void {
  const shutdown = async (): Promise<void> => {
    logger.info("\n\n🛑 Closing application...");

    if (watcher) {
      await watcher.stop();
    }

    await ftpService.shutdown();

    logger.success("System stopped successfully");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

/**
 * Run watch mode - monitor and sync files
 * Starts file system watcher and automatically syncs changes to FTP
 * @throws {Error} If configuration is invalid or connection fails
 */
export async function runWatch(): Promise<void> {
  // Validate configuration
  validateConfig();
  ensureThemeFolder();

  logger.info("\n=== 🔄 FTP SYNCHRONIZATION SYSTEM ===\n");

  const ftpService = new FtpService();
  const pathUtils = new PathUtils(
    config.local.themeFolderPath,
    config.ftp.basePath,
  );
  const watcher = new FileWatcher(ftpService, pathUtils);

  try {
    // Test connection
    await ftpService.testConnection();

    // Start watching
    await watcher.start();

    // Setup graceful shutdown
    setupShutdownHandlers(ftpService, watcher);
  } catch (err) {
    const error = err as Error;
    logger.error("Could not establish FTP connection:", error.message);
    if (config.debug) {
      console.error(err);
    }
    process.exit(1);
  }
}

/**
 * Run download mode - download entire theme from FTP to local
 * Downloads all files recursively from the FTP server
 * @throws {Error} If download fails
 */
export async function runDownload(): Promise<void> {
  // Validate configuration
  validateConfig();
  ensureThemeFolder();

  logger.info("\n=== 📥 FTP DOWNLOAD SYSTEM ===\n");

  const ftpService = new FtpService();

  try {
    const remoteBasePath = config.ftp.basePath;
    const localBasePath = config.local.themeFolderPath;

    await ftpService.downloadAll(remoteBasePath, localBasePath);

    logger.success("\n✅ Operation completed");
  } catch (err) {
    const error = err as Error;
    logger.error("Error during download:", error.message);
    if (config.debug) {
      console.error(err);
    }
    process.exit(1);
  } finally {
    await ftpService.shutdown();
    process.exit(0);
  }
}

/**
 * Run push mode - upload entire local theme to FTP
 * Uploads all files recursively to the FTP server
 * @throws {Error} If upload fails
 */
export async function runPush(): Promise<void> {
  // Validate configuration
  validateConfig();
  ensureThemeFolder();

  logger.info("\n=== 📤 FTP UPLOAD SYSTEM ===\n");

  const ftpService = new FtpService();

  try {
    const localBasePath = config.local.themeFolderPath;
    const remoteBasePath = config.ftp.basePath;

    await ftpService.uploadAll(localBasePath, remoteBasePath);

    logger.success("\n✅ Operation completed");
  } catch (err) {
    const error = err as Error;
    logger.error("Error during upload:", error.message);
    if (config.debug) {
      console.error(err);
    }
    process.exit(1);
  } finally {
    await ftpService.shutdown();
    process.exit(0);
  }
}

/**
 * Run download-file mode - download specific file from FTP
 * Downloads a single file from the FTP server to local theme folder
 * @param targetFile - Remote file path to download (relative or absolute)
 * @throws {Error} If file not specified or download fails
 */
export async function runDownloadFile(targetFile: string): Promise<void> {
  // Validate configuration
  validateConfig();
  ensureThemeFolder();

  logger.info("\n=== 📥 FTP FILE DOWNLOAD SYSTEM ===\n");

  if (!targetFile) {
    logger.error("No file specified to download.");
    logger.info("ℹ️  Usage: tiendanube download-file <remote-file-path>");
    logger.info("ℹ️  Example: tiendanube download-file config/settings.txt");
    process.exit(1);
  }

  const ftpService = new FtpService();
  const pathUtils = new PathUtils(
    config.local.themeFolderPath,
    config.ftp.basePath,
  );

  try {
    const remoteFilePath = pathUtils.normalizeRemotePath(targetFile);
    const localFilePath = pathUtils.getLocalPath(remoteFilePath);

    logger.info(`ℹ️  FTP file: ${remoteFilePath}`);
    logger.info(`ℹ️  Local destination: ${localFilePath}`);

    await ftpService.downloadFile(remoteFilePath, localFilePath);

    logger.success("\n✅ Operation completed");
  } catch (err) {
    const error = err as Error;
    logger.error("Error during download:", error.message);
    if (config.debug) {
      console.error(err);
    }
    process.exit(1);
  } finally {
    await ftpService.shutdown();
    process.exit(0);
  }
}
