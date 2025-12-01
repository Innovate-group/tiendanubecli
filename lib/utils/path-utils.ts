// path-utils.ts - Path conversion utilities for local and remote paths with strong typing

import path from "path";

/**
 * Utility class for handling path conversions between local and remote FTP paths.
 * Handles cross-platform path separators and FTP base path prefixing.
 */
export class PathUtils {
  private readonly themeFolderPath: string;
  private readonly ftpBasePath: string;

  /**
   * Create a new PathUtils instance
   * @param themeFolderPath - Local theme folder absolute path
   * @param ftpBasePath - FTP base path (e.g., "/", "/www/themes")
   */
  constructor(themeFolderPath: string, ftpBasePath: string = "/") {
    this.themeFolderPath = themeFolderPath;
    this.ftpBasePath = ftpBasePath;
  }

  /**
   * Get relative path from theme folder
   * @param fullPath - Full local path
   * @returns Relative path from theme folder
   */
  public getRelativePath(fullPath: string): string {
    return path.relative(this.themeFolderPath, fullPath);
  }

  /**
   * Convert local path to remote FTP path
   * @param localFullPath - Full local path
   * @returns Remote FTP path with POSIX separators
   */
  public getRemotePath(localFullPath: string): string {
    const relativePath = this.getRelativePath(localFullPath);
    return path.posix.join(this.ftpBasePath, this.toPosix(relativePath));
  }

  /**
   * Convert remote path to local path
   * @param remotePath - Remote FTP path
   * @returns Local file path with platform-specific separators
   */
  public getLocalPath(remotePath: string): string {
    // Remove FTP base path prefix
    let relativePath = remotePath;
    if (
      this.ftpBasePath !== "/" &&
      relativePath.startsWith(this.ftpBasePath)
    ) {
      relativePath = relativePath.substring(this.ftpBasePath.length);
    }
    relativePath = relativePath.replace(/^\/+/, "");

    return path.join(this.themeFolderPath, relativePath);
  }

  /**
   * Normalize remote path with FTP base
   * @param targetPath - Target path (may be relative or absolute)
   * @returns Normalized remote path with FTP base prefix
   */
  public normalizeRemotePath(targetPath: string): string {
    return targetPath.startsWith("/")
      ? targetPath
      : path.posix.join(this.ftpBasePath, targetPath);
  }

  /**
   * Ensure path uses POSIX separators (forward slashes)
   * Converts Windows backslashes to forward slashes for FTP compatibility
   * @param filePath - File path to convert
   * @returns Path with POSIX separators
   */
  public toPosix(filePath: string): string {
    // Replace all backslashes with forward slashes for cross-platform compatibility
    return filePath.replace(/\\/g, "/");
  }

  /**
   * Get the theme folder path
   * @returns Theme folder absolute path
   */
  public getThemeFolderPath(): string {
    return this.themeFolderPath;
  }

  /**
   * Get the FTP base path
   * @returns FTP base path
   */
  public getFtpBasePath(): string {
    return this.ftpBasePath;
  }
}
