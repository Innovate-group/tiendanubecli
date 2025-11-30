#!/usr/bin/env node

import { Command } from "commander";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import chalk from "chalk";

// Get package.json for version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
);

// Import CLI modules
import { runInteractiveSetup } from "../lib/cli/interactive-setup.js";
import {
  runWatch,
  runDownload,
  runPush,
  runDownloadFile,
} from "../lib/cli/commands.js";
import { runConfigCheck } from "../lib/validators/config-checker.js";

const program = new Command();

// Configure CLI
program
  .name("tiendanube")
  .description(
    "CLI tool for Tienda Nube / Nuvemshop theme development with FTP synchronization",
  )
  .version(packageJson.version);

// Init command - Interactive FTP configuration
program
  .command("init")
  .description("Interactive setup to configure FTP connection")
  .action(async () => {
    try {
      await runInteractiveSetup();
    } catch (error) {
      console.error(chalk.red("\n❌ Setup failed:", error.message));
      process.exit(1);
    }
  });

// Watch command - Monitor and auto-sync files
program
  .command("watch")
  .description("Watch theme folder and automatically sync changes to FTP")
  .action(async () => {
    try {
      await runWatch();
    } catch (error) {
      console.error(chalk.red("\n❌ Watch mode failed:", error.message));
      process.exit(1);
    }
  });

// Download command - Download entire theme
program
  .command("download")
  .description("Download entire theme from FTP server to local theme folder")
  .action(async () => {
    try {
      await runDownload();
    } catch (error) {
      console.error(chalk.red("\n❌ Download failed:", error.message));
      process.exit(1);
    }
  });

// Push command - Upload entire theme
program
  .command("push")
  .description("Upload entire local theme to FTP server")
  .action(async () => {
    try {
      await runPush();
    } catch (error) {
      console.error(chalk.red("\n❌ Push failed:", error.message));
      process.exit(1);
    }
  });

// Download-file command - Download specific file
program
  .command("download-file <remotePath>")
  .description("Download a specific file from FTP server")
  .action(async (remotePath) => {
    try {
      await runDownloadFile(remotePath);
    } catch (error) {
      console.error(chalk.red("\n❌ Download file failed:", error.message));
      process.exit(1);
    }
  });

// Check command - Validate config files
program
  .command("check")
  .description(
    "Validate theme configuration files (.txt files in config folder)",
  )
  .action(async () => {
    try {
      const success = await runConfigCheck();
      process.exit(success ? 0 : 1);
    } catch (error) {
      console.error(chalk.red("\n❌ Config check failed:", error.message));
      process.exit(1);
    }
  });

// Display help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

// Parse commands
program.parse(process.argv);
