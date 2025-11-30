# Tienda Nube / Nuvemshop CLI

> FTP synchronization tool for **Tienda Nube** (Argentina/LATAM) and **Nuvemshop** (Brazil) theme development

[![npm version](https://img.shields.io/npm/v/tiendanubecli.svg)](https://www.npmjs.com/package/tiendanubecli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)

> ⚠️ **Unofficial Tool**: This is a community-developed tool and is NOT officially affiliated with, endorsed by, or supported by Tienda Nube or Nuvemshop. Use at your own discretion.

> ⚠️ **Herramienta No Oficial**: Esta es una herramienta desarrollada por la comunidad y NO está oficialmente afiliada, respaldada ni soportada por Tienda Nube o Nuvemshop. Úsela bajo su propia responsabilidad.

A modern CLI tool for **Tienda Nube** and **Nuvemshop** theme developers. Automate your workflow with real-time FTP synchronization, theme downloads/uploads, and configuration validation.

**🇦🇷 For Tienda Nube developers** | **🇧🇷 Para desenvolvedores Nuvemshop**

## Features

- **🚀 Fast Performance**: Optimized FTP operations with connection pooling
- **🔄 Auto-Sync**: Real-time file monitoring with automatic FTP synchronization
- **⚡ Interactive Setup**: Quick CLI-guided FTP configuration
- **📥 Download/Upload**: Full theme download or upload with a single command
- **✅ Config Validator**: Validate theme configuration files before deployment
- **🔁 Smart Retry**: Automatic retry logic for reliable file transfers
- **💻 Cross-Platform**: Works on Windows, macOS, and Linux

## Installation

Install globally to use `tiendanube` command anywhere:

```bash
npm install -g tiendanubecli
```

Or use locally in your project:

```bash
npm install --save-dev tiendanubecli
```

## Quick Start

### 1. Initialize Configuration

Run the interactive setup to configure your FTP connection:

```bash
tiendanube init
```

This will prompt you for:

- FTP Host (provided by Tienda Nube / Nuvemshop)
- FTP Username
- FTP Password
- FTP Port (default: 21)
- Secure connection (FTPS)
- Base path
- Connection timeout
- Debug mode

The wizard validates your connection and creates a `.env` file with your credentials.

### 2. Download Your Theme

Download your entire theme from the FTP server:

```bash
tiendanube download
```

### 3. Start Developing

Watch for file changes and auto-sync to FTP:

```bash
tiendanube watch
```

Now edit your theme files locally - changes are automatically uploaded to your store!

## Commands

### `tiendanube init`

Interactive setup wizard to configure FTP connection. Creates `.env` file and validates credentials.

```bash
tiendanube init
```

### `tiendanube watch`

Monitor `theme/` folder and automatically sync changes to FTP server.

```bash
tiendanube watch
```

This is the recommended mode for development. Any file you create, modify, or delete in the `theme/` folder will be automatically synchronized to your store.

### `tiendanube download`

Download entire theme from FTP server to local `theme/` folder.

```bash
tiendanube download
```

### `tiendanube push`

Upload entire local theme to FTP server.

```bash
tiendanube push
```

⚠️ **Warning**: This will overwrite all files on the FTP server with your local files.

### `tiendanube download-file <path>`

Download a specific file from FTP server.

```bash
tiendanube download-file config/settings.txt
tiendanube download-file templates/product.tpl
```

### `tiendanube check`

Validate theme configuration files (`.txt` files in `config/` folder).

```bash
tiendanube check
```

Checks for:

- Valid JSON syntax
- Required fields presence
- Correct data types
- Best practices compliance

### `tiendanube --help`

Display help information and all available commands.

```bash
tiendanube --help
```

### `tiendanube --version`

Display current version.

```bash
tiendanube --version
```

## Configuration

The `.env` file contains your FTP credentials. You can create this manually or use `tiendanube init` for interactive setup.

```env
# Tienda Nube / Nuvemshop FTP Configuration

FTP_HOST=your-ftp-host.com
FTP_USER=your-username
FTP_PASSWORD=your-password
FTP_PORT=21
FTP_SECURE=false
FTP_BASE_PATH=/
FTP_TIMEOUT=30000
DEBUG=false
```

**Configuration Options:**

- `FTP_HOST`: FTP server hostname (provided by Tienda Nube/Nuvemshop)
- `FTP_USER`: Your FTP username
- `FTP_PASSWORD`: Your FTP password
- `FTP_PORT`: FTP port (default: 21)
- `FTP_SECURE`: Use FTPS secure connection (true/false)
- `FTP_BASE_PATH`: Remote base directory (default: "/")
- `FTP_TIMEOUT`: Connection timeout in milliseconds (default: 30000)
- `DEBUG`: Enable verbose logging (true/false)

⚠️ **Security**: Never commit your `.env` file to version control. Add it to `.gitignore`.

## Theme Structure

The `theme/` directory follows Tienda Nube / Nuvemshop standard structure:

```
theme/
├── config/          # Theme configuration (settings.txt, data.json)
├── layouts/         # Page layouts (.tpl files)
├── templates/       # Page templates (home.tpl, product.tpl, cart.tpl, etc.)
├── snipplets/       # Reusable template components
└── static/          # Static assets
    ├── css/         # Stylesheets
    ├── js/          # JavaScript files
    └── images/      # Image assets
```

## Troubleshooting

### Connection Issues

- Verify FTP credentials in `.env`
- Check `FTP_SECURE` setting (some servers require `false`)
- Ensure firewall allows FTP connections (port 21 by default)
- Run `tiendanube init` to re-validate credentials

### Debug Mode

Enable detailed logging in `.env`:

```env
DEBUG=true
```

Or enable during `tiendanube init` setup. This will show detailed FTP protocol logs and help identify connection issues.

### Config Check Errors

Run `tiendanube check` to validate your configuration files:

```bash
tiendanube check
```

This will show specific errors with line and column numbers for easy debugging.

### Upload/Download Failures

The CLI includes automatic retry logic for transient errors. If operations fail repeatedly:

1. Check your internet connection
2. Verify FTP credentials are correct
3. Enable debug mode to see detailed error messages
4. Check if FTP server is accessible

## Requirements

- Node.js >= 16.0.0
- FTP access to Tienda Nube / Nuvemshop server

## About Tienda Nube / Nuvemshop

**Tienda Nube** (Argentina and LATAM) and **Nuvemshop** (Brazil) are leading e-commerce platforms in Latin America. This CLI tool helps theme developers streamline their workflow with automated FTP synchronization.

### For Nuvemshop Developers (Brazil)

Este CLI funciona perfeitamente com **Nuvemshop**. Use os mesmos comandos e configurações - a ferramenta funciona de forma idêntica para Tienda Nube e Nuvemshop.

### Disclaimer

This tool is **NOT** an official product of Tienda Nube or Nuvemshop. It is a community-developed tool created to help theme developers. For official tools and documentation, please visit:

- [Tienda Nube Developers](https://tiendanube.com/developers)
- [Nuvemshop Developers](https://www.nuvemshop.com.br/developers)

## Contributing

Contributions are welcome! For development setup, architecture details, and contribution guidelines, see [DEVELOPMENT.md](DEVELOPMENT.md).

## License

MIT © [Innovate Group](https://github.com/Innovate-group)

## Links

- [npm package](https://www.npmjs.com/package/tiendanubecli)
- [GitHub repository](https://github.com/Innovate-group/tiendanubecli)
- [Report issues](https://github.com/Innovate-group/tiendanubecli/issues)
- [Tienda Nube Documentation](https://dev.tiendanube.com/)
