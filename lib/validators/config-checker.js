import fs from "fs/promises";
import path from "path";
import { Logger } from "../utils/logger.js";

/**
 * ConfigChecker - Validates Tienda Nube / Nuvemshop theme configuration files
 *
 * This module checks .txt files in the theme/config/ directory for:
 * - Valid JSON syntax
 * - Required fields presence
 * - Correct data types
 * - Best practices compliance
 */
export class ConfigChecker {
  constructor() {
    this.logger = new Logger("ConfigChecker");
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Run all configuration checks
   * @param {string} themePath - Path to theme directory (default: './theme')
   * @returns {Promise<Object>} - Check results with errors and warnings
   */
  async check(themePath = "./theme") {
    this.errors = [];
    this.warnings = [];

    const configPath = path.join(themePath, "config");

    // Check if config directory exists
    try {
      await fs.access(configPath);
    } catch (error) {
      this.errors.push({
        file: "config/",
        message: "Config directory not found. Expected at: " + configPath,
        severity: "error",
      });
      return this.getResults();
    }

    // Find all .txt files in config directory
    let files;
    try {
      const allFiles = await fs.readdir(configPath);
      files = allFiles.filter((file) => file.endsWith(".txt"));
    } catch (error) {
      this.errors.push({
        file: "config/",
        message: "Cannot read config directory: " + error.message,
        severity: "error",
      });
      return this.getResults();
    }

    if (files.length === 0) {
      this.warnings.push({
        file: "config/",
        message: "No .txt configuration files found in config directory",
        severity: "warning",
      });
      return this.getResults();
    }

    // Check each configuration file
    for (const file of files) {
      const filePath = path.join(configPath, file);
      await this.checkFile(filePath, file);
    }

    return this.getResults();
  }

  /**
   * Check a single configuration file
   * @param {string} filePath - Full path to the file
   * @param {string} fileName - Name of the file
   */
  async checkFile(filePath, fileName) {
    let content;

    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch (error) {
      this.errors.push({
        file: fileName,
        message: "Cannot read file: " + error.message,
        severity: "error",
      });
      return;
    }

    // Check if file is empty
    if (!content.trim()) {
      this.errors.push({
        file: fileName,
        message: "File is empty",
        severity: "error",
      });
      return;
    }

    // Validate JSON syntax
    let jsonData;
    try {
      jsonData = JSON.parse(content);
    } catch (error) {
      const lineMatch = error.message.match(/position (\d+)/);
      let position = lineMatch ? parseInt(lineMatch[1]) : 0;

      // Calculate line and column from position
      const lines = content.substring(0, position).split("\n");
      const line = lines.length;
      const column = lines[lines.length - 1].length + 1;

      this.errors.push({
        file: fileName,
        line: line,
        column: column,
        message: "Invalid JSON syntax: " + error.message,
        severity: "error",
      });
      return;
    }

    // File-specific validations
    if (fileName === "settings.txt") {
      this.validateSettings(jsonData, fileName);
    } else if (fileName === "data.json" || fileName === "data.txt") {
      this.validateData(jsonData, fileName);
    }

    // General best practices
    this.checkBestPractices(jsonData, fileName);
  }

  /**
   * Validate settings.txt structure
   * @param {Object} data - Parsed JSON data
   * @param {string} fileName - File name for error reporting
   */
  validateSettings(data, fileName) {
    // Check if it's an array (required for settings.txt)
    if (!Array.isArray(data)) {
      this.errors.push({
        file: fileName,
        message: "Settings file must be a JSON array",
        severity: "error",
      });
      return;
    }

    // Validate each setting object
    data.forEach((setting, index) => {
      if (typeof setting !== "object" || setting === null) {
        this.errors.push({
          file: fileName,
          message: `Setting at index ${index} must be an object`,
          severity: "error",
        });
        return;
      }

      // Check required fields for each setting
      const requiredFields = ["id", "type", "label"];
      requiredFields.forEach((field) => {
        if (!(field in setting)) {
          this.warnings.push({
            file: fileName,
            message: `Setting at index ${index} is missing recommended field: "${field}"`,
            severity: "warning",
          });
        }
      });

      // Validate type field
      if (setting.type) {
        const validTypes = [
          "text",
          "textarea",
          "checkbox",
          "radio",
          "select",
          "color",
          "image",
          "font",
        ];
        if (!validTypes.includes(setting.type)) {
          this.warnings.push({
            file: fileName,
            message: `Setting at index ${index} has unknown type: "${setting.type}". Valid types: ${validTypes.join(", ")}`,
            severity: "warning",
          });
        }
      }
    });
  }

  /**
   * Validate data.json / data.txt structure
   * @param {Object} data - Parsed JSON data
   * @param {string} fileName - File name for error reporting
   */
  validateData(data, fileName) {
    // Check if it's an object
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      this.errors.push({
        file: fileName,
        message: "Data file must be a JSON object",
        severity: "error",
      });
    }
  }

