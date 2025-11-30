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

    it("should report warning when no configuration files found", async () => {
      const results = await checker.check(testThemePath);

      expect(results.success).toBe(true); // No errors, just warnings
      expect(results.warnings).toHaveLength(1);
      expect(results.warnings[0].message).toContain(
        "No configuration files found in config directory"
      );
    });
  });

  describe("Tienda Nube File Validation", () => {
    it("should validate valid Tienda Nube .txt file with tabs", async () => {
      const validTiendaNubeContent = `Settings\n\tname = test_setting\n\ttype = text\n\tlabel = Test Setting`;
      await fs.writeFile(
        path.join(testConfigPath, "settings.txt"),
        validTiendaNubeContent
      );
      await fs.writeFile(
        path.join(testConfigPath, "defaults.txt"),
        "test_setting = default_value"
      );

      const results = await checker.check(testThemePath);

      expect(results.success).toBe(true);
      expect(results.errors).toHaveLength(0);
    });

    it("should report CRITICAL error for spaces instead of tabs", async () => {
      const contentWithSpaces = `Settings\n  name = test_setting`; // Using spaces
      await fs.writeFile(
        path.join(testConfigPath, "settings.txt"),
        contentWithSpaces
      );
      await fs.writeFile(
        path.join(testConfigPath, "defaults.txt"),
        "test_setting = default_value"
      );

      const results = await checker.check(testThemePath);

      expect(results.success).toBe(false);
      expect(results.errors.length).toBeGreaterThanOrEqual(1);
      const tabError = results.errors.find((e) =>
        e.message.includes("CRITICAL: Indentation must use tabs")
      );
      expect(tabError).toBeTruthy();
      expect(tabError.file).toBe("settings.txt");
      expect(tabError.line).toBe(2);
    });

    it("should detect duplicate name fields within file", async () => {
      const contentWithDuplicates = `Settings\n\tname = test_setting\n\ttype = text\n\nAnother Section\n\tname = test_setting`; // Duplicate name
      await fs.writeFile(
        path.join(testConfigPath, "settings.txt"),
        contentWithDuplicates
      );

      const results = await checker.check(testThemePath);

      expect(results.success).toBe(false);
      expect(
        results.errors.some((e) => e.message.includes("Duplicate name field"))
      ).toBe(true);
    });

    it("should detect names without defaults.txt correspondence", async () => {
      const settingsContent = `Settings\n\tname = missing_setting\n\ttype = text`;
      await fs.writeFile(
        path.join(testConfigPath, "settings.txt"),
        settingsContent
      );
      await fs.writeFile(
        path.join(testConfigPath, "defaults.txt"),
        "other_setting = value"
      ); // Different name

      const results = await checker.check(testThemePath);

      expect(results.success).toBe(false);
      expect(
        results.errors.some((e) =>
          e.message.includes("has no corresponding value in defaults.txt")
        )
      ).toBe(true);
    });
  });

  describe("JSON File Validation", () => {
    it("should validate valid JSON file (data.json)", async () => {
      const validJson = JSON.stringify({ key: "value" }, null, 2);
      await fs.writeFile(path.join(testConfigPath, "data.json"), validJson);

      const results = await checker.check(testThemePath);

      expect(results.success).toBe(true);
      expect(results.errors).toHaveLength(0);
    });

    it("should report error for invalid JSON syntax in .json files", async () => {
      const invalidJson = '{ "key": "value" '; // Missing closing brace
      await fs.writeFile(path.join(testConfigPath, "data.json"), invalidJson);

      const results = await checker.check(testThemePath);

      expect(results.success).toBe(false);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0].message).toContain("Invalid JSON syntax");
      expect(results.errors[0].file).toBe("data.json");
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
      await fs.writeFile(path.join(testConfigPath, "data.json"), invalidJson);

      const results = await checker.check(testThemePath);

      expect(results.success).toBe(false);
      const jsonError = results.errors.find((e) =>
        e.message.includes("Invalid JSON syntax")
      );
      expect(jsonError).toHaveProperty("line");
      expect(jsonError).toHaveProperty("column");
    });
  });

  describe("Tienda Nube settings.txt Validation", () => {
    it("should validate correct settings.txt structure with sections", async () => {
      const validSettings = `Header Settings\n\tname = logo\n\ttype = image\n\tlabel = Store Logo\n\nColors\n\tname = primary_color\n\ttype = color\n\tlabel = Primary Color`;
      await fs.writeFile(
        path.join(testConfigPath, "settings.txt"),
        validSettings
      );
      await fs.writeFile(
        path.join(testConfigPath, "defaults.txt"),
        "logo = default_logo.png\nprimary_color = #000000"
      );

      const results = await checker.check(testThemePath);

      expect(results.success).toBe(true);
      expect(results.errors).toHaveLength(0);
    });

    it("should warn if no main sections found in settings.txt", async () => {
      const settingsWithoutSections = `\tname = test\n\ttype = text`; // Only indented lines, no sections
      await fs.writeFile(
        path.join(testConfigPath, "settings.txt"),
        settingsWithoutSections
      );
      await fs.writeFile(
        path.join(testConfigPath, "defaults.txt"),
        "test = default_value"
      );

      const results = await checker.check(testThemePath);

      expect(
        results.warnings.some((w) =>
          w.message.includes("No main sections found")
        )
      ).toBe(true);
    });
  });

  describe("data.json Validation", () => {
    it("should validate correct data.json structure", async () => {
      const validData = {
        store_name: "My Store",
        store_url: "https://example.com",
      };
      await fs.writeFile(
        path.join(testConfigPath, "data.json"),
        JSON.stringify(validData)
      );

      const results = await checker.check(testThemePath);

      expect(results.success).toBe(true);
    });

    it("should report error if data.json is not an object", async () => {
      const invalidData = ["array", "instead", "of", "object"];
      await fs.writeFile(
        path.join(testConfigPath, "data.json"),
        JSON.stringify(invalidData)
      );

      const results = await checker.check(testThemePath);

      expect(results.success).toBe(false);
      expect(results.errors[0].message).toContain("must be a JSON object");
    });
  });

  describe("Best Practices Validation", () => {
    it("should warn about very large JSON files", async () => {
      // Create a large JSON object (>100KB)
      const largeData = {};
      for (let i = 0; i < 5000; i++) {
        largeData[`key_${i}`] = `value with some text to make it larger ${i}`;
      }
      await fs.writeFile(
        path.join(testConfigPath, "data.json"),
        JSON.stringify(largeData)
      );

      const results = await checker.check(testThemePath);

      expect(
        results.warnings.some((w) => w.message.includes("very large"))
      ).toBe(true);
    });

    it("should warn about very large .txt files", async () => {
      // Create a large Tienda Nube file (definitely >500KB)
      const baseContent =
        "This is a very long line of text that will be repeated many times to create a large file. ";
      let largeContent = "Settings\n";
      // Repeat to create ~600KB+ file
      for (let i = 0; i < 6000; i++) {
        largeContent += `\tname = setting_${i}\n\ttype = text\n\tlabel = ${baseContent}Setting ${i}\n\tdescription = ${baseContent}Description for ${i}\n\n`;
      }

      await fs.writeFile(path.join(testConfigPath, "large.txt"), largeContent);

      const results = await checker.check(testThemePath);

      expect(
        results.warnings.some((w) => w.message.includes("very large"))
      ).toBe(true);
    });

    it("should warn about deeply nested JSON objects", async () => {
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
        path.join(testConfigPath, "data.json"),
        JSON.stringify(deepNested)
      );

      const results = await checker.check(testThemePath);

      expect(
        results.warnings.some((w) => w.message.includes("deep nesting"))
      ).toBe(true);
    });

    it("should warn about excessive tab nesting in .txt files", async () => {
      // Create content with exactly 6 tabs (>5 threshold)
      const sixTabs = "\t\t\t\t\t\t";
      const deepContent = `Settings\n${sixTabs}name = too_deep\n${sixTabs}type = text`;
      await fs.writeFile(path.join(testConfigPath, "deep.txt"), deepContent);
      await fs.writeFile(
        path.join(testConfigPath, "defaults.txt"),
        "too_deep = value"
      );

      const results = await checker.check(testThemePath);

      expect(
        results.warnings.some((w) => w.message.includes("Excessive nesting"))
      ).toBe(true);
    });
  });

  describe("Multiple Files Validation", () => {
    it("should validate multiple files and aggregate results", async () => {
      // Create valid settings.txt
      await fs.writeFile(
        path.join(testConfigPath, "settings.txt"),
        "Header\n\tname = logo\n\ttype = image"
      );

      // Create corresponding defaults.txt
      await fs.writeFile(
        path.join(testConfigPath, "defaults.txt"),
        "logo = default.png"
      );

      // Create valid data.json
      await fs.writeFile(
        path.join(testConfigPath, "data.json"),
        JSON.stringify({ key: "value" })
      );

      // Create invalid file with tab indentation error
      await fs.writeFile(
        path.join(testConfigPath, "invalid.txt"),
        "Section\n  name = bad_indent" // Using spaces instead of tabs
      );

      const results = await checker.check(testThemePath);

      expect(results.success).toBe(false); // One file has errors
      expect(results.errors.length).toBeGreaterThan(0);
      expect(results.summary.totalErrors).toBeGreaterThan(0);
    });
  });

  describe("sections.txt Validation", () => {
    it("should require at least one section in sections.txt", async () => {
      const emptySections = "\tname = no_section\n\ttype = text"; // No main sections
      await fs.writeFile(
        path.join(testConfigPath, "sections.txt"),
        emptySections
      );

      const results = await checker.check(testThemePath);

      expect(
        results.errors.some((e) =>
          e.message.includes("At least one section is required")
        )
      ).toBe(true);
    });
  });

  describe("translations.txt Validation", () => {
    it("should warn about missing language translations", async () => {
      const incompleteTranslations = `welcome\n\tes "Bienvenido"\n\tpt "Bem-vindo"`; // Missing en, es_mx
      await fs.writeFile(
        path.join(testConfigPath, "translations.txt"),
        incompleteTranslations
      );

      const results = await checker.check(testThemePath);

      expect(
        results.warnings.some((w) =>
          w.message.includes("Missing translations for language: en")
        )
      ).toBe(true);
      expect(
        results.warnings.some((w) =>
          w.message.includes("Missing translations for language: es_mx")
        )
      ).toBe(true);
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
