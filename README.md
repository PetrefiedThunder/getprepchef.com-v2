# PrepChef

**Vendor Verification as a Service for Shared Kitchens**

PrepChef is a RegTech + marketplace platform that automates vendor compliance tracking for commercial and shared kitchen operators. Our core wedge is continuous, jurisdiction-aware verification that keeps food entrepreneurs compliant across multiple regulatory authorities.

## 🎯 Value Proposition

**For Kitchen Operators:**
- Automate vendor onboarding with real-time compliance verification
- Reduce liability risk with continuous monitoring of licenses and permits
- Scale operations without scaling compliance headcount
- One dashboard for all vendor compliance across all jurisdictions

**For Food Entrepreneurs:**
- Faster onboarding to commercial kitchens
- Clear checklist of requirements for any jurisdiction
- Automated reminders before permit expiration
- Portable compliance profile across kitchen networks

## 🏗️ Architecture

PrepChef is built as a multi-tenant SaaS platform with three core domains:

### 1. Vendor Verification Core
- Automated compliance evaluation against jurisdiction requirements
- Continuous monitoring with background job processing
- Webhook notifications for status changes
- Document management with expiration tracking

### 2. Regulatory Intelligence & Clearinghouse
- Jurisdiction hierarchy (Country → State → County → City)
- Versioned regulatory requirements with effective dates
- Tri-daily polling for regulatory updates (8am, 12pm, 8pm PT)
- Automatic re-verification on regulation changes

### 3. Operator Console & Public API
- Multi-tenant isolation via API keys
- RESTful API with JWT authentication
- Role-based access control (admin, tenant_owner, tenant_staff)
- Real-time metrics and verification history

## 🛠️ Tech Stack

**Backend:**
- Node.js 20+ with TypeScript 5.3
- Fastify 4.26 (HTTP framework)
- MongoDB 8.1 + Mongoose (database + ODM)
- BullMQ 5.2 + Redis 7.2 (job queues)
- Zod 3.22 (schema validation)
- Pino (structured logging)

**Frontend:**
- React 18 + TypeScript
- Vite 5 (build tool)
- TailwindCSS 3.4 (styling)
- React Query (data fetching)
- React Router 6 (routing)

**Infrastructure:**
- Docker + Docker Compose (local dev)
- Kubernetes manifests (production-ready)
- GitHub Actions (CI/CD)

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ and npm 10+
- Docker and Docker Compose
- Git

### 1. Clone and Install

```bash
git clone <repository-url>
cd getprepchef.com-v2

# Install backend dependencies
cd server
npm install

# Install frontend dependencies (when Phase 6 is complete)
cd ../client
npm install
```

### 2. Environment Setup

Create `server/.env`:

```bash
# Copy example environment file
cp server/.env.example server/.env

# Edit with your values
nano server/.env
```

**Minimum required environment variables:**

```env
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/prepchef

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_ACCESS_SECRET=your-access-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# Optional: Webhook settings
WEBHOOK_MAX_RETRIES=3
WEBHOOK_RETRY_DELAY_MS=2000
```

### 3. Start Infrastructure with Docker Compose

```bash
# Start MongoDB and Redis
docker-compose up -d

# Verify services are running
docker-compose ps
```

### 4. Seed the Database

```bash
cd server

# Seed regulatory data (jurisdictions, requirements, health depts)
npm run seed:regulations

# Seed demo data (tenant, users, kitchens, vendors)
npm run seed:demo

# Or run both
npm run seed:all
```

**Demo Credentials (output from seed script):**

```
Admin Email:    admin@kitchencollective-la.com
Admin Password: Admin1234!
API Key:        [Generated and displayed once - save this!]

Tenant:         Kitchen Collective LA
Kitchens:       2 (Downtown LA, Culver City)
Vendors:        4 (various statuses)
```

### 5. Start Development Servers

