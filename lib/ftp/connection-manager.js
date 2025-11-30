// ftp-connection-manager.js - Connection pooling and lifecycle management

import { Client } from "basic-ftp";
import { config } from "../core/config.js";
import { Logger } from "../utils/logger.js";
import { classifyFtpError } from "./errors.js";

/**
 * FTP Connection Manager with pooling and automatic reconnection
 * Maintains a single persistent connection with idle timeout management
 */
class FtpConnectionManager {
  constructor() {
    this.client = null;
    this.isConnecting = false;
    this.lastActivity = null;
    this.idleTimeout = config.connection.idleTimeout;
    this.idleTimer = null;
    this.logger = new Logger("ConnectionManager");
  }

  /**
   * Get an active FTP connection (creates if needed, reuses if available)
   * @returns {Promise<Client>} FTP client instance
   */
  async getConnection() {
    // Reset idle timer on activity
    this.lastActivity = Date.now();
    this.resetIdleTimer();

    // Return existing connection if available
    if (this.client && this.client.closed === false) {
      this.logger.debug("Reusing existing FTP connection");
      return this.client;
    }

    // Wait if connection in progress
    if (this.isConnecting) {
      await this.waitForConnection();
      return this.client;
    }

    // Create new connection
    return await this.connect();
  }

  /**
   * Establish a new FTP connection
   * @returns {Promise<Client>} Connected FTP client
   * @throws {FtpError} If connection fails
   */
  async connect() {
    this.isConnecting = true;

    try {
      this.client = new Client();
      this.client.ftp.verbose = config.debug;
      this.client.ftp.timeout = config.ftp.timeout;

      await this.client.access({
        host: config.ftp.host,
        user: config.ftp.user,
        password: config.ftp.password,
        port: config.ftp.port,
        secure: config.ftp.secure,
      });

      this.logger.success("FTP connection established");
      this.setupConnectionHandlers();
      return this.client;
    } catch (err) {
      const ftpError = classifyFtpError(err);
      this.logger.error(ftpError.message);
      this.client = null;
      throw ftpError;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Setup event handlers for connection monitoring
   */
  setupConnectionHandlers() {
    if (!this.client || !this.client.ftp.socket) {
      return;
    }

    // Handle unexpected disconnection
    this.client.ftp.socket.on("error", (err) => {
      this.logger.error("FTP socket error:", err.message);
      this.client = null;
      this.clearIdleTimer();
    });

    this.client.ftp.socket.on("close", () => {
      this.logger.info("FTP connection closed");
      this.client = null;
      this.clearIdleTimer();
    });
  }

  /**
   * Reset the idle timeout timer
   */
  resetIdleTimer() {
    this.clearIdleTimer();

    this.idleTimer = setTimeout(() => {
      if (this.client && Date.now() - this.lastActivity >= this.idleTimeout) {
        this.logger.info("Closing idle FTP connection");
        this.close();
      }
    }, this.idleTimeout);
  }

  /**
   * Clear the idle timeout timer
   */
  clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * Wait for an in-progress connection to complete
   * @throws {Error} If connection times out
   */
  async waitForConnection() {
    const maxWait = 10000; // 10 seconds
    const start = Date.now();

    while (this.isConnecting && Date.now() - start < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!this.client) {
      throw new Error("Timeout waiting for FTP connection");
    }
  }

  /**
   * Close the current connection
   */
  close() {
    this.clearIdleTimer();
    if (this.client) {
      try {
        this.client.close();
      } catch (err) {
        this.logger.debug("Error closing connection:", err.message);
      }
      this.client = null;
    }
  }

  /**
   * Graceful shutdown - close connection and cleanup
   */
  async shutdown() {
    this.clearIdleTimer();
    if (this.client) {
      try {
        this.logger.info("Closing FTP connection...");
        this.client.close();
      } catch (err) {
        this.logger.error("Error closing FTP connection:", err.message);
      }
      this.client = null;
    }
  }
}

// Singleton instance
export const ftpConnectionManager = new FtpConnectionManager();
