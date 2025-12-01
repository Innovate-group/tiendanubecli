# Development Guide

This guide is for developers who want to contribute to this project or understand its internal architecture.

## Overview

This is a **refactored** Tienda Nube/Nuvemshop theme development tool that provides FTP synchronization capabilities with significant performance and architectural improvements. The codebase has been completely restructured following clean architecture principles.

**Technology Stack:**

- Node.js (ES Modules, requires >= 16.0.0)
- TypeScript: Strong typing and enhanced developer experience
- basic-ftp: FTP client for server operations
- chokidar: File system watcher for change detection
- dotenv: Environment configuration management
- commander: CLI framework
- inquirer: Interactive prompts

**Key Improvements:**

- **95% faster** operations through connection pooling
- Structured error handling with automatic retry logic
- Modular architecture with clear separation of concerns
- Comprehensive test coverage
- User-friendly CLI with interactive setup

## Getting Started

### Prerequisites

- Node.js >= 16.0.0
- Git
- npm or yarn

### Local Development Setup

1. **Clone the repository**

```bash
git clone https://github.com/Innovate-group/tiendanubecli.git
cd tiendanubecli
```

2. **Install dependencies**

```bash
npm install
```

3. **Create `.env` file**

Copy `.env.example` to `.env` and configure your FTP credentials:

```bash
cp .env.example .env
```

Edit `.env` with your test FTP server credentials.

4. **Build TypeScript files**

```bash
npm run build
```

This compiles TypeScript files from `lib/` and `bin/` to JavaScript in the `dist/` folder.

5. **Link CLI locally for testing**

```bash
npm link
```

Now you can use `tiendanube` command globally on your machine for testing.

6. **Run tests to verify setup**

```bash
npm test
```

### Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes to TypeScript files (`.ts` extension)
3. Build TypeScript: `npm run build`
4. Run tests: `npm test`
5. Run linter: `npm run lint`
6. Format code: `npm run format`
7. Commit changes with meaningful messages
8. Push and create a pull request

**TypeScript Development Tips:**

- Use `npm run build:watch` to automatically rebuild on file changes
- TypeScript will catch type errors during compilation
- All source files are in TypeScript (`.ts`), compiled output goes to `dist/`
- The `dist/` folder is gitignored and generated during build

## Development Commands

### TypeScript Build Commands

```bash
# Build TypeScript to JavaScript (output in dist/)
npm run build

# Build and watch for changes (auto-rebuild)
npm run build:watch

# Development mode with tsx (no build needed)
npm run dev

# Prepare for npm publish (runs build automatically)
npm run prepublishOnly
```

### Using the CLI (Recommended)

After running `npm link`, use the CLI directly:

```bash
# Interactive setup (creates .env file)
tiendanube init

# Start file monitoring and auto-sync to FTP
tiendanube watch

# Download entire theme from FTP server to local ./theme folder
tiendanube download

# Upload entire local theme to FTP server
tiendanube push

# Download a specific file from FTP server
tiendanube download-file <remote-path>

# Validate configuration files
tiendanube check

# Show help
tiendanube --help

# Show version
tiendanube --version
```

### Legacy npm Scripts (Still Supported)

```bash
# Start file monitoring and auto-sync to FTP (default mode)
npm start

# Download entire theme from FTP server to local ./theme folder
npm run download

# Upload entire local theme to FTP server
npm run push

# Download a specific file from FTP server
npm run download:file <remote-path>
```

## Testing

### Running Tests

```bash
# Run all tests (uses Jest with ES modules)
npm test

# Run tests in watch mode for development
npm run test:watch

# Generate test coverage report
npm run test:coverage
```

### Test Structure

Tests are located in `tests/` directory:

- `ftp-service.test.js`: FTP service operations
- `path-utils.test.js`: Path conversion utilities

### Writing Tests

**Testing Patterns:**

- Use Jest with ES modules (`--experimental-vm-modules`)
- Mock FTP connections using dependency injection
- Test both success and error paths
- Verify retry logic with multiple mock failures