```bash
# Terminal 1: Start HTTP server
cd server
npm run dev
# Server runs on http://localhost:3000

# Terminal 2: Start background workers
cd server
npm run worker:watch
# Workers process verification, webhook, regulatory jobs

# Terminal 3: Start frontend (when Phase 6 is complete)
cd client
npm run dev
# UI runs on http://localhost:5173
```

### 6. Verify Installation

```bash
# Health check
curl http://localhost:3000/health

# API version info
curl http://localhost:3000/

# Login and get access token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@kitchencollective-la.com",
    "password": "Admin1234!"
  }'
```

## 📖 API Usage Examples

### Authentication

**Register a new tenant:**

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_name": "My Kitchen Collective",
    "tenant_type": "kitchen_operator",
    "contact_email": "owner@mykitchen.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "password": "SecurePass123!"
  }'
```

**Login:**

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@kitchencollective-la.com",
    "password": "Admin1234!"
  }'

# Response includes:
# - access_token (1 hour expiry)
# - refresh_token (7 days expiry)
# - user object
```

### Vendor Management (API Key Required)

**List vendors:**

```bash
curl http://localhost:3000/api/v1/vendors \
  -H "X-Prep-Api-Key: YOUR_API_KEY_HERE"

# With filters
curl "http://localhost:3000/api/v1/vendors?status=verified&kitchen_id=KITCHEN_ID" \
  -H "X-Prep-Api-Key: YOUR_API_KEY_HERE"
```

**Create a vendor:**

```bash
curl -X POST http://localhost:3000/api/v1/vendors \
  -H "X-Prep-Api-Key: YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "kitchen_id": "KITCHEN_ID_FROM_SEED",
    "business_name": "Amazing Street Tacos LLC",
    "legal_entity_type": "llc",
    "business_address": {
      "street": "123 Food Street",
      "city": "Los Angeles",
      "state": "CA",
      "zip": "90001",
      "country": "US"
    },
    "contact": {
      "email": "owner@amazingtacos.com",
      "phone": "+13105551234",
      "primary_contact_name": "Carlos Rodriguez"
    }
  }'
```

**Trigger vendor verification:**

```bash
curl -X POST http://localhost:3000/api/v1/vendors/VENDOR_ID/verify \
  -H "X-Prep-Api-Key: YOUR_API_KEY_HERE"

# This enqueues a background job that:
# 1. Fetches vendor data and documents
# 2. Retrieves jurisdiction requirements
# 3. Runs verification rules engine
# 4. Updates vendor status
# 5. Dispatches webhook notifications
```

**Get verification history:**

```bash
curl http://localhost:3000/api/v1/vendors/VENDOR_ID/verification-runs \
  -H "X-Prep-Api-Key: YOUR_API_KEY_HERE"
```

### Regulatory Intelligence

**Get compliance checklist:**

```bash
curl "http://localhost:3000/api/v1/checklists?state=CA&county=Los%20Angeles&kitchen_type=shared&entity_type=llc" \
  -H "X-Prep-Api-Key: YOUR_API_KEY_HERE"

# Returns:
# - All applicable requirements
# - Jurisdiction hierarchy
# - Requirement details (frequency, expiration rules, priority)
```

**List jurisdictions:**

```bash
curl "http://localhost:3000/api/v1/jurisdictions?coverage_status=full" \
  -H "X-Prep-Api-Key: YOUR_API_KEY_HERE"
```

**Get jurisdiction details:**

```bash
curl http://localhost:3000/api/v1/jurisdictions/JURISDICTION_ID \
  -H "X-Prep-Api-Key: YOUR_API_KEY_HERE"

# Returns:
# - Jurisdiction details
# - Full hierarchy (country → state → county → city)
# - All applicable requirements
# - Health department contact info
```

### Webhook Management

**Create webhook endpoint:**

```bash
curl -X POST http://localhost:3000/api/v1/webhooks \
  -H "X-Prep-Api-Key: YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks/prepchef",
    "events": [
      "vendor.verified",
      "vendor.expired",
      "vendor.needs_review",
      "regulation.updated"
    ],
    "headers": {
      "X-Custom-Header": "value"
    }
  }'

# Response includes:
# - endpoint_id
# - secret (for HMAC signature verification)
```

