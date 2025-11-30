import fs from "fs/promises";
import path from "path";
import { Logger } from "../utils/logger.js";

/**
 * ConfigChecker - Validates Tienda Nube / Nuvemshop theme configuration files
 *
 * This module checks files in the theme/config/ directory for:
 * - Valid JSON syntax (data.json)
 * - Tienda Nube specific format validation (settings.txt, defaults.txt, etc.)
 * - Critical tab indentation validation (tabs only, no spaces)
 * - Duplicate name field validation
 * - Cross-reference validation with defaults.txt
 * - Required fields presence and correct data types
 * - Best practices compliance
 */
export class ConfigChecker {
  constructor() {
    this.logger = new Logger("ConfigChecker");
    this.errors = [];
    this.warnings = [];
    this.allNames = new Map(); // Track all 'name' fields across files
    this.defaultValues = new Map(); // Track values from defaults.txt
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

    // Find all config files (.txt and .json)
    let files;
    try {
      const allFiles = await fs.readdir(configPath);
      files = allFiles.filter((file) => 
        file.endsWith(".txt") || file.endsWith(".json")
      );
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
        message: "No configuration files found in config directory",
        severity: "warning",
      });
      return this.getResults();
    }

    // Process defaults.txt first to load default values
    const defaultsFile = files.find(file => file === "defaults.txt");
    if (defaultsFile) {
      const defaultsPath = path.join(configPath, defaultsFile);
      await this.loadDefaultValues(defaultsPath);
    }

    // Check each configuration file
    for (const file of files) {
      const filePath = path.join(configPath, file);
      await this.checkFile(filePath, file);
    }

    // Validate name cross-references after all files are processed
    this.validateNameCorrespondence();

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

    // Determine file type and validate accordingly
    if (fileName.endsWith(".json")) {
      await this.validateJsonFile(content, fileName);
    } else if (fileName.endsWith(".txt")) {
      await this.validateTiendaNubeFile(content, fileName);
    }
  }

  /**
   * Load default values from defaults.txt
   * @param {string} filePath - Path to defaults.txt
   */
  async loadDefaultValues(filePath) {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");
      
      lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith("#") && trimmedLine.includes("=")) {
          const [name, ...valueParts] = trimmedLine.split("=");
          const value = valueParts.join("=").trim();
          this.defaultValues.set(name.trim(), {
            value,
            line: index + 1
          });
        }
      });
    } catch (error) {
      this.errors.push({
        file: "defaults.txt",
        message: "Cannot read defaults.txt: " + error.message,
        severity: "error",
      });
    }
  }

  /**
   * Validate JSON file (data.json)
   * @param {string} content - File content
   * @param {string} fileName - File name
   */
  async validateJsonFile(content, fileName) {
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

    // Validate data.json structure
    if (fileName === "data.json") {
      this.validateDataJson(jsonData, fileName);
    }

    // General best practices for JSON files
    this.checkJsonBestPractices(jsonData, fileName);
  }

  /**
   * Validate Tienda Nube specific file format
   * @param {string} content - File content
   * @param {string} fileName - File name
   */
  async validateTiendaNubeFile(content, fileName) {
    // Critical: Validate tab indentation
    this.validateTabIndentation(content, fileName);

    // Extract and validate name fields
    this.extractAndValidateNames(content, fileName);

    // File-specific validations
    switch (fileName) {
      case "settings.txt":
        this.validateSettingsStructure(content, fileName);
        break;
      case "sections.txt":
        this.validateSectionsStructure(content, fileName);
        break;
      case "translations.txt":
        this.validateTranslationsStructure(content, fileName);
        break;
      case "variants.txt":
        this.validateVariantsStructure(content, fileName);
        break;
      default:
        // Generic validation for other .txt files
        this.validateGenericTiendaNubeFile(content, fileName);
    }
  }

  /**
   * CRITICAL: Validate tab indentation (Tienda Nube requirement)
   * @param {string} content - File content
   * @param {string} fileName - File name
   */
  validateTabIndentation(content, fileName) {
    const lines = content.split("\n");
    
    lines.forEach((line, index) => {
      // Check if line has indentation
      if (line.length > 0 && line[0] === " ") {
        // Error: Uses spaces instead of tabs
        this.errors.push({
          file: fileName,
          line: index + 1,
          message: "CRITICAL: Indentation must use tabs, not spaces. Tienda Nube requires tab indentation.",
          severity: "error",
        });
      } else if (line.includes("\t ") || line.includes(" \t")) {
        // Error: Mixed tabs and spaces
        this.errors.push({
          file: fileName,
          line: index + 1,
          message: "CRITICAL: Mixed tabs and spaces detected. Use tabs only for indentation.",
          severity: "error",
        });
      }
    });
  }

  /**
   * Extract name fields from Tienda Nube files and validate uniqueness
   * @param {string} content - File content
   * @param {string} fileName - File name
   */
  extractAndValidateNames(content, fileName) {
    const lines = content.split("\n");
    const namesInFile = new Set();
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      // Match lines with 'name = value' pattern
      const nameMatch = trimmedLine.match(/^name\s*=\s*(.+)$/);
      if (nameMatch) {
        const nameValue = nameMatch[1].trim();
        
        // Check for duplicates within the same file
        if (namesInFile.has(nameValue)) {
          this.errors.push({
            file: fileName,
            line: index + 1,
            message: `Duplicate name field: "${nameValue}" already exists in this file`,
            severity: "error",
          });
        } else {
          namesInFile.add(nameValue);
        }
        
        // Track across all files
        if (this.allNames.has(nameValue)) {
          const existing = this.allNames.get(nameValue);
          this.errors.push({
            file: fileName,
            line: index + 1,
            message: `Duplicate name field: "${nameValue}" already exists in ${existing.file} at line ${existing.line}`,
            severity: "error",
          });
        } else {
          this.allNames.set(nameValue, {
            file: fileName,
            line: index + 1
          });
        }
      }
    });
  }

  /**
   * Validate correspondence between name fields and defaults.txt
   */
  validateNameCorrespondence() {
    // Check if every name has a corresponding default value
    for (const [nameValue, location] of this.allNames.entries()) {
      if (!this.defaultValues.has(nameValue)) {
        this.errors.push({
          file: location.file,
          line: location.line,
          message: `Name field "${nameValue}" has no corresponding value in defaults.txt`,
          severity: "error",
        });
      }
    }
    
    // Warn about unused defaults (optional)
    for (const [defaultName] of this.defaultValues.entries()) {
      if (!this.allNames.has(defaultName)) {
        this.warnings.push({
          file: "defaults.txt",
          message: `Default value "${defaultName}" is not used in any configuration file`,
          severity: "warning",
        });
      }
    }
  }

  /**
   * Validate data.json structure
   * @param {Object} data - Parsed JSON data
   * @param {string} fileName - File name
   */
  validateDataJson(data, fileName) {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      this.errors.push({
        file: fileName,
        message: "data.json must be a JSON object",
        severity: "error",
      });
      return;
    }
    
    // Check for required preview section
    if (!data.preview) {
      this.warnings.push({
        file: fileName,
        message: "Missing 'preview' section for real-time color updates",
        severity: "warning",
      });
    }
  }

  /**
   * Validate settings.txt structure
   * @param {string} content - File content
   * @param {string} fileName - File name
   */
  validateSettingsStructure(content, fileName) {
    const lines = content.split("\n");
    let hasMainSection = false;
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Check for main sections (no indentation)
      if (trimmedLine && !line.startsWith("\t") && !trimmedLine.includes("=")) {
        hasMainSection = true;
      }
    });
    
    if (!hasMainSection) {
      this.warnings.push({
        file: fileName,
        message: "No main sections found. Settings should be organized in sections.",
        severity: "warning",
      });
    }
  }

  /**
   * Validate sections.txt structure
   * @param {string} content - File content
   * @param {string} fileName - File name
   */
  validateSectionsStructure(content, fileName) {
    const lines = content.split("\n");
    let sectionCount = 0;
    
    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine && !line.startsWith("\t") && !trimmedLine.includes("=")) {
        sectionCount++;
      }
    });
    
    if (sectionCount === 0) {
      this.errors.push({
        file: fileName,
        message: "No product sections defined. At least one section is required.",
        severity: "error",
      });
    }
  }

  /**
   * Validate translations.txt structure
   * @param {string} content - File content
   * @param {string} fileName - File name
   */
  validateTranslationsStructure(content, fileName) {
    const lines = content.split("\n");
    const languages = new Set();
    
    lines.forEach((line) => {
      const trimmedLine = line.trim();
      // Match language lines: es "text", pt "text", etc.
      const langMatch = trimmedLine.match(/^(es|pt|en|es_mx)\s+".*"$/);
      if (langMatch) {
        languages.add(langMatch[1]);
      }
    });
    
    const requiredLanguages = ["es", "pt", "en", "es_mx"];
    requiredLanguages.forEach(lang => {
      if (!languages.has(lang)) {
        this.warnings.push({
          file: fileName,
          message: `Missing translations for language: ${lang}`,
          severity: "warning",
        });
      }
    });
  }

  /**
   * Validate variants.txt structure
   * @param {string} content - File content
   * @param {string} fileName - File name
   */
  validateVariantsStructure(content, fileName) {
    // Similar structure validation for variants
    this.validateGenericTiendaNubeFile(content, fileName);
  }

  /**
   * Generic validation for Tienda Nube files
   * @param {string} content - File content
   * @param {string} fileName - File name
   */
  validateGenericTiendaNubeFile(content, fileName) {
    const lines = content.split("\n");
    
    // Check for reasonable file size
    if (content.length > 500000) { // 500KB
      this.warnings.push({
        file: fileName,
        message: "File is very large (>500KB). Consider optimizing your configuration.",
        severity: "warning",
      });
    }
    
    // Check for excessive nesting (more than 5 tab levels)
    lines.forEach((line, index) => {
      const tabCount = line.match(/^\t*/)[0].length;
      if (tabCount > 5) {
        this.warnings.push({
          file: fileName,
          line: index + 1,
          message: `Excessive nesting (${tabCount} levels). Consider flattening the structure.`,
          severity: "warning",
        });
      }
    });
  }

  /**
   * Check best practices for JSON files
   * @param {*} data - Parsed JSON data
   * @param {string} fileName - File name
   */
  checkJsonBestPractices(data, fileName) {
    const jsonString = JSON.stringify(data);
    if (jsonString.length > 100000) {
      this.warnings.push({
        file: fileName,
        message: "File is very large (>100KB). Consider optimizing your configuration.",
        severity: "warning",
      });
    }

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