Example test structure:

```javascript
import { jest } from '@jest/globals';
import FtpService from '../lib/ftp/service.js';

describe('FtpService', () => {
  let ftpService;
  let mockConnectionManager;

  beforeEach(() => {
    mockConnectionManager = {
      getConnection: jest.fn(),
      invalidateConnection: jest.fn()
    };
    ftpService = new FtpService(mockConnectionManager);
  });

  it('should upload file successfully', async () => {
    const mockClient = {
      uploadFrom: jest.fn().mockResolvedValue(undefined)
    };
    mockConnectionManager.getConnection.mockResolvedValue(mockClient);

    await ftpService.uploadFile('local/path', 'remote/path');

    expect(mockClient.uploadFrom).toHaveBeenCalledWith('local/path', 'remote/path');
  });
});
```

## Code Quality

### Linting and Formatting

```bash
# Lint code with ESLint
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format
```

### Code Style Guidelines

- **TypeScript**: All source code written in TypeScript with strict type checking
- **ES Modules**: Uses `import/export` syntax with `.js` extensions in imports
- **Indentation**: 2 spaces
- **Quotes**: Double quotes for strings
- **Semicolons**: Required
- **Console logs**: Allowed (necessary for CLI feedback)
- **Error handling**: Always use structured error classes
- **Async/await**: Preferred over promises
- **Type Safety**: Leverage TypeScript's type system:
  - Always define interfaces for complex objects
  - Use `readonly` for immutable properties
  - Avoid `any` type - use `unknown` and type guards instead
  - Use strict null checks (`strictNullChecks: true`)
  - Add proper JSDoc comments for public APIs

## Architecture

### Core Principles

The refactoring follows these architectural principles:

1. **Single Responsibility**: Each module has one clear purpose
2. **Dependency Injection**: Enables testing and flexibility
3. **Connection Pooling**: Reuses FTP connections for performance
4. **Structured Errors**: Custom error classes with retry classification
5. **Centralized Configuration**: Single source of truth for settings

### Module Structure

```
├── bin/
│   └── cli.ts                           # CLI entry point with Commander.js
├── lib/
│   ├── cli/
│   │   ├── interactive-setup.ts         # Interactive FTP setup (tiendanube init)
│   │   └── commands.ts                  # CLI command wrappers
│   ├── core/
│   │   ├── config.ts                    # Configuration management with strong types
│   │   └── file-watcher.ts              # File system monitoring
│   ├── ftp/
│   │   ├── connection-manager.ts        # Connection pooling with idle timeout
│   │   ├── service.ts                   # High-level FTP operations with retry
│   │   └── errors.ts                    # FTP error classes with type hierarchy
│   ├── validators/
│   │   └── config-checker.ts            # Configuration file validator
│   └── utils/
│       ├── logger.ts                    # Structured logging
│       └── path-utils.ts                # Path conversion utilities
├── dist/                                # Compiled JavaScript (gitignored)
│   ├── bin/                             # Compiled CLI entry
│   └── lib/                             # Compiled library code
└── tests/                               # Unit tests
```

**Note**: Source code is in TypeScript (`.ts` files). The `npm run build` command compiles to JavaScript in the `dist/` folder.

### Application Modes

**commands.ts** orchestrates four operational modes:

1. **Watch Mode** (default): Monitors `theme/` and automatically syncs to FTP
2. **Download Mode**: Downloads entire theme from FTP to local
3. **Push-All Mode**: Uploads entire local theme to FTP server
4. **Download-File Mode**: Downloads a specific file from FTP

> **Note**: The `commands.ts` file consolidates the functionality previously split between `app.js` and `commands.js`, eliminating code duplication.

## Core Components

### CLI Infrastructure

#### bin/cli.ts - CLI Entry Point

- Uses Commander.js for command parsing
- Defines all CLI commands (init, watch, download, push, download-file, check)
- Handles --help and --version flags automatically
- Provides user-friendly error messages
- Exits with appropriate exit codes (0 for success, 1 for errors)
- **TypeScript**: Strong typing for PackageJson interface and command handlers

