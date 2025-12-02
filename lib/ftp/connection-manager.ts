// connection-manager.ts - Connection pooling and lifecycle management with strong typing

import { Client } from "basic-ftp";
import { config } from "../core/config.js";
import { Logger } from "../utils/logger.js";
import { classifyFtpError } from "./errors.js";

/**
 * FTP Connection Manager with pooling and automatic reconnection.
 * Maintains a single persistent connection with idle timeout management.
 * Singleton pattern ensures only one connection pool exists.
 */
class FtpConnectionManager {
  private client: Client | null = null;
  private isConnecting: boolean = false;
  private lastActivity: number | null = null;
  private readonly idleTimeout: number;
  private idleTimer: NodeJS.Timeout | null = null;
  private readonly logger: Logger;

  constructor() {
    this.idleTimeout = config.connection.idleTimeout;
    this.logger = new Logger("ConnectionManager");
  }

  /**
   * Get an active FTP connection (creates if needed, reuses if available)
   * @returns FTP client instance
   * @throws {FtpError} If connection fails
   */
  public async getConnection(): Promise<Client> {
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
      if (!this.client) {
        throw new Error("Connection failed during wait");
      }
      return this.client;
    }

    // Create new connection
    return await this.connect();
  }

  /**
   * Establish a new FTP connection
   * @returns Connected FTP client
   * @throws {FtpError} If connection fails
   */
  private async connect(): Promise<Client> {
    this.isConnecting = true;

    try {
      this.client = new Client();
      this.client.ftp.verbose = config.debug;

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
  private setupConnectionHandlers(): void {
    if (!this.client || !this.client.ftp.socket) {
      return;
    }

    // Handle unexpected disconnection
    this.client.ftp.socket.on("error", (err: Error) => {
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
  private resetIdleTimer(): void {
    this.clearIdleTimer();

    this.idleTimer = setTimeout(() => {
      if (
        this.client &&
        this.lastActivity !== null &&
        Date.now() - this.lastActivity >= this.idleTimeout
      ) {
        this.logger.info("Closing idle FTP connection");
        this.close();
      }
    }, this.idleTimeout);
  }

  /**
   * Clear the idle timeout timer
   */
  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * Wait for an in-progress connection to complete
   * @throws {Error} If connection times out
   */
  private async waitForConnection(): Promise<void> {
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
  public close(): void {
    this.clearIdleTimer();
    if (this.client) {
      try {
        this.client.close();
      } catch (err) {
        const error = err as Error;
        this.logger.debug("Error closing connection:", error.message);
      }
      this.client = null;
    }
  }

  /**
   * Graceful shutdown - close connection and cleanup
   */
  public async shutdown(): Promise<void> {
    this.clearIdleTimer();
    if (this.client) {
      try {
        this.logger.info("Closing FTP connection...");
        this.client.close();
      } catch (err) {
        const error = err as Error;
        this.logger.error("Error closing FTP connection:", error.message);
      }
      this.client = null;
    }
  }

  /**
   * Invalidate the current connection (forces reconnection on next request)
   * Useful when an error occurs and the connection state is uncertain
   */
  public invalidateConnection(): void {
    this.logger.debug("Invalidating FTP connection");
    this.close();
  }

  /**
   * Check if there's an active connection
   * @returns true if connection exists and is open
   */
  public hasActiveConnection(): boolean {
    return this.client !== null && this.client.closed === false;
  }

  /**
   * Get last activity timestamp
   * @returns Timestamp of last activity or null if no activity
   */
  public getLastActivity(): number | null {
    return this.lastActivity;
  }
}

/**
 * Singleton instance - ensures only one connection manager exists
 */
export const ftpConnectionManager = new FtpConnectionManager();
