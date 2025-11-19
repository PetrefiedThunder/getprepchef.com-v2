# Contributing to PrepChef

Thank you for your interest in contributing to PrepChef! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please be respectful and professional in all interactions.

### Our Standards

- **Be respectful**: Value diverse opinions and experiences
- **Be collaborative**: Work together toward common goals
- **Be constructive**: Provide helpful feedback
- **Be professional**: Keep interactions focused on the project

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20+ and npm 10+
- **Docker** and Docker Compose
- **Git**
- A code editor (we recommend VS Code)

### Initial Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/getprepchef.com-v2.git
   cd getprepchef.com-v2
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/prepchef/getprepchef.com-v2.git
   ```

4. **Install dependencies**:
   ```bash
   # Backend
   cd server
   npm install

   # Frontend
   cd ../client
   npm install
   ```

5. **Set up environment**:
   ```bash
   # Copy example env files
   cp server/.env.example server/.env
   cp client/.env.example client/.env

   # Edit with your local values
   nano server/.env
   ```

6. **Start infrastructure**:
   ```bash
   docker-compose up -d
   ```

7. **Seed database**:
   ```bash
   cd server
   npm run seed:all
   ```

8. **Start development servers**:
   ```bash
   # Terminal 1: Backend
   cd server
   npm run dev

   # Terminal 2: Workers
   cd server
   npm run worker:watch

   # Terminal 3: Frontend
   cd client
   npm run dev
   ```

9. **Verify setup**:
   - Backend: http://localhost:3000/health
   - Frontend: http://localhost:5173

## Development Workflow

### Branching Strategy

We use a feature branch workflow:

```
main                  # Production-ready code
  ├─ develop          # Integration branch
      ├─ feature/*    # New features
      ├─ fix/*        # Bug fixes
      ├─ docs/*       # Documentation updates
      └─ refactor/*   # Code refactoring
```

### Creating a Feature Branch

1. **Sync with upstream**:
   ```bash
   git checkout develop
   git pull upstream develop
   ```

2. **Create feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**:
   ```bash
   # Edit files
   # Test locally
   # Commit changes
   ```

4. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open pull request** on GitHub

### Keeping Your Branch Updated

```bash
# Fetch latest changes
git fetch upstream

# Rebase on develop
git checkout feature/your-feature-name
git rebase upstream/develop

# Resolve conflicts if any
# Then push (may need force push)
git push origin feature/your-feature-name --force-with-lease
```

## Coding Standards

### TypeScript

- **Strict mode enabled**: All TypeScript code must pass strict type checking
- **No `any` types**: Use proper types or `unknown` when type is truly dynamic
- **Explicit return types**: Always specify function return types
- **Interfaces over types**: Use interfaces for object shapes

**Example**:
```typescript
// ✅ Good
interface UserData {
  id: string;
  email: string;
  role: UserRole;
}

function getUser(id: string): Promise<UserData> {
  return User.findById(id);
}

// ❌ Bad
function getUser(id: any): any {
  return User.findById(id);
}
```

### Code Style

We use **ESLint** and **Prettier** for code formatting:

```bash
# Backend
cd server
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues

# Frontend
cd client
npm run lint        # Check for issues
```

**Key conventions**:
- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes for strings
- **Semicolons**: Required
- **Line length**: Max 100 characters (soft limit)
- **Trailing commas**: Always in multi-line objects/arrays

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `user-service.ts`, `vendor.model.ts` |
| Classes | PascalCase | `UserService`, `VendorModel` |
| Interfaces | PascalCase with I prefix (optional) | `IUser` or `User` |
| Functions | camelCase | `createVendor()`, `verifyToken()` |
| Variables | camelCase | `vendorId`, `isValid` |
| Constants | UPPER_SNAKE_CASE | `JWT_SECRET`, `MAX_RETRIES` |
| React Components | PascalCase | `LoginPage`, `VendorList` |
| Hooks | camelCase with `use` prefix | `useAuth()`, `useVendors()` |

### File Organization

**Backend**:
```
src/
├── modules/
│   └── vendors/
│       ├── vendor.model.ts        # Mongoose model
│       ├── vendor.service.ts      # Business logic
│       ├── vendor.routes.ts       # API routes
│       ├── vendor.schemas.ts      # Zod schemas
│       └── vendor.service.test.ts # Unit tests
├── middleware/                    # Shared middleware
├── utils/                         # Helper functions
└── config/                        # Configuration
```

**Frontend**:
```
src/
├── pages/                         # Route pages
│   └── vendors/
│       ├── VendorsPage.tsx
│       └── VendorDetailPage.tsx
├── components/                    # Reusable components
│   ├── layouts/
│   └── common/
├── lib/                          # Utilities
│   ├── api.ts
│   └── auth.ts
└── types/                        # TypeScript types
```

## Commit Guidelines

We follow **Conventional Commits** specification:

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, no logic change)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding/updating tests
- **chore**: Build process, dependencies, etc.

### Examples

```bash
# Feature
git commit -m "feat(vendors): add vendor verification status endpoint"

# Bug fix
git commit -m "fix(auth): prevent token refresh with expired refresh token"

# Documentation
git commit -m "docs(api): update webhook signature verification example"

# Breaking change
git commit -m "feat(api)!: change vendor status enum values

BREAKING CHANGE: Vendor status 'active' renamed to 'verified'"
```

### Commit Best Practices

- **One logical change per commit**: Don't mix unrelated changes
- **Write clear messages**: Explain what and why, not how
- **Reference issues**: Include `Fixes #123` or `Closes #456` in footer
- **Keep commits atomic**: Should be able to revert individually

## Pull Request Process

### Before Submitting

1. **Ensure tests pass**:
   ```bash
   cd server && npm test
   cd client && npm run build
   ```

2. **Run linters**:
   ```bash
   cd server && npm run lint
   cd client && npm run lint
   ```

3. **Update documentation** if needed

4. **Add/update tests** for new features

### PR Title

Use conventional commit format:
```
feat(vendors): add bulk vendor import feature
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally
```

### Review Process

1. **Automated checks** must pass (CI/CD)
2. **At least one approving review** required
3. **Address review feedback** promptly
4. **Squash commits** before merge (if requested)

### After Approval

Maintainers will merge your PR. Your contribution will be included in the next release!

## Testing Guidelines

### Unit Tests

- **Required for all services**: Auth, Vendor, Verification, etc.
- **Use Vitest/Jest**: Consistent test runner
- **Mock external dependencies**: Database, external APIs
- **Aim for >80% coverage**: Focus on critical paths

**Example**:
```typescript
describe('VendorService', () => {
  describe('createVendor', () => {
    it('should create a new vendor', async () => {
      // Arrange
      const mockVendor = { ... };
      vi.mocked(Vendor).mockImplementation(() => mockVendor);

      // Act
      const result = await VendorService.createVendor(tenantId, data);

      // Assert
      expect(result).toHaveProperty('_id');
      expect(mockVendor.save).toHaveBeenCalled();
    });

    it('should throw error if kitchen not found', async () => {
      // ...
    });
  });
});
```

### Integration Tests

- **Test API endpoints**: Full request/response cycle
- **Use test database**: Separate from development
- **Clean up after tests**: Reset database state

### Manual Testing

Before submitting PR:
1. Test feature in browser/Postman
2. Verify error handling
3. Check edge cases
4. Test on different screen sizes (frontend)

## Documentation

### Code Documentation

- **Document complex logic**: Add comments explaining why, not what
- **Use JSDoc for public APIs**:
  ```typescript
  /**
   * Triggers vendor verification process
   * @param vendorId - The vendor to verify
   * @returns Verification run object
   * @throws {NotFoundError} If vendor doesn't exist
   */
  async function triggerVerification(vendorId: string): Promise<VerificationRun>
  ```

### API Documentation

- **Update OpenAPI spec**: When adding/changing endpoints
- **Add examples**: Show request/response samples
- **Document errors**: List possible error responses

### README Updates

Update README.md when:
- Adding new dependencies
- Changing setup process
- Adding new npm scripts
- Modifying environment variables

## Project Structure Reference

### Backend Modules

| Module | Purpose |
|--------|---------|
| `auth` | User authentication, JWT tokens |
| `users` | User account management |
| `tenants` | Multi-tenant isolation |
| `kitchens` | Kitchen location management |
| `vendors` | Vendor CRUD operations |
| `verification` | Compliance verification logic |
| `regintel` | Regulatory intelligence data |
| `webhooks` | Webhook subscriptions |
| `jobs` | Background job workers |

### Key Files

- `server/swagger.yaml` - OpenAPI specification
- `ARCHITECTURE.md` - System architecture documentation
- `docker-compose.yml` - Local development setup
- `.github/workflows/ci.yml` - CI/CD pipeline

## Getting Help

### Resources

- **Documentation**: Check README.md and ARCHITECTURE.md
- **Issues**: Search existing GitHub issues
- **Discussions**: Use GitHub Discussions for questions
- **Architecture**: See ARCHITECTURE.md for system design

### Asking Questions

When asking for help:
1. **Search first**: Check if question already answered
2. **Provide context**: OS, Node version, error messages
3. **Include code**: Show what you've tried
4. **Be specific**: "X doesn't work" → "Getting Y error when doing X"

## Release Process

(For maintainers)

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create release branch: `release/v1.x.x`
4. Run full test suite
5. Create GitHub release with tag
6. Deploy to production
7. Merge release branch to main and develop

## License

By contributing to PrepChef, you agree that your contributions will be licensed under the project's license.

---

**Thank you for contributing to PrepChef!** 🎉

Every contribution, no matter how small, helps make PrepChef better for everyone.
