# PrepChef Server

Backend API for PrepChef - Vendor Verification as a Service for shared kitchens.

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify 4
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Job Queue**: BullMQ with Redis
- **Authentication**: JWT (access + refresh tokens)
- **Validation**: Zod schemas
- **Logging**: Pino

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- MongoDB (or use Docker)
- Redis (or use Docker)

### Development Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start with Docker Compose** (recommended):
   ```bash
   docker-compose up -d
   ```

   This starts:
   - MongoDB on port 27017
   - Redis on port 6379
   - API server on port 3000

4. **Or run locally**:
   ```bash
   # Make sure MongoDB and Redis are running
   npm run dev
   ```

5. **Verify the server is running**:
   ```bash
   curl http://localhost:3000/health
   ```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report
- `npm run lint` - Lint code
- `npm run lint:fix` - Fix linting issues
- `npm run typecheck` - Type check without emitting
- `npm run seed:regulations` - Seed regulatory data
- `npm run seed:demo` - Seed demo vendors and tenants
- `npm run seed:all` - Seed all data

## Environment Variables

See `.env.example` for all available configuration options.

### Quick Start with Mock Credentials

The `.env.example` file includes **ready-to-use mock API keys and credentials** for demos and local development. Simply copy it to get started immediately:

```bash
cp .env.example .env
```

**Mock credentials included**:
- ✅ JWT access and refresh secrets (valid 64-char demo values)
- ✅ Webhook signing secret (valid 64-char demo value)
- ✅ SendGrid API key (mock value - email disabled by default)
- ✅ Twilio credentials (mock values - SMS disabled by default)
- ✅ AWS S3 credentials (mock values - uses local storage by default)

**For production**: Replace all mock values with real credentials. See comments in `.env.example` for guidance.

**Critical variables**:
- `MONGODB_URI` - MongoDB connection string
- `REDIS_HOST` / `REDIS_PORT` - Redis connection
- `JWT_ACCESS_SECRET` - Secret for JWT access tokens (min 32 chars)
- `JWT_REFRESH_SECRET` - Secret for JWT refresh tokens (min 32 chars)
- `WEBHOOK_SIGNING_SECRET` - Secret for webhook signature validation (min 32 chars)

## API Endpoints

### Health & Status
- `GET /` - API info
- `GET /health` - Health check (with DB status)
- `GET /ready` - Readiness probe (Kubernetes)
- `GET /live` - Liveness probe (Kubernetes)

### Authentication (Phase 5)
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout

### Vendors (Phase 3-5)
- `GET /api/v1/vendors` - List vendors
- `POST /api/v1/vendors` - Create vendor
- `GET /api/v1/vendors/:id` - Get vendor
- `PATCH /api/v1/vendors/:id` - Update vendor
- `POST /api/v1/vendors/:id/verify` - Trigger verification

_Full API documentation will be available at `/docs` (OpenAPI/Swagger)_

## Project Structure

```
server/
├── src/
│   ├── app.ts                 # Fastify app setup
│   ├── server.ts              # Entry point
│   ├── config/                # Configuration
│   ├── db/                    # Database connection & seeds
│   ├── lib/                   # Utilities (logger, crypto, validators)
│   ├── middleware/            # Express/Fastify middleware
│   ├── modules/               # Domain modules (vendors, auth, etc.)
│   └── jobs/                  # Background job workers
├── test/                      # Integration tests
├── Dockerfile                 # Production Docker image
├── Dockerfile.dev             # Development Docker image
└── docker-compose.yml         # Local stack orchestration
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

## Docker

### Development (with hot reload)
```bash
docker-compose --profile dev up
```

### Production Build
```bash
docker build -t prepchef-server .
docker run -p 3000:3000 prepchef-server
```

## Deployment

The application is designed to run on Kubernetes. See `/k8s` directory for manifests.

## Contributing

1. Create a feature branch
2. Make your changes
3. Add tests
4. Run `npm run lint` and `npm test`
5. Submit PR

## License

UNLICENSED - Proprietary
