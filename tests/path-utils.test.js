// tests/path-utils.test.js - Tests for path utilities

import { PathUtils } from "../dist/lib/utils/path-utils.js";
import path from "path";

describe("PathUtils", () => {
  let pathUtils;
  const themeFolderPath = "/home/user/theme";
  const ftpBasePath = "/public_html";

  beforeEach(() => {
    pathUtils = new PathUtils(themeFolderPath, ftpBasePath);
  });

  describe("getRelativePath", () => {
    it("should return relative path from theme folder", () => {
      const fullPath = "/home/user/theme/config/settings.txt";
      const result = pathUtils.getRelativePath(fullPath);

      expect(result).toBe(path.join("config", "settings.txt"));
    });

    it("should return empty string for theme folder itself", () => {
      const result = pathUtils.getRelativePath(themeFolderPath);
      expect(result).toBe("");
    });
  });

  describe("getRemotePath", () => {
    it("should convert local path to remote FTP path", () => {
      const localPath = "/home/user/theme/config/settings.txt";
      const result = pathUtils.getRemotePath(localPath);

      expect(result).toBe("/public_html/config/settings.txt");
    });

    it("should handle Windows-style separators", () => {
      const localPath = "/home/user/theme/templates\\product.tpl";
      const result = pathUtils.getRemotePath(localPath);

      // Should convert to POSIX style
      expect(result).toContain("/");
      expect(result).not.toContain("\\");
    });
  });

  describe("getLocalPath", () => {
    it("should convert remote path to local path", () => {
      const remotePath = "/public_html/config/settings.txt";
      const result = pathUtils.getLocalPath(remotePath);

      expect(result).toBe(path.join(themeFolderPath, "config", "settings.txt"));
    });

    it("should handle paths without FTP base prefix", () => {
      const remotePath = "config/settings.txt";
      const result = pathUtils.getLocalPath(remotePath);

      expect(result).toBe(path.join(themeFolderPath, "config", "settings.txt"));
    });
  });

  describe("normalizeRemotePath", () => {
    it("should keep absolute paths unchanged", () => {
      const result = pathUtils.normalizeRemotePath("/absolute/path/file.txt");
      expect(result).toBe("/absolute/path/file.txt");
    });

    it("should prepend FTP base path to relative paths", () => {
      const result = pathUtils.normalizeRemotePath("config/settings.txt");
      expect(result).toBe("/public_html/config/settings.txt");
    });
  });

  describe("toPosix", () => {
    it("should convert path to POSIX separators", () => {
      const windowsPath = "config\\templates\\product.tpl";
      const result = pathUtils.toPosix(windowsPath);

      expect(result).toBe("config/templates/product.tpl");
    });

    it("should leave POSIX paths unchanged", () => {
      const posixPath = "config/templates/product.tpl";
      const result = pathUtils.toPosix(posixPath);

      expect(result).toBe("config/templates/product.tpl");
    });
  });
});
