// tests/ftp-service.test.js - Tests for FTP service

import { jest } from "@jest/globals";
import fs from "fs";
import { FtpService } from "../dist/lib/ftp/service.js";
import { FtpError } from "../dist/lib/ftp/errors.js";

describe("FtpService", () => {
  let ftpService;
  let mockConnectionManager;

  beforeEach(() => {
    mockConnectionManager = {
      getConnection: jest.fn(),
      shutdown: jest.fn(),
      invalidateConnection: jest.fn(),
      client: null,
    };

    ftpService = new FtpService();
    ftpService.connectionManager = mockConnectionManager;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("uploadFile", () => {
    it("should throw error if local file does not exist", async () => {
      await expect(
        ftpService.uploadFile("/nonexistent/file.txt", "/remote/file.txt"),
      ).rejects.toThrow(FtpError);
    });

    it("should upload file successfully", async () => {
      const mockClient = {
        ensureDir: jest.fn().mockResolvedValue(undefined),
        uploadFrom: jest.fn().mockResolvedValue(undefined),
      };

      mockConnectionManager.getConnection.mockResolvedValue(mockClient);

      // Create a temporary file for testing (mocked scenario)
      // In real test, you would create actual temp file
      jest.spyOn(fs, "existsSync").mockReturnValue(true);

      await ftpService.uploadFile("/local/file.txt", "/remote/file.txt");

      expect(mockClient.ensureDir).toHaveBeenCalledWith("/remote");
      expect(mockClient.uploadFrom).toHaveBeenCalledWith(
        "/local/file.txt",
        "/remote/file.txt",
      );
    });
  });

  describe("deleteFile", () => {
    it("should delete file successfully", async () => {
      const mockClient = {
        remove: jest.fn().mockResolvedValue(undefined),
      };

      mockConnectionManager.getConnection.mockResolvedValue(mockClient);

      await ftpService.deleteFile("/remote/file.txt");

      expect(mockClient.remove).toHaveBeenCalledWith("/remote/file.txt");
    });
  });

  describe("createDirectory", () => {
    it("should create directory successfully", async () => {
      const mockClient = {
        ensureDir: jest.fn().mockResolvedValue(undefined),
      };

      mockConnectionManager.getConnection.mockResolvedValue(mockClient);

      await ftpService.createDirectory("/remote/newdir");

      expect(mockClient.ensureDir).toHaveBeenCalledWith("/remote/newdir");
    });
  });

  describe("executeOperation with retry logic", () => {
    it("should retry on retryable errors", async () => {
      const mockClient = {
        list: jest.fn(),
      };

      // Fail once, succeed on second attempt (maxRetries = 2)
      mockClient.list
        .mockRejectedValueOnce(new Error("ETIMEDOUT"))
        .mockResolvedValueOnce([]);

      mockConnectionManager.getConnection.mockResolvedValue(mockClient);

      const result = await ftpService.listDirectory("/remote");

      expect(mockClient.list).toHaveBeenCalledTimes(2);
      expect(result).toEqual([]);
    });

    it("should not retry on non-retryable errors", async () => {
      const mockClient = {
        remove: jest.fn(),
      };

      // Authentication error (not retryable)
      mockClient.remove.mockRejectedValue(
        new Error("530 Login authentication failed"),
      );

      mockConnectionManager.getConnection.mockResolvedValue(mockClient);

      await expect(ftpService.deleteFile("/remote/file.txt")).rejects.toThrow();

      // Should only try once (no retry for auth errors)
      expect(mockClient.remove).toHaveBeenCalledTimes(1);
    });
  });
});