  /**
   * Check general best practices
   * @param {*} data - Parsed JSON data
   * @param {string} fileName - File name for error reporting
   */
  checkBestPractices(data, fileName) {
    // Check for extremely large files
    const jsonString = JSON.stringify(data);
    if (jsonString.length > 100000) {
      this.warnings.push({
        file: fileName,
        message:
          "File is very large (>100KB). Consider optimizing your configuration.",
        severity: "warning",
      });
    }

    // Check for deeply nested objects (> 5 levels)
    const maxDepth = this.getMaxDepth(data);
    if (maxDepth > 5) {
      this.warnings.push({
        file: fileName,
        message: `Configuration has deep nesting (${maxDepth} levels). Consider flattening the structure.`,
        severity: "warning",
      });
    }
  }

  /**
   * Calculate maximum nesting depth of an object
   * @param {*} obj - Object to analyze
   * @returns {number} - Maximum depth
   */
  getMaxDepth(obj, currentDepth = 0) {
    if (typeof obj !== "object" || obj === null) {
      return currentDepth;
    }

    let maxChildDepth = currentDepth;
    const values = Array.isArray(obj) ? obj : Object.values(obj);

    for (const value of values) {
      const depth = this.getMaxDepth(value, currentDepth + 1);
      maxChildDepth = Math.max(maxChildDepth, depth);
    }

    return maxChildDepth;
  }

  /**
   * Get formatted results
   * @returns {Object} - Results with errors, warnings and success status
   */
  getResults() {
    return {
      success: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      summary: {
        totalErrors: this.errors.length,
        totalWarnings: this.warnings.length,
      },
    };
  }

  /**
   * Print results to console with colors
   */
  printResults(results) {
    console.log("\n" + "=".repeat(60));
    console.log("Configuration Check Results");
    console.log("=".repeat(60) + "\n");

    if (results.errors.length === 0 && results.warnings.length === 0) {
      this.logger.success("All configuration files are valid!");
      return;
    }

    // Print errors
    if (results.errors.length > 0) {
      console.log(`\n❌ Errors (${results.errors.length}):\n`);
      results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.file}`);
        if (error.line && error.column) {
          console.log(`   Line ${error.line}, Column ${error.column}`);
        }
        console.log(`   ${error.message}\n`);
      });
    }

    // Print warnings
    if (results.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${results.warnings.length}):\n`);
      results.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning.file}`);
        console.log(`   ${warning.message}\n`);
      });
    }

    // Print summary
    console.log("=".repeat(60));
    console.log(
      `Summary: ${results.summary.totalErrors} errors, ${results.summary.totalWarnings} warnings`,
    );
    console.log("=".repeat(60) + "\n");

    if (results.errors.length > 0) {
      this.logger.error(
        "Configuration check failed. Please fix the errors above.",
      );
    } else {
      this.logger.success(
        "No errors found, but there are some warnings to review.",
      );
    }
  }
}

/**
 * Standalone function to run config check
 * @param {string} themePath - Path to theme directory
 * @returns {Promise<boolean>} - True if check passed, false otherwise
 */
export async function runConfigCheck(themePath = "./theme") {
  const checker = new ConfigChecker();
  const results = await checker.check(themePath);
  checker.printResults(results);
  return results.success;
}