**Verify webhook signatures:**

```javascript
// In your webhook handler
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = hmac.digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Usage in Express/Fastify handler
app.post('/webhooks/prepchef', (req, res) => {
  const signature = req.headers['x-prep-signature'];
  const isValid = verifyWebhookSignature(req.body, signature, WEBHOOK_SECRET);

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  // Process webhook event
  const { event, data } = req.body;
  console.log(`Received ${event}:`, data);

  res.status(200).send('OK');
});
```

## 🧪 Testing & Development

### Run Tests

```bash
cd server
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Database Management

```bash
# Connect to MongoDB
docker exec -it prepchef-mongo mongosh prepchef

# View vendors
db.vendors.find().pretty()

# View verification runs
db.verification_runs.find().sort({ created_at: -1 }).limit(5).pretty()

# Check jurisdiction coverage
db.jurisdictions.aggregate([
  { $group: { _id: "$coverage_status", count: { $sum: 1 } } }
])
```

### Queue Monitoring

```bash
# Connect to Redis
docker exec -it prepchef-redis redis-cli

# List all keys
KEYS *

# View queue stats
LLEN bull:verification:wait
LLEN bull:verification:active
LLEN bull:verification:completed
LLEN bull:verification:failed

# View job data
HGETALL bull:verification:JOB_ID
```

### Debug Logging

```bash
# Enable debug logging
export LOG_LEVEL=debug

# Run server with debug output
npm run dev

# View worker logs
npm run worker:watch
```

## 🎬 Demo Scenarios

### Scenario 1: Onboard and Verify a New Vendor

**Via API:**

```bash
# 1. Create vendor
VENDOR_RESPONSE=$(curl -X POST http://localhost:3000/api/v1/vendors \
  -H "X-Prep-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "kitchen_id": "'$KITCHEN_ID'",
    "business_name": "Test Vendor LLC",
    "legal_entity_type": "llc",
    "business_address": {
      "street": "100 Test St",
      "city": "Los Angeles",
      "state": "CA",
      "zip": "90001",
      "country": "US"
    },
    "contact": {
      "email": "test@vendor.com",
      "phone": "+13105551111",
      "primary_contact_name": "Test Owner"
    }
  }')

VENDOR_ID=$(echo $VENDOR_RESPONSE | jq -r '.vendor._id')

# 2. Get compliance checklist
curl "http://localhost:3000/api/v1/checklists?state=CA&county=Los%20Angeles&kitchen_type=shared&entity_type=llc" \
  -H "X-Prep-Api-Key: $API_KEY"

# 3. Upload documents (implementation pending in Phase 6)
# POST /api/v1/vendors/$VENDOR_ID/documents

# 4. Trigger verification
curl -X POST http://localhost:3000/api/v1/vendors/$VENDOR_ID/verify \
  -H "X-Prep-Api-Key: $API_KEY"

# 5. Check verification status
sleep 3
curl http://localhost:3000/api/v1/vendors/$VENDOR_ID/verification-runs \
  -H "X-Prep-Api-Key: $API_KEY"

# 6. Get updated vendor status
curl http://localhost:3000/api/v1/vendors/$VENDOR_ID \
  -H "X-Prep-Api-Key: $API_KEY"
```

**Via UI (when Phase 6 is complete):**
1. Log in to operator console
2. Navigate to Vendors → Add Vendor
3. Fill in business details
4. Upload required documents
5. Click "Verify" button
6. Watch real-time status updates
7. Receive webhook notification

### Scenario 2: Simulate Regulatory Update

```bash
# 1. Get current LA County requirements
curl http://localhost:3000/api/v1/jurisdictions/LA_COUNTY_ID \
  -H "X-Prep-Api-Key: $API_KEY" \
  | jq '.requirements'

