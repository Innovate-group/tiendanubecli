// path-utils.js - Path conversion utilities for local and remote paths

import path from "path";

/**
 * Utility class for handling path conversions between local and remote FTP paths
 */
export class PathUtils {
  constructor(themeFolderPath, ftpBasePath = "/") {
    this.themeFolderPath = themeFolderPath;
    this.ftpBasePath = ftpBasePath;
  }

  /**
   * Get relative path from theme folder
   * @param {string} fullPath - Full local path
   * @returns {string} Relative path
   */
  getRelativePath(fullPath) {
    return path.relative(this.themeFolderPath, fullPath);
  }

  /**
   * Convert local path to remote FTP path
   * @param {string} localFullPath - Full local path
   * @returns {string} Remote FTP path
   */
  getRemotePath(localFullPath) {
    const relativePath = this.getRelativePath(localFullPath);
    return path.posix.join(this.ftpBasePath, this.toPosix(relativePath));
  }

  /**
   * Convert remote path to local path
   * @param {string} remotePath - Remote FTP path
   * @returns {string} Local file path
   */
  getLocalPath(remotePath) {
    // Remove FTP base path prefix
    let relativePath = remotePath;
    if (this.ftpBasePath !== "/" && relativePath.startsWith(this.ftpBasePath)) {
      relativePath = relativePath.substring(this.ftpBasePath.length);
    }
    relativePath = relativePath.replace(/^\/+/, "");

    return path.join(this.themeFolderPath, relativePath);
  }

  /**
   * Normalize remote path with FTP base
   * @param {string} targetPath - Target path (may be relative or absolute)
   * @returns {string} Normalized remote path
   */
  normalizeRemotePath(targetPath) {
    return targetPath.startsWith("/")
      ? targetPath
      : path.posix.join(this.ftpBasePath, targetPath);
  }

  /**
   * Ensure path uses POSIX separators
   * @param {string} filePath - File path to convert
   * @returns {string} Path with POSIX separators
   */
  toPosix(filePath) {
    // Replace all backslashes with forward slashes for cross-platform compatibility
    return filePath.replace(/\\/g, "/");
  }
}
