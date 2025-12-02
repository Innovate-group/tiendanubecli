// config-checker.ts - Validates Tienda Nube / Nuvemshop theme configuration files with strong typing

import { promises as fs } from "fs";
import path from "path";
import { Logger } from "../utils/logger.js";

/**
 * Validation error or warning severity
 */
type Severity = "error" | "warning";

/**
 * Validation issue structure
 */
export interface ValidationIssue {
  file: string;
  line?: number;
  column?: number;
  message: string;
  severity: Severity;
}

/**
 * Location of a name field in configuration
 */
interface NameLocation {
  file: string;
  line: number;
}

/**
 * Default value entry from defaults.txt
 */
interface DefaultValue {
  value: string;
  line: number;
}

/**
 * Validation results summary
 */
export interface ValidationResults {
  success: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: {
    totalErrors: number;
    totalWarnings: number;
  };
}

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
  private readonly logger: Logger;
  private errors: ValidationIssue[] = [];
  private warnings: ValidationIssue[] = [];
  private allNames: Map<string, NameLocation> = new Map(); // Track all 'name' fields across files
  private defaultValues: Map<string, DefaultValue> = new Map(); // Track values from defaults.txt

  constructor() {
    this.logger = new Logger("ConfigChecker");
  }

  /**
   * Run all configuration checks
   * @param themePath - Path to theme directory (default: './theme')
   * @returns Check results with errors and warnings
   */
  public async check(themePath: string = "./theme"): Promise<ValidationResults> {
    this.errors = [];
    this.warnings = [];
    this.allNames = new Map();
    this.defaultValues = new Map();

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
    let files: string[];
    try {
      const allFiles = await fs.readdir(configPath);
      files = allFiles.filter(
        (file) => file.endsWith(".txt") || file.endsWith(".json"),
      );
    } catch (error) {
      const err = error as Error;
      this.errors.push({
        file: "config/",
        message: "Cannot read config directory: " + err.message,
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
    const defaultsFile = files.find((file) => file === "defaults.txt");
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
   * @param filePath - Full path to the file
   * @param fileName - Name of the file
   */
  private async checkFile(filePath: string, fileName: string): Promise<void> {
    let content: string;

    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch (error) {
      const err = error as Error;
      this.errors.push({
        file: fileName,
        message: "Cannot read file: " + err.message,
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
   * @param filePath - Path to defaults.txt
   */
  private async loadDefaultValues(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (
          trimmedLine &&
          !trimmedLine.startsWith("#") &&
          trimmedLine.includes("=")
        ) {
          const [name, ...valueParts] = trimmedLine.split("=");
          if (name) {
            const value = valueParts.join("=").trim();
            this.defaultValues.set(name.trim(), {
              value,
              line: index + 1,
            });
          }
        }
      });
    } catch (error) {
      const err = error as Error;
      this.errors.push({
        file: "defaults.txt",
        message: "Cannot read defaults.txt: " + err.message,
        severity: "error",
      });
    }
  }

  /**
   * Validate JSON file (data.json)
   * @param content - File content
   * @param fileName - File name
   */
  private async validateJsonFile(
    content: string,
    fileName: string,
  ): Promise<void> {
    let jsonData: unknown;
    try {
      jsonData = JSON.parse(content);
    } catch (error) {
      const err = error as Error;
      const lineMatch = err.message.match(/position (\d+)/);
      const position = lineMatch && lineMatch[1] ? parseInt(lineMatch[1], 10) : 0;

      // Calculate line and column from position
      const lines = content.substring(0, position).split("\n");
      const line = lines.length;
      const lastLine = lines[lines.length - 1];
      const column = (lastLine?.length ?? 0) + 1;

      this.errors.push({
        file: fileName,
        line: line,
        column: column,
        message: "Invalid JSON syntax: " + err.message,
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
   * @param content - File content
   * @param fileName - File name
   */
  private async validateTiendaNubeFile(
    content: string,
    fileName: string,
  ): Promise<void> {
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
   * @param content - File content
   * @param fileName - File name
   */
  private validateTabIndentation(content: string, fileName: string): void {
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      // Check if line has indentation
      if (line.length > 0 && line[0] === " ") {
        // Error: Uses spaces instead of tabs
        this.errors.push({
          file: fileName,
          line: index + 1,
          message:
            "CRITICAL: Indentation must use tabs, not spaces. Tienda Nube requires tab indentation.",
          severity: "error",
        });
      } else if (line.includes("\t ") || line.includes(" \t")) {
        // Error: Mixed tabs and spaces
        this.errors.push({
          file: fileName,
          line: index + 1,
          message:
            "CRITICAL: Mixed tabs and spaces detected. Use tabs only for indentation.",
          severity: "error",
        });
      }
    });
  }

  /**
   * Extract name fields from Tienda Nube files and validate uniqueness
   * @param content - File content
   * @param fileName - File name
   */
  private extractAndValidateNames(content: string, fileName: string): void {
    const lines = content.split("\n");
    const namesInFile = new Set<string>();

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      // Match lines with 'name = value' pattern
      const nameMatch = trimmedLine.match(/^name\s*=\s*(.+)$/);
      if (nameMatch && nameMatch[1]) {
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
          const existing = this.allNames.get(nameValue)!;
          this.errors.push({
            file: fileName,
            line: index + 1,
            message: `Duplicate name field: "${nameValue}" already exists in ${existing.file} at line ${existing.line}`,
            severity: "error",
          });
        } else {
          this.allNames.set(nameValue, {
            file: fileName,
            line: index + 1,
          });
        }
      }
    });
  }

  /**
   * Validate correspondence between name fields and defaults.txt
   */
  private validateNameCorrespondence(): void {
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
   * @param data - Parsed JSON data
   * @param fileName - File name
   */
  private validateDataJson(data: unknown, fileName: string): void {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      this.errors.push({
        file: fileName,
        message: "data.json must be a JSON object",
        severity: "error",
      });
      return;
    }

    // Check for required preview section
    const dataObj = data as Record<string, unknown>;
    if (!dataObj.preview) {
      this.warnings.push({
        file: fileName,
        message: "Missing 'preview' section for real-time color updates",
        severity: "warning",
      });
    }
  }

  /**
   * Validate settings.txt structure
   * @param content - File content
   * @param fileName - File name
   */
  private validateSettingsStructure(content: string, fileName: string): void {
    const lines = content.split("\n");
    let hasMainSection = false;

    lines.forEach((line) => {
      const trimmedLine = line.trim();

      // Check for main sections (no indentation)
      if (trimmedLine && !line.startsWith("\t") && !trimmedLine.includes("=")) {
        hasMainSection = true;
      }
    });

    if (!hasMainSection) {
      this.warnings.push({
        file: fileName,
        message:
          "No main sections found. Settings should be organized in sections.",
        severity: "warning",
      });
    }
  }

  /**
   * Validate sections.txt structure
   * @param content - File content
   * @param fileName - File name
   */
  private validateSectionsStructure(content: string, fileName: string): void {
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
        message:
          "No product sections defined. At least one section is required.",
        severity: "error",
      });
    }
  }

  /**
   * Validate translations.txt structure
   * @param content - File content
   * @param fileName - File name
   */
  private validateTranslationsStructure(
    content: string,
    fileName: string,
  ): void {
    const lines = content.split("\n");
    const languages = new Set<string>();

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      // Match language lines: es "text", pt "text", etc.
      const langMatch = trimmedLine.match(/^(es|pt|en|es_mx)\s+".*"$/);
      if (langMatch && langMatch[1]) {
        languages.add(langMatch[1]);
      }
    });

    const requiredLanguages = ["es", "pt", "en", "es_mx"];
    requiredLanguages.forEach((lang) => {
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
   * @param content - File content
   * @param fileName - File name
   */
  private validateVariantsStructure(content: string, fileName: string): void {
    // Similar structure validation for variants
    this.validateGenericTiendaNubeFile(content, fileName);
  }

  /**
   * Generic validation for Tienda Nube files
   * @param content - File content
   * @param fileName - File name
   */
  private validateGenericTiendaNubeFile(
    content: string,
    fileName: string,
  ): void {
    const lines = content.split("\n");

    // Check for reasonable file size
    if (content.length > 500000) {
      // 500KB
      this.warnings.push({
        file: fileName,
        message:
          "File is very large (>500KB). Consider optimizing your configuration.",
        severity: "warning",
      });
    }

    // Check for excessive nesting (more than 5 tab levels)
    lines.forEach((line, index) => {
      const tabMatch = line.match(/^\t*/);
      const tabCount = tabMatch ? tabMatch[0].length : 0;
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
   * @param data - Parsed JSON data
   * @param fileName - File name
   */
  private checkJsonBestPractices(data: unknown, fileName: string): void {
    const jsonString = JSON.stringify(data);
    if (jsonString.length > 100000) {
      this.warnings.push({
        file: fileName,
        message:
          "File is very large (>100KB). Consider optimizing your configuration.",
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
   * @param obj - Object to analyze
   * @param currentDepth - Current depth level
   * @returns Maximum depth
   */
  private getMaxDepth(obj: unknown, currentDepth: number = 0): number {
    if (typeof obj !== "object" || obj === null) {
      return currentDepth;
    }

    let maxChildDepth = currentDepth;
    const values = Array.isArray(obj)
      ? obj
      : Object.values(obj as Record<string, unknown>);

    for (const value of values) {
      const depth = this.getMaxDepth(value, currentDepth + 1);
      maxChildDepth = Math.max(maxChildDepth, depth);
    }

    return maxChildDepth;
  }

  /**
   * Get formatted results
   * @returns Results with errors, warnings and success status
   */
  public getResults(): ValidationResults {
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
   * @param results - Validation results to print
   */
  public printResults(results: ValidationResults): void {
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
 * @param themePath - Path to theme directory
 * @returns True if check passed, false otherwise
 */
export async function runConfigCheck(
  themePath: string = "./theme",
): Promise<boolean> {
  const checker = new ConfigChecker();
  const results = await checker.check(themePath);
  checker.printResults(results);
  return results.success;
}