#### lib/cli/interactive-setup.ts - Interactive Configuration

Implements `tiendanube init` command:

- Uses Inquirer.js for interactive prompts
- Validates FTP connection before saving credentials
- Creates `.env` file with user input
- Creates `theme/` folder if it doesn't exist
- Displays next steps after successful setup
- **TypeScript**: Typed interfaces for setup answers and FTP configuration

#### lib/cli/commands.ts - Command Wrappers

Exports functions for each CLI command:

- `runWatch()`: Watch mode with file monitoring
- `runDownload()`: Download entire theme
- `runPush()`: Upload entire theme
- `runDownloadFile(remotePath)`: Download specific file

All commands:
- Handle configuration validation
- Ensure theme folder exists before operations
- **TypeScript**: Full type safety with void return types and error handling

#### lib/validators/config-checker.ts - Configuration Validator

Implements `tiendanube check` command:

- Validates `.txt` files in `theme/config/` directory
- Checks for valid JSON syntax with line/column error reporting
- Validates `settings.txt` structure (must be array, required fields)
- Validates `data.json`/`data.txt` structure (must be object)
- Reports warnings for best practices (file size, nesting depth)
- Color-coded output for errors and warnings

### Connection Management (Critical)

#### lib/ftp/connection-manager.ts

Implements connection pooling with TypeScript:

- **Maintains a single persistent connection** (reused across operations)
- **Idle timeout**: Closes connection after 5 minutes of inactivity
- **Automatic reconnection**: Recreates connection when needed
- **Health monitoring**: Handles socket errors and reconnects
- **Performance**: Reduces overhead from 5-10s to <100ms per operation

**Key Methods:**

- `getConnection()`: Returns active connection (reuses or creates)
- `connect()`: Establishes new FTP connection
- `shutdown()`: Gracefully closes connection

**Usage Pattern:**

```javascript
// DO: Reuse connection through manager
const client = await ftpConnectionManager.getConnection();
await client.uploadFrom(local, remote);
// Connection stays open for next operation

// DON'T: Create new connections for each operation (old pattern)
const client = new Client();
await client.access({...});
await client.uploadFrom(local, remote);
client.close(); // Wasteful!
```

### FTP Service Layer

#### lib/ftp/service.ts

Provides high-level operations with strong typing:

- Wraps all FTP operations with retry logic
- Classifies errors as retryable or fatal
- Implements exponential backoff for retries
- Handles file validation and directory creation

**Key Methods:**

- `uploadFile(localPath, remotePath)`: Upload single file with auto-retry
- `uploadAll(localBasePath, remoteBasePath)`: Upload entire directory recursively
- `uploadDirectory(localPath, remotePath, themePath)`: Upload directory helper
- `deleteFile(remotePath)`: Delete with error handling
- `createDirectory(remotePath)`: Create dir if not exists
- `downloadFile(remotePath, localPath)`: Download single file
- `downloadAll(remotePath, localPath)`: Recursive download
- `downloadDirectory(remotePath, localPath, themePath)`: Download directory helper
- `executeOperation(operation, name, context)`: Generic retry wrapper

**Retry Logic:**

- Max retries: 2 (configurable in config.js)
- Exponential backoff: 1s, 2s, 4s (capped at 5s)
- Only retries on retryable errors (connection, timeout)
- Invalidates connection on retry to force reconnection

### Error Handling

#### lib/ftp/errors.ts

Defines custom error classes with TypeScript type hierarchy:

- `FtpError`: Base error class
- `FtpConnectionError`: Network issues (retryable)
- `FtpAuthenticationError`: Auth failures (not retryable)
- `FtpFileNotFoundError`: Missing files (not retryable)
- `FtpPermissionError`: Access denied (not retryable)
- `FtpTimeoutError`: Timeouts (retryable)

**Error Classification:**