# 2. Manually trigger regulatory clearinghouse job
# (In production, this runs tri-daily automatically)
curl -X POST http://localhost:3000/api/v1/admin/jobs/trigger-clearinghouse \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 3. Watch worker logs for regulatory update detection
# Worker will:
# - Check for regulatory changes (10% simulation in MVP)
# - Create RegUpdateLog entries
# - Trigger re-verification for all affected vendors
# - Dispatch webhook notifications

# 4. Check verification stats
curl http://localhost:3000/api/v1/verification-stats \
  -H "X-Prep-Api-Key: $API_KEY"

# 5. View webhook deliveries
curl http://localhost:3000/api/v1/webhooks/WEBHOOK_ID/deliveries \
  -H "X-Prep-Api-Key: $API_KEY"
```

### Scenario 3: Multi-Kitchen Vendor Compliance

```bash
# Scenario: Vendor operates in multiple kitchens across jurisdictions

# 1. Create vendor in Downtown LA kitchen
VENDOR_LA=$(curl -X POST http://localhost:3000/api/v1/vendors \
  -H "X-Prep-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"kitchen_id": "'$LA_KITCHEN_ID'", "business_name": "Multi-Location Catering", ...}')

# 2. Create same vendor in SF kitchen (different jurisdiction)
VENDOR_SF=$(curl -X POST http://localhost:3000/api/v1/vendors \
  -H "X-Prep-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"kitchen_id": "'$SF_KITCHEN_ID'", "business_name": "Multi-Location Catering", ...}')

# 3. Compare requirements across jurisdictions
curl "http://localhost:3000/api/v1/checklists?jurisdiction_id=$LA_COUNTY_ID&kitchen_type=shared&entity_type=llc" \
  -H "X-Prep-Api-Key: $API_KEY" \
  > la_checklist.json

curl "http://localhost:3000/api/v1/checklists?jurisdiction_id=$SF_COUNTY_ID&kitchen_type=shared&entity_type=llc" \
  -H "X-Prep-Api-Key: $API_KEY" \
  > sf_checklist.json

diff la_checklist.json sf_checklist.json

# 4. Verify both instances
curl -X POST http://localhost:3000/api/v1/vendors/$VENDOR_LA_ID/verify \
  -H "X-Prep-Api-Key: $API_KEY"

curl -X POST http://localhost:3000/api/v1/vendors/$VENDOR_SF_ID/verify \
  -H "X-Prep-Api-Key: $API_KEY"

# 5. Compare verification outcomes
# Different jurisdictions = different requirements = different outcomes
```

## 📊 System Metrics

Access these endpoints to understand system health and usage:

```bash
# Health check
curl http://localhost:3000/health

# Verification statistics
curl http://localhost:3000/api/v1/verification-stats \
  -H "X-Prep-Api-Key: $API_KEY"

# Regulatory coverage stats
curl http://localhost:3000/api/v1/coverage-stats \
  -H "X-Prep-Api-Key: $API_KEY"
```

## 🏢 Production Deployment

### Environment Variables Checklist

```env
# Production settings
NODE_ENV=production
LOG_LEVEL=info

# Database with replica set
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/prepchef?retryWrites=true&w=majority

# Redis with TLS
REDIS_HOST=your-redis.cloud
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_TLS=true

# Strong JWT secrets (64+ chars)
JWT_ACCESS_SECRET=<64-char-random-string>
JWT_REFRESH_SECRET=<64-char-random-string>
JWT_ACCESS_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# CORS (production domains only)
CORS_ORIGIN=https://app.prepchef.com,https://api.prepchef.com

# Rate limiting (stricter in production)
RATE_LIMIT_MAX=100
RATE_LIMIT_TIME_WINDOW=900000

# Webhook reliability
WEBHOOK_MAX_RETRIES=5
WEBHOOK_TIMEOUT_MS=10000
WEBHOOK_DISABLE_THRESHOLD=50

# Optional: External services
SENDGRID_API_KEY=<for-email-notifications>
TWILIO_AUTH_TOKEN=<for-sms-notifications>
AWS_ACCESS_KEY_ID=<for-s3-document-storage>
AWS_SECRET_ACCESS_KEY=<for-s3-document-storage>
S3_BUCKET_NAME=prepchef-documents
```

### Docker Build

```bash
# Build production images
docker build -t prepchef-server:latest -f server/Dockerfile server/
docker build -t prepchef-client:latest -f client/Dockerfile client/

# Tag for registry
docker tag prepchef-server:latest your-registry.com/prepchef-server:v1.0.0
docker tag prepchef-client:latest your-registry.com/prepchef-client:v1.0.0

# Push to registry
docker push your-registry.com/prepchef-server:v1.0.0
docker push your-registry.com/prepchef-client:v1.0.0
```

### Kubernetes Deployment

```bash
# Apply configurations (when k8s manifests are complete)
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/server-deployment.yaml
kubectl apply -f k8s/worker-deployment.yaml
kubectl apply -f k8s/client-deployment.yaml
kubectl apply -f k8s/ingress.yaml

# Verify deployments
kubectl get pods -n prepchef
kubectl get services -n prepchef

# View logs
kubectl logs -f deployment/prepchef-server -n prepchef
kubectl logs -f deployment/prepchef-worker -n prepchef
```

## 🔐 Security Considerations

### API Key Management
- API keys are SHA-256 hashed before storage
- Keys are generated with 32 bytes of entropy
- Keys can be revoked and rotated without downtime
- Last used timestamp tracked for audit

### Password Security
- bcrypt hashing with 12 rounds (configurable)
- Minimum 8 characters with complexity requirements
- Password hashes never returned in API responses
- Refresh token versioning for session invalidation

### Webhook Security
- HMAC-SHA256 signatures on all webhook payloads
- TLS required for webhook endpoints in production
- Automatic endpoint disabling after repeated failures
- Configurable retry logic with exponential backoff

### Input Validation
- Zod schemas for all API inputs
- MongoDB injection prevention via Mongoose
- XSS prevention via output encoding
- Rate limiting on all public endpoints

### PII Handling
- Encryption placeholders for tax_id and SSN fields
- Structured logging excludes PII by default
- Document storage separated from metadata
- Audit trails for compliance

## 🗺️ Roadmap

### Phase 6: Frontend Operator Console (In Progress)
- [ ] Login/registration pages
- [ ] Dashboard with metrics
- [ ] Vendor management UI
- [ ] Document upload interface
- [ ] Regulatory map visualization
- [ ] Webhook configuration UI

### Phase 7: Documentation (Partial)
- [x] Seed scripts for demo data
- [x] Root README with quickstart
- [ ] OpenAPI/Swagger documentation
- [ ] Architecture diagrams
- [ ] Investor pitch deck

### Future Enhancements
- [ ] External regulatory API integrations
- [ ] Email/SMS notification delivery
- [ ] Advanced analytics and reporting
- [ ] Mobile app for food entrepreneurs
- [ ] Marketplace features (kitchen discovery, booking)
- [ ] Payment processing integration
- [ ] Multi-language support
- [ ] Compliance export (PDF reports)
- [ ] SSO/SAML integration for enterprise

## 🤝 Contributing

This is an MVP under active development. Contributions welcome!

### Development Workflow

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and test locally
3. Run linter: `npm run lint`
4. Run tests: `npm test`
5. Commit with conventional commits: `git commit -m "feat: add new feature"`
6. Push and create pull request

### Code Style

- TypeScript strict mode enabled
- ESLint + Prettier for formatting
- Conventional Commits for messages
- 100% test coverage goal for services

## 📄 License

[License details to be determined]

## 📞 Support

For questions, issues, or demos:
- GitHub Issues: [Repository URL]
- Email: team@prepchef.com
- Documentation: [Docs URL when available]

---

**Built with ❤️ for the food entrepreneur community**