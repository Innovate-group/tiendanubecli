import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { ConfigChecker } from "../lib/validators/config-checker.js";
import fs from "fs/promises";
import path from "path";

describe("ConfigChecker", () => {
  let checker;
  const testThemePath = "./test-theme-temp";
  const testConfigPath = path.join(testThemePath, "config");

  beforeEach(async () => {
    checker = new ConfigChecker();
    // Create test theme and config directories
    await fs.mkdir(testConfigPath, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directories
    try {
      await fs.rm(testThemePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("Directory Validation", () => {
    it("should report error when config directory doesn't exist", async () => {
      const results = await checker.check("./nonexistent-theme");

      expect(results.success).toBe(false);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0].message).toContain("Config directory not found");
    });

    it("should report warning when no .txt files found", async () => {
      const results = await checker.check(testThemePath);

      expect(results.success).toBe(true); // No errors, just warnings
      expect(results.warnings).toHaveLength(1);
      expect(results.warnings[0].message).toContain(
        "No .txt configuration files found",
      );
    });
  });

  describe("JSON Syntax Validation", () => {
    it("should validate valid JSON file", async () => {
      const validJson = JSON.stringify({ key: "value" }, null, 2);
      await fs.writeFile(path.join(testConfigPath, "test.txt"), validJson);

      const results = await checker.check(testThemePath);

      expect(results.success).toBe(true);
      expect(results.errors).toHaveLength(0);
    });

    it("should report error for invalid JSON syntax", async () => {
      const invalidJson = '{ "key": "value" '; // Missing closing brace
      await fs.writeFile(path.join(testConfigPath, "invalid.txt"), invalidJson);

      const results = await checker.check(testThemePath);

      expect(results.success).toBe(false);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0].message).toContain("Invalid JSON syntax");
      expect(results.errors[0].file).toBe("invalid.txt");
    });

    it("should report error for empty file", async () => {
      await fs.writeFile(path.join(testConfigPath, "empty.txt"), "");

      const results = await checker.check(testThemePath);

      expect(results.success).toBe(false);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0].message).toBe("File is empty");
    });

    it("should report line and column for JSON errors", async () => {
      const invalidJson = '{\n  "key": "value",\n  "bad": ]'; // Wrong bracket
      await fs.writeFile(
        path.join(testConfigPath, "syntax-error.txt"),
        invalidJson,
      );

      const results = await checker.check(testThemePath);

      expect(results.success).toBe(false);
      expect(results.errors[0]).toHaveProperty("line");
      expect(results.errors[0]).toHaveProperty("column");
    });
  });

  describe("settings.txt Validation", () => {
    it("should validate correct settings.txt structure", async () => {
      const validSettings = [
        {
          id: "logo",
          type: "image",
          label: "Store Logo",
        },
        {
          id: "color_primary",
          type: "color",
          label: "Primary Color",
        },
      ];
      await fs.writeFile(
        path.join(testConfigPath, "settings.txt"),
        JSON.stringify(validSettings, null, 2),
      );

      const results = await checker.check(testThemePath);

      expect(results.success).toBe(true);
      expect(results.errors).toHaveLength(0);
    });

    it("should report error if settings.txt is not an array", async () => {
      const invalidSettings = { setting: "value" }; // Object instead of array
      await fs.writeFile(
        path.join(testConfigPath, "settings.txt"),
        JSON.stringify(invalidSettings),
      );

      const results = await checker.check(testThemePath);

      expect(results.success).toBe(false);
      expect(results.errors[0].message).toContain("must be a JSON array");
    });

    it("should warn about missing recommended fields in settings", async () => {
      const settingsWithMissingFields = [
        {
          // Missing id, type, label
          value: "something",
        },
      ];
      await fs.writeFile(
        path.join(testConfigPath, "settings.txt"),
        JSON.stringify(settingsWithMissingFields),
      );

      const results = await checker.check(testThemePath);

      expect(results.warnings.length).toBeGreaterThan(0);
      expect(
        results.warnings.some((w) =>
          w.message.includes("missing recommended field"),
        ),
      ).toBe(true);
    });

    it("should warn about unknown setting types", async () => {
      const settingsWithUnknownType = [
        {
          id: "test",
          type: "unknown_type", // Invalid type
          label: "Test",
        },
      ];
      await fs.writeFile(
        path.join(testConfigPath, "settings.txt"),
        JSON.stringify(settingsWithUnknownType),
      );

      const results = await checker.check(testThemePath);

      expect(
        results.warnings.some((w) => w.message.includes("unknown type")),
      ).toBe(true);
    });
  });

  describe("data.json/data.txt Validation", () => {
    it("should validate correct data.txt structure", async () => {
      const validData = {
        store_name: "My Store",
        store_url: "https://example.com",
      };
      await fs.writeFile(
        path.join(testConfigPath, "data.txt"),
        JSON.stringify(validData),
      );

      const results = await checker.check(testThemePath);

      expect(results.success).toBe(true);
    });

    it("should report error if data.txt is not an object", async () => {
      const invalidData = ["array", "instead", "of", "object"];
      await fs.writeFile(
        path.join(testConfigPath, "data.txt"),
        JSON.stringify(invalidData),
      );

      const results = await checker.check(testThemePath);

      expect(results.success).toBe(false);
      expect(results.errors[0].message).toContain("must be a JSON object");
    });
  });

  describe("Best Practices Validation", () => {
    it("should warn about very large files", async () => {
      // Create a large JSON object (>100KB)
      const largeData = {};
      for (let i = 0; i < 5000; i++) {
        largeData[`key_${i}`] = `value with some text to make it larger ${i}`;
      }
      await fs.writeFile(
        path.join(testConfigPath, "large.txt"),
        JSON.stringify(largeData),
      );

      const results = await checker.check(testThemePath);

      expect(
        results.warnings.some((w) => w.message.includes("very large")),
      ).toBe(true);
    });

    it("should warn about deeply nested objects", async () => {
      // Create deeply nested object (>5 levels)
      const deepNested = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: {
                    value: "too deep",
                  },
                },
              },
            },
          },
        },
      };
      await fs.writeFile(
        path.join(testConfigPath, "nested.txt"),
        JSON.stringify(deepNested),
      );

      const results = await checker.check(testThemePath);

      expect(
        results.warnings.some((w) => w.message.includes("deep nesting")),
      ).toBe(true);
    });
  });

  describe("Multiple Files Validation", () => {
    it("should validate multiple files and aggregate results", async () => {
      // Create valid settings.txt
      await fs.writeFile(
        path.join(testConfigPath, "settings.txt"),
        JSON.stringify([{ id: "test", type: "text", label: "Test" }]),
      );

      // Create valid data.json
      await fs.writeFile(
        path.join(testConfigPath, "data.json"),
        JSON.stringify({ key: "value" }),
      );

      // Create invalid file
      await fs.writeFile(
        path.join(testConfigPath, "invalid.txt"),
        "{ invalid json",
      );

      const results = await checker.check(testThemePath);

      expect(results.success).toBe(false); // One file has errors
      expect(results.errors).toHaveLength(1);
      expect(results.summary.totalErrors).toBe(1);
    });
  });

  describe("getMaxDepth", () => {
    it("should calculate correct depth for nested objects", () => {
      const flatObj = { a: 1, b: 2 };
      expect(checker.getMaxDepth(flatObj)).toBe(1);

      const nestedObj = { a: { b: { c: 1 } } };
      expect(checker.getMaxDepth(nestedObj)).toBe(3);

      const arrayObj = { a: [1, 2, { b: 3 }] };
      expect(checker.getMaxDepth(arrayObj)).toBe(3);
    });

    it("should handle primitive values", () => {
      expect(checker.getMaxDepth(null)).toBe(0);
      expect(checker.getMaxDepth("string")).toBe(0);
      expect(checker.getMaxDepth(123)).toBe(0);
    });
  });

  describe("getResults", () => {
    it("should return correct summary", () => {
      checker.errors = [
        { file: "test.txt", message: "Error 1" },
        { file: "test2.txt", message: "Error 2" },
      ];
      checker.warnings = [{ file: "test.txt", message: "Warning 1" }];

      const results = checker.getResults();

      expect(results.success).toBe(false);
      expect(results.summary.totalErrors).toBe(2);
      expect(results.summary.totalWarnings).toBe(1);
    });

    it("should return success when no errors", () => {
      checker.warnings = [{ file: "test.txt", message: "Warning" }];

      const results = checker.getResults();

      expect(results.success).toBe(true);
      expect(results.summary.totalErrors).toBe(0);
    });
  });
});
