# 🗺️ TiendaNube CLI Roadmap

This document outlines the planned features for TiendaNube CLI. Our goal is to make theme development for Tienda Nube and Nuvemshop more efficient and professional.

## 🎯 Current Version: v1.1.0

✅ **Enhanced ConfigChecker with Tienda Nube specific validations**  
✅ **Real-time FTP synchronization**  
✅ **Interactive setup wizard**  
✅ **Complete theme management**

---

## 🚀 Planned Features

### 📋 **v1.2.0 - Multi-Environment Support** (Q1 2026)

#### **🔄 Dual FTP Connection**

- **Test and Production Environments**: Configuration of two simultaneous FTP connections
- **Test → Production Workflow**: Download from Test store, local development, upload to Production
- **Specific commands**:
  ```bash
  tiendanube init --env test     # Configure test environment
  tiendanube init --env prod     # Configure production environment
  tiendanube download --from test    # Download from Test
  tiendanube push --to prod          # Upload to Production
  tiendanube sync test prod          # Sync Test → Production
  ```
- **Pre-deployment validation**: Automatic comparison before deployment
- **Safe rollback**: Ability to revert changes in Production

#### **📊 Configuration Management**

- **Connection profiles**: Save multiple FTP configurations
- **Quick switching**: Instant switching between environments
- **Cross validation**: Verify compatibility between environments

---

### 📋 **v1.3.0 - CI/CD Integration** (Q1 2026)

#### **🤖 GitHub Actions Automation**

- **Professional workflow**: Complete deployment automation
- **Suggested pipeline**:
  1. **Develop** → FTP Test (automatic on push)
  2. **Pull Request** → Validation and testing
  3. **Main merge** → Production deployment (automatic)
- **GitHub Actions Templates**:

  ```yaml
  # .github/workflows/deploy-test.yml
  name: Deploy to Test Environment
  on:
    push:
      branches: [ develop, feature/* ]

  # .github/workflows/deploy-prod.yml
  name: Deploy to Production
  on:
    push:
      branches: [ main ]
  ```

#### **🔧 CI/CD Commands**

- **Setup automation**: `tiendanube setup-actions` to generate workflows
- **Environment secrets**: Secure FTP credentials management in GitHub
- **Deploy status**: Track deployment status
- **Notifications**: Slack/Discord/email deployment notifications

#### **✅ Quality Gates**

- **Pre-deployment validation**: Automatic ConfigChecker before upload
- **Testing automation**: Automated tests in pipeline
- **Approval workflows**: Require approval for production

---

### 📋 **v1.4.0 - Modular Configuration** (Q1 2026)

#### **🧩 .txt Files Compiler**

- **Modular configuration**: Split `settings.txt` into multiple files per section
- **Proposed structure**:
  ```
  config/
  ├── sections/
  │   ├── header.txt          # Header configuration
  │   ├── footer.txt          # Footer configuration
  │   ├── colors.txt          # Color scheme
  │   ├── typography.txt      # Font configuration
  │   └── products.txt        # Product configuration
  ├── compiled/
  │   └── settings.txt        # Final compiled file
  └── defaults.txt            # Default values
  ```

#### **🔨 Compiler Commands**

- **Compilation**: `tiendanube compile` to generate final settings.txt
- **Watch mode**: `tiendanube compile --watch` for automatic recompilation
- **Modular validation**: Verify each section individually
- **Hot reload**: Instant updates in development

#### **📝 Modularization Benefits**

- **Improved organization**: Each developer can work on a section
- **Reduced merge conflicts**: Fewer Git conflicts
- **Reusability**: Share sections between projects
- **Simplified maintenance**: Edit only the necessary section

---

### 📋 **v1.5.0 - Twig Development Tools** (Q1 2026)

#### **🎨 Twig Validations**

- **Syntax validation**: Twig syntax verification in .tpl files
- **Variable tracking**: Detection of undefined variables
- **Filter validation**: Verify valid Twig filters for Tienda Nube
- **Performance hints**: Template optimization suggestions

#### **🛠️ Twig Development Tools**

- **Autocomplete**: Suggestions for available variables and filters
- **Template linting**: Best practices rules for .tpl files
- **Documentation integration**: Quick access to Twig/Tienda Nube docs
- **Debugging helpers**: Tools for template debugging

#### **📋 Twig Commands**

```bash
tiendanube twig check           # Validate all templates
tiendanube twig lint            # Best practices linting
tiendanube twig variables       # List available variables
tiendanube twig optimize        # Optimization suggestions
```

#### **🧪 Template Testing**

- **Template testing**: Framework to test template output
- **Data mocking**: Generate test data for templates
- **Visual regression**: Detect visual changes
- **Performance profiling**: Measure rendering time

---

## 💡 **How to Contribute Ideas**

We value community ideas!

1. **GitHub Issues**: Create issue with `enhancement` label
2. **Discussions**: Participate in GitHub Discussions
3. **Pull Requests**: Implement features yourself!

### **Feature Request Template**

```markdown
**Feature**: Brief description
**Problem**: What problem does this solve?
**Solution**: How should it work?
**Alternatives**: Other ways to solve this
**Impact**: Who would benefit from this?
```

## 📞 **Stay Updated**

- **Watch this repo** for release notifications
- **Follow our npm package** for version updates
- **Join discussions** for feature previews
- **Check releases** for changelog details

---

_Last updated: November 30, 2025_  
_Next review: December 30, 2025_

## 📝 **Important Note**

This roadmap is subject to change based on:

- Community feedback and requests
- Platform updates from Tienda Nube/Nuvemshop
- Technical constraints and opportunities
- Resource availability

**Have an idea not listed here?** [Create an issue](https://github.com/Innovate-group/tiendanubecli/issues/new) and let's discuss it! 🚀