The `classifyFtpError(error, context)` function automatically categorizes errors based on message patterns:

- ECONNREFUSED, ETIMEDOUT → ConnectionError
- "530", "login" → AuthenticationError
- "550", "not found" → FileNotFoundError

### File Watching

#### lib/core/file-watcher.ts

Monitors file system changes with type-safe event handlers:

- Uses chokidar for robust change detection
- Debounces writes (300ms stability threshold)
- Handles: add, change, unlink, addDir, unlinkDir
- Automatically syncs changes to FTP via FtpService
- Graceful error handling (logs but continues watching)

**Configuration** (config.js):

- `stabilityThreshold: 300`: Wait 300ms after write stops
- `pollInterval: 100`: Check every 100ms during write
- `ignoreInitial: true`: Don't re-upload existing files on start

### Path Utilities

#### lib/utils/path-utils.ts

Handles path conversions with TypeScript:

- `getRelativePath(fullPath)`: Extract path relative to theme folder
- `getRemotePath(localPath)`: Convert local → FTP path
- `getLocalPath(remotePath)`: Convert FTP → local path
- `normalizeRemotePath(path)`: Add FTP_BASE_PATH prefix
- `toPosix(path)`: Convert Windows paths to POSIX

**Important**: Always use PathUtils for path conversions to handle:

- FTP_BASE_PATH prefixing
- Windows vs Unix path separators
- Relative vs absolute paths

### Configuration

#### lib/core/config.ts

Centralizes all settings from .env with strong typing:

```javascript
config.ftp;        // FTP connection settings
config.local;      // Local paths (theme folder)
config.watcher;    // File watcher settings
config.connection; // Connection pooling settings
config.debug;      // Debug mode flag
```

**Environment Variables:**

- `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`: Credentials
- `FTP_PORT`, `FTP_SECURE`: Connection settings
- `FTP_BASE_PATH`: Remote base directory (default: "/")
- `FTP_TIMEOUT`: Connection timeout in ms (default: 30000)
- `DEBUG`: Enable verbose logging (default: false)

Use `validateConfig()` to ensure required variables are set.

### Logging

#### lib/utils/logger.ts

Provides structured logging with TypeScript:

```javascript
const logger = new Logger("ComponentName");
logger.success("Operation completed");
logger.error("Operation failed", errorDetails);
logger.info("Processing...");
logger.debug("Debug info"); // Only when DEBUG=true
```

**Emoji Prefixes:**

- ✅ Success
- ❌ Error
- ⚠️ Warning
- ℹ️ Info
- 🔍 Debug

## Performance

### Benchmarks

| Metric              | Before          | After           | Improvement       |
| ------------------- | --------------- | --------------- | ----------------- |
| Operation Time      | 5-10s           | <100ms          | **95% faster**    |
| Connection Overhead | Every operation | Reused          | **95% reduction** |
| Error Recovery      | None            | Automatic retry | **More reliable** |

### Performance Considerations

1. **Connection Reuse**: Never create new FTP clients directly; always use `ftpConnectionManager.getConnection()`
2. **Batch Operations**: Multiple file operations reuse the same connection
3. **Idle Timeout**: Connection closes after 5 minutes of inactivity to free resources
4. **Retry Budget**: Failed operations retry up to 2 times with exponential backoff

## Development Patterns

### Adding New FTP Operations

When adding new FTP operations:

1. Add method to `FtpService` class
2. Use `executeOperation()` wrapper for automatic retry
3. Provide operation name and context for logging
4. Let errors bubble up (don't catch unless specific handling needed)

Example:

```javascript
async renameFile(oldPath, newPath) {
  await this.executeOperation(
    async (client) => {
      await client.rename(oldPath, newPath);
      this.logger.success(`File renamed: ${oldPath} → ${newPath}`);
      return true;
    },
    `rename file ${oldPath}`,
    { filePath: oldPath }
  );
}
```

### Modifying Connection Behavior

Connection settings are in config.js:

- `idleTimeout`: How long to keep idle connection (default: 5 min)
- `maxRetries`: Max retry attempts (default: 2)
- `retryDelay`: Base delay for exponential backoff (default: 1000ms)

### Handling New Error Types

To add new error classification:

1. Add error class to lib/ftp/errors.js
2. Update `classifyFtpError()` with detection pattern
3. Set `isRetryable` property appropriately

Example (TypeScript):

```typescript
export class FtpQuotaExceededError extends FtpError {
  public override readonly isRetryable = false;

  constructor(message: string, context?: ErrorContext) {
    super(message, "QUOTA_EXCEEDED", context);
    this.name = "FtpQuotaExceededError";
  }
}

// In classifyFtpError():
if (message.includes("quota") || message.includes("552")) {
  return new FtpQuotaExceededError(error.message, context);
}
```

## Debugging

Enable debug mode in `.env`:

```env
DEBUG=true
```

This enables:

- Verbose FTP protocol logs
- Debug-level logger output
- Full error stack traces in console

**Using the debugger:**

```bash
# Run with Node inspector
node --inspect bin/cli.js watch

# Or use VS Code launch configuration
```

## Common Pitfalls

1. **Don't close connections manually**: Let the connection manager handle lifecycle
2. **Don't catch errors without re-throwing**: Let structured errors propagate
3. **Don't create direct FTP clients**: Always use FtpService or connectionManager
4. **Don't mix path separators**: Use PathUtils for all path operations
5. **Don't ignore .env.example**: It documents all available configuration options
6. **Don't use `console.log` for errors**: Use Logger class for structured logging

## Migration from Old Code

If you need to work with old code patterns:

**Old**: Direct client creation

```javascript
const client = await createFtpClient();
await client.uploadFrom(local, remote);
client.close();
```

**New**: Use FtpService

```javascript
const ftpService = new FtpService();
await ftpService.uploadFile(local, remote);
// Connection stays open automatically
```

## Theme Structure

The `theme/` directory follows Tienda Nube's standard structure:

```
theme/
├── config/          # Theme configuration files
│   ├── settings.txt # Main theme settings (JSON array)
│   └── data.json    # Theme data (JSON object)
├── layouts/         # Page layout templates (.tpl files)
├── templates/       # Page-specific templates
│   ├── home.tpl
│   ├── product.tpl
│   ├── cart.tpl
│   └── ...
├── snipplets/       # Reusable template components
└── static/          # Static assets
    ├── css/         # Stylesheets (SCSS templates)
    ├── js/          # JavaScript files
    └── images/      # Image assets
```

## Release Process

### Preparing a Release

1. **Update version in package.json**

```bash
npm version patch|minor|major
```

2. **Update CHANGELOG.md** with release notes

3. **Run tests and linting**

```bash
npm test
npm run lint
```

4. **Build if necessary** (not currently required)

5. **Commit version bump**

```bash
git add package.json CHANGELOG.md
git commit -m "chore: bump version to X.Y.Z"
```

6. **Create git tag**

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
```

7. **Push to GitHub**

```bash
git push origin main --tags
```

### Publishing to npm

1. **Login to npm**

```bash
npm login
```

2. **Publish package**

```bash
npm publish
```

3. **Verify publication**

```bash
npm view tiendanubecli
```

### Post-Release

1. Create GitHub release with changelog
2. Announce in relevant channels
3. Update documentation if needed

## Contributing Guidelines

### Pull Request Process

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes following code style guidelines
4. Add or update tests as needed
5. Ensure all tests pass
6. Update documentation if needed
7. Submit a pull request with clear description

### Commit Message Convention

Follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Test additions or changes
- `chore:` Build process or auxiliary tool changes

Example: `feat: add support for SFTP connections`

## Support

For questions or issues:

- Open an issue on [GitHub](https://github.com/Innovate-group/tiendanubecli/issues)
- Check existing documentation
- Review closed issues for similar problems

## License

MIT © [Innovate Group](https://github.com/Innovate-group)
