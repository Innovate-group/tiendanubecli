// app.js - Main entry point with refactored architecture

import fs from "fs";
import { config, validateConfig } from "./config.js";
import { FtpService } from "../ftp/service.js";
import { FileWatcher } from "./file-watcher.js";
import { PathUtils } from "../utils/path-utils.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("App");
const args = process.argv.slice(2);
const mode = args[0] || "watch";
const targetFile = args[1];

/**
 * Ensure theme folder exists
 */
function ensureThemeFolder() {
  if (!fs.existsSync(config.local.themeFolderPath)) {
    logger.info("Creating theme folder...");
    fs.mkdirSync(config.local.themeFolderPath, { recursive: true });
    logger.success("Theme folder created successfully.");
  }
  return config.local.themeFolderPath;
}

/**
 * Run watch mode - monitor and sync files
 */
async function runWatchMode() {
  logger.info("\n=== 🔄 FTP SYNCHRONIZATION SYSTEM ===\n");

  const ftpService = new FtpService();
  const pathUtils = new PathUtils(
    config.local.themeFolderPath,
    config.ftp.basePath,
  );
  const watcher = new FileWatcher(ftpService, pathUtils);

  try {
    // Test connection
    await ftpService.connectionManager.getConnection();

    // Start watching
    await watcher.start();

    // Setup graceful shutdown
    setupShutdownHandlers(ftpService, watcher);
  } catch (err) {
    logger.error("Could not establish FTP connection:", err.message);
    if (config.debug) {
      console.error(err);
    }
    process.exit(1);
  }
}

/**
 * Run download mode - download entire theme
 */
async function runDownloadMode() {
  logger.info("\n=== 📥 FTP DOWNLOAD SYSTEM ===\n");

  const ftpService = new FtpService();

  try {
    const remoteBasePath = config.ftp.basePath;
    const localBasePath = config.local.themeFolderPath;

    await ftpService.downloadAll(remoteBasePath, localBasePath);

    logger.success("\n✅ Operation completed");
  } catch (err) {
    logger.error("Error during download:", err.message);
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
 * Run push-all mode - upload entire theme to FTP
 */
async function runPushAllMode() {
  logger.info("\n=== 📤 FTP UPLOAD SYSTEM ===\n");

  const ftpService = new FtpService();

  try {
    const localBasePath = config.local.themeFolderPath;
    const remoteBasePath = config.ftp.basePath;

    await ftpService.uploadAll(localBasePath, remoteBasePath);

    logger.success("\n✅ Operation completed");
  } catch (err) {
    logger.error("Error during upload:", err.message);
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
 * Run download-file mode - download specific file
 */
async function runDownloadFileMode() {
  logger.info("\n=== 📥 FTP FILE DOWNLOAD SYSTEM ===\n");

  if (!targetFile) {
    logger.error("No file specified to download.");
    logger.info("ℹ️  Usage: node app.js download-file <remote-file-path>");
    logger.info("ℹ️  Example: node app.js download-file config/settings.txt");
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
    logger.error("Error during download:", err.message);
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
 * Setup graceful shutdown handlers
 */
function setupShutdownHandlers(ftpService, watcher) {
  const shutdown = async () => {
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
 * Main entry point
 */
async function main() {
  try {
    // Validate configuration
    validateConfig();

    // Ensure theme folder exists
    ensureThemeFolder();

    // Run appropriate mode
    switch (mode) {
      case "download":
        await runDownloadMode();
        break;
      case "download-file":
        await runDownloadFileMode();
        break;
      case "push-all":
        await runPushAllMode();
        break;
      case "watch":
      default:
        await runWatchMode();
        break;
    }
  } catch (err) {
    logger.error("Error fatal:", err.message);
    if (config.debug) {
      console.error(err);
    }
    process.exit(1);
  }
}

// Start the application
main();
