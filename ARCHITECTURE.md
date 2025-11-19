# PrepChef Architecture

This document describes the technical architecture of PrepChef, a RegTech platform for vendor verification in the commercial kitchen industry.

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Domain Models](#domain-models)
- [API Architecture](#api-architecture)
- [Background Processing](#background-processing)
- [Data Flow](#data-flow)
- [Security Architecture](#security-architecture)
- [Scalability](#scalability)
- [Technology Stack](#technology-stack)

## Overview

PrepChef is built as a multi-tenant SaaS platform with three core domains:

1. **Vendor Verification Core**: Automated compliance checking and monitoring
2. **Regulatory Intelligence**: Jurisdiction-aware requirement management
3. **Operator Console**: Dashboard and API for kitchen operators

### Key Architectural Principles

- **Multi-tenancy**: Complete data isolation per tenant
- **Event-driven**: Background jobs and webhook notifications
- **API-first**: All features accessible via REST API
- **Stateless**: Horizontal scalability for web tier
- **Microservice-ready**: Modular design for future decomposition

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
├──────────────────────┬──────────────────────────────────────┤
│   React SPA          │    Mobile App (Future)                │
│   - Login/Register   │    - Native iOS/Android               │
│   - Dashboard        │    - Vendor self-service              │
│   - Vendor Mgmt      │    - Document upload                  │
│   - Checklists       │                                       │
└──────────────────────┴──────────────────────────────────────┘
                             │
                    HTTPS / REST API
                             │
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway / Load Balancer              │
│                   (Rate Limiting, SSL Termination)           │
└─────────────────────────────────────────────────────────────┘
                             │
        ┌────────────────────┴────────────────────┐
        │                                         │
┌───────▼─────────┐                      ┌────────▼────────┐
│  Fastify Server │                      │  Fastify Server │
│  (HTTP API)     │◄────────────────────►│  (HTTP API)     │
│                 │    Session Sharing    │                 │
│  - Auth         │                      │  - Auth         │
│  - Vendors      │                      │  - Vendors      │
│  - Verification │                      │  - Verification │
│  - RegIntel     │                      │  - RegIntel     │
│  - Webhooks     │                      │  - Webhooks     │
└────────┬────────┘                      └────────┬────────┘
         │                                        │
         └────────────────┬───────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    ┌────▼────┐     ┌─────▼─────┐    ┌────▼────┐
    │ MongoDB │     │   Redis   │    │  Redis  │
    │ (Primary)│     │  (Cache)  │    │ (Queue) │
    │         │     │           │    │         │
    │- Vendors│     │- Sessions │    │- BullMQ │
    │- Users  │     │- Rate     │    │- Jobs   │
    │- Tenants│     │  Limits   │    │         │
    │- Juris- │     │           │    │         │
    │  diction│     │           │    │         │
    └─────────┘     └───────────┘    └────┬────┘
                                          │
                                          │
                              ┌───────────▼───────────┐
                              │  Background Workers   │
                              │                       │
                              │  - Verification       │
                              │  - Webhook Dispatch   │
                              │  - Reg Clearinghouse  │
                              └───────────────────────┘
```

### Component Breakdown

#### 1. Web Tier (Fastify Server)

**Purpose**: HTTP API endpoints and request handling

**Responsibilities**:
- Authentication & authorization
- Request validation (Zod schemas)
- Route handling
- Response formatting
- Rate limiting
- Error handling

**Scaling**: Horizontal (stateless instances behind load balancer)

#### 2. Data Tier (MongoDB)

**Purpose**: Persistent data storage

**Collections**:
- `users` - Operator accounts
- `tenants` - Organization/kitchen operator entities
- `kitchens` - Physical kitchen locations
- `vendors` - Food entrepreneur businesses
- `vendor_persons` - Vendor ownership information
- `vendor_documents` - Compliance documentation
- `verification_runs` - Verification history
- `jurisdictions` - Geographic regulatory entities
- `health_depts` - Health department contact info
- `reg_requirements` - Regulatory requirements (versioned)
- `reg_update_logs` - Regulatory change tracking
- `webhook_endpoints` - Webhook subscriptions
- `webhook_delivery_logs` - Delivery tracking
- `notifications` - User notifications

**Scaling**: MongoDB replica sets with sharding (by tenant_id)

#### 3. Cache Tier (Redis #1)

**Purpose**: Session storage and rate limiting

**Data**:
- User sessions
- Rate limit counters
- API key lookups
- Temporary tokens

**Scaling**: Redis Cluster with persistence

#### 4. Queue Tier (Redis #2 + BullMQ)

**Purpose**: Async job processing

**Queues**:
- `verification` - Vendor verification jobs
- `webhook-dispatch` - Webhook delivery jobs
- `reg-clearinghouse` - Regulatory update checks
- `notifications` - Email/SMS notifications

**Scaling**: Multiple worker processes across machines

#### 5. Worker Tier

**Purpose**: Background job execution

**Workers**:
- **Verification Worker**: Runs compliance checks
- **Webhook Worker**: Delivers webhook events
- **Clearinghouse Worker**: Polls regulatory sources
- **Notification Worker**: Sends emails/SMS (future)

**Scaling**: Horizontal (multiple worker processes)

## Domain Models

### Entity Relationship Diagram

```
┌─────────────┐
│   Tenant    │
│ (Kitchen    │
│  Operator)  │
└──────┬──────┘
       │
       │ 1:N
       │
   ┌───▼────┐
   │  User  │
   └────────┘
       │
       │ 1:N
       │
   ┌───▼────────┐        1:1        ┌──────────────┐
   │  Kitchen   │◄───────────────────┤ Jurisdiction │
   └───┬────────┘                    └──────┬───────┘
       │                                    │
       │ 1:N                                │ 1:N
       │                                    │
   ┌───▼────────┐                    ┌──────▼───────────┐
   │   Vendor   │                    │  RegRequirement  │
   └───┬────────┘                    └──────────────────┘
       │                                    │
       ├─────────┬──────────┬───────────────┘
       │ 1:N     │ 1:N      │ M:N (via verification)
       │         │          │
┌──────▼───┐ ┌──▼──────┐ ┌─▼───────────────┐
│ Vendor   │ │ Vendor  │ │ Verification    │
│ Person   │ │Document │ │     Run         │
└──────────┘ └─────────┘ └─────────────────┘
                                │
                                │ 1:N
                                │
                         ┌──────▼──────┐
                         │  Checklist  │
                         │    Item     │
                         └─────────────┘
```

### Core Entities

#### Tenant
**Purpose**: Multi-tenant isolation
**Key Fields**: name, type, api_keys[], settings
**Relationships**: 1:N Users, 1:N Kitchens, 1:N Webhooks

#### User
**Purpose**: Operator authentication
**Key Fields**: email, password_hash, role, tenant_id
**Auth**: JWT tokens with refresh mechanism

#### Kitchen
**Purpose**: Physical kitchen location
**Key Fields**: name, address, jurisdiction_id, type
**Business Logic**: Links vendors to jurisdictions

#### Vendor
**Purpose**: Food entrepreneur business entity
**Key Fields**: business_name, legal_entity_type, status
**Status Flow**: pending → verified/needs_review/rejected/expired

#### VerificationRun
**Purpose**: Compliance check execution
**Key Fields**: vendor_id, checklist, outcome, validation_errors
**Process**: Async job that evaluates vendor against requirements

#### Jurisdiction
**Purpose**: Geographic regulatory authority
**Key Fields**: type (country/state/county/city), code, parent_id
**Hierarchy**: Supports nested jurisdictions (US → CA → LA County)

#### RegRequirement
**Purpose**: Regulatory compliance rule
**Key Fields**: requirement_type, applies_to, frequency, version
**Versioning**: Tracks regulatory changes over time with effective dates

## API Architecture

### Authentication Flow

```
┌─────────┐                    ┌──────────┐
│ Client  │                    │  Server  │
└────┬────┘                    └────┬─────┘
     │                              │
     │  POST /auth/register         │
     ├─────────────────────────────►│
     │                              │ Create Tenant
     │                              │ Create User
     │                              │ Generate API Key
     │                              │
     │  ◄─────────────────────────┤│
     │  { user, tenant,             │
     │    access_token,             │
     │    refresh_token,            │
     │    api_key }                 │
     │                              │
     │  GET /vendors                │
     │  X-Prep-Api-Key: xxx         │
     │  Authorization: Bearer yyy   │
     ├─────────────────────────────►│
     │                              │ Verify API Key → Tenant
     │                              │ Verify JWT → User
     │                              │ Check Tenant Match
     │                              │
     │  ◄─────────────────────────┤│
     │  { vendors: [...] }          │
     │                              │
```

### Request Lifecycle

1. **Rate Limiting**: Check request count per API key/IP
2. **API Key Resolution**: Extract X-Prep-Api-Key → resolve tenant_id
3. **JWT Verification**: Extract Bearer token → verify & decode user
4. **Authorization**: Check user role + tenant match
5. **Validation**: Validate request body with Zod schema
6. **Business Logic**: Execute service layer code
7. **Response**: Format and return JSON

### Multi-Tenant Isolation

All vendor/kitchen/webhook queries include `tenant_id` filter:

```typescript
// Automatic tenant filtering
const vendors = await Vendor.find({
  tenant_id: req.tenant._id,  // From API key middleware
  status: 'verified'
});
```

## Background Processing

### Job Processing Architecture

```
┌──────────────┐         ┌──────────────┐
│   API Server │         │   Redis      │
└──────┬───────┘         │   (Queue)    │
       │                 └──────┬───────┘
       │ Enqueue Job            │
       └────────────────────────►
                                │
                   ┌────────────┴─────────────┐
                   │                          │
             ┌─────▼──────┐          ┌────────▼──────┐
             │  Worker 1  │          │   Worker 2    │
             │            │          │               │
             │ - Dequeue  │          │  - Dequeue    │
             │ - Process  │          │  - Process    │
             │ - Update   │          │  - Update     │
             │   Status   │          │    Status     │
             └────────────┘          └───────────────┘
```

### Verification Job Flow

```
1. API Call: POST /vendors/:id/verify
   └─► Create VerificationRun (status: pending)
   └─► Enqueue verification job

2. Worker picks up job
   └─► Update status: in_progress
   └─► Fetch vendor data
   └─► Fetch kitchen → jurisdiction
   └─► Fetch applicable requirements
   └─► Fetch vendor documents
   └─► Run verification rules engine
       │
       ├─► 100% complete → verified
       ├─► 80-99% complete → needs_review
       ├─► <80% complete → rejected
       └─► Expired docs → expired

3. Update Results
   └─► Save checklist items
   └─► Update vendor.status
   └─► Update vendor.last_verified_at
   └─► Mark run as completed

4. Trigger Webhooks
   └─► Enqueue webhook-dispatch jobs
   └─► Event: vendor.verified / vendor.needs_review / etc.
```

### Webhook Delivery Flow

```
1. Enqueue webhook job
   └─► Event type
   └─► Payload data
   └─► Target endpoints (filtered by events[])

2. For each endpoint:
   └─► Generate HMAC signature
   └─► POST to endpoint.url
       │
       ├─► Success (200-299) → Log delivery
       │
       └─► Failure → Retry with exponential backoff
           └─► Attempt 1: immediate
           └─► Attempt 2: +2 seconds
           └─► Attempt 3: +4 seconds
           └─► Attempt 4: +8 seconds
           └─► Attempt 5: +16 seconds
           │
           └─► After max retries → increment failure_count
               └─► If failure_count > 50 → disable endpoint
```

### Regulatory Clearinghouse Flow

```
Scheduled Job (Tri-daily: 8am, 12pm, 8pm PT)
└─► For each jurisdiction:
    └─► Poll regulatory sources (API/scraper)
    │
    ├─► No changes → Skip
    │
    └─► Changes detected:
        └─► Create RegUpdateLog
        └─► Update/create RegRequirement (new version)
        └─► Find affected vendors
            └─► For each vendor:
                └─► Enqueue verification job
                └─► Dispatch webhook: regulation.updated
```

## Data Flow

### Vendor Onboarding Flow

```
Operator                  API Server           Database          Worker
   │                          │                    │                │
   │ 1. Create Vendor         │                    │                │
   ├─────────────────────────►│                    │                │
   │                          │ 2. Save Vendor     │                │
   │                          ├───────────────────►│                │
   │                          │                    │                │
   │                          │ 3. Create Run      │                │
   │                          ├───────────────────►│                │
   │                          │                    │                │
   │                          │ 4. Enqueue Job     │                │
   │                          ├────────────────────┼───────────────►│
   │                          │                    │                │
   │ 5. Response (202)        │                    │                │
   │◄─────────────────────────┤                    │                │
   │                          │                    │   6. Process   │
   │                          │                    │      Job       │
   │                          │                    │◄───────────────┤
   │                          │   7. Update Status │                │
   │                          │◄───────────────────┤                │
   │                          │                    │                │
   │                          │ 8. Dispatch Webhook│                │
   │                          │◄───────────────────┤                │
   │                          │                    │                │
   │ 9. Webhook Notification  │                    │                │
   │◄─────────────────────────┤                    │                │
```

## Security Architecture

### Authentication & Authorization

**JWT Token Structure**:
```json
{
  "user_id": "507f1f77bcf86cd799439011",
  "email": "admin@kitchen.com",
  "role": "tenant_owner",
  "tenant_id": "507f191e810c19729de860ea",
  "token_version": 0,
  "iat": 1234567890,
  "exp": 1234571490
}
```

**Access Token**: 1 hour expiry, used for API requests
**Refresh Token**: 7 days expiry, used to get new access tokens
**Token Versioning**: `refresh_token_version` incremented on logout (invalidates all tokens)

### API Key Management

**Generation**: 32 bytes of entropy → Base64 encoded
**Storage**: SHA-256 hash (irreversible)
**Verification**: Hash incoming key → compare with stored hash
**Rotation**: Generate new key → revoke old key

### Webhook Security

**HMAC Signature**:
```typescript
const signature = crypto
  .createHmac('sha256', endpoint.secret)
  .update(JSON.stringify(payload))
  .digest('hex');

headers['X-Prep-Signature'] = signature;
```

**Verification** (Client-side):
```javascript
function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

### Input Validation

All API inputs validated with **Zod schemas**:

```typescript
const createVendorSchema = z.object({
  kitchen_id: z.string().uuid(),
  business_name: z.string().min(1).max(200),
  legal_entity_type: z.enum([
    'sole_proprietorship',
    'llc',
    'corporation',
    'partnership',
    'nonprofit'
  ]),
  // ... more fields
});

// Automatic validation in route handler
const validatedData = createVendorSchema.parse(request.body);
```

### Rate Limiting

**Per API Key**: 100 requests / 15 minutes
**Per IP (unauthenticated)**: 5 requests / 15 minutes
**Implementation**: Redis-backed counters with sliding window

## Scalability

### Horizontal Scaling

**Web Tier**:
- Stateless Fastify instances
- Load balanced (round-robin or least-connections)
- Session state in Redis (shared across instances)

**Worker Tier**:
- Multiple worker processes across machines
- BullMQ job distribution
- Independent scaling from web tier

### Database Scaling

**MongoDB Sharding**:
- Shard key: `tenant_id`
- Co-locate tenant data on same shard
- Indexes on `tenant_id + status/kitchen_id` for queries

**Replica Sets**:
- Primary + 2 Secondaries
- Read preference: primaryPreferred
- Automatic failover

### Caching Strategy

**Redis Cache**:
- API key lookups (5 min TTL)
- Jurisdiction hierarchy (1 hour TTL)
- Regulatory requirements (15 min TTL)
- Session data (token expiry TTL)

**Application-level**:
- In-memory LRU cache for frequently accessed data
- Invalidation on updates

### Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| API Response Time (p50) | < 100ms | Cached queries |
| API Response Time (p95) | < 500ms | Complex queries |
| API Response Time (p99) | < 1s | Verification trigger |
| Verification Job | < 10s | 90% of runs |
| Webhook Delivery | < 5s | First attempt |
| Database Query | < 50ms | Indexed lookups |

## Technology Stack

### Backend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Node.js | 20+ | JavaScript runtime |
| Language | TypeScript | 5.3 | Type safety |
| HTTP Framework | Fastify | 4.26 | Web server |
| Database | MongoDB | 8.1 | Document storage |
| ODM | Mongoose | 8.1 | Data modeling |
| Job Queue | BullMQ | 5.2 | Async processing |
| Cache/Queue | Redis | 7.2 | In-memory store |
| Validation | Zod | 3.22 | Schema validation |
| Logging | Pino | 8.19 | Structured logs |
| Auth | jsonwebtoken | 9.0 | JWT handling |
| Password | bcrypt | 5.1 | Hashing |

### Frontend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | React | 18 | UI library |
| Language | TypeScript | 5.3 | Type safety |
| Build Tool | Vite | 5 | Dev server + bundler |
| Styling | TailwindCSS | 3.4 | Utility-first CSS |
| Data Fetching | React Query | 5.20 | Server state |
| Routing | React Router | 6 | Client routing |
| Forms | React Hook Form | 7.50 | Form handling |
| HTTP Client | Axios | 1.6 | API requests |

### Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Containerization | Docker | Local dev |
| Orchestration | Docker Compose | Multi-container |
| Orchestration (Prod) | Kubernetes | Production deploy |
| CI/CD | GitHub Actions | Automation |
| Monitoring | Prometheus + Grafana | Metrics |
| Logging | ELK Stack | Log aggregation |
| APM | New Relic / DataDog | Performance monitoring |

## Deployment Architecture

### Development
```
docker-compose up
├─► MongoDB (port 27017)
├─► Redis (port 6379)
├─► Server (port 3000)
│   └─► tsx watch src/server.ts
├─► Worker (background)
│   └─► tsx watch src/jobs/worker.ts
└─► Client (port 5173)
    └─► vite dev
```

### Production (Kubernetes)
```
Namespace: prepchef
├─► Deployment: server (3 replicas)
│   └─► Service: server-service (ClusterIP)
│       └─► Ingress: prepchef-ingress (HTTPS)
├─► Deployment: worker (2 replicas)
├─► StatefulSet: mongodb (3 replicas)
│   └─► Service: mongodb-service (Headless)
│   └─► PersistentVolumeClaim: mongodb-data
├─► StatefulSet: redis (3 replicas)
│   └─► Service: redis-service (Headless)
└─► ConfigMap: app-config
└─► Secret: app-secrets
```

## Future Enhancements

### Microservices Decomposition

Potential service boundaries:
- **Auth Service**: User/tenant management
- **Vendor Service**: Vendor CRUD operations
- **Verification Service**: Compliance checking
- **RegIntel Service**: Regulatory data
- **Notification Service**: Email/SMS/push
- **Webhook Service**: Event dispatch

### Event Sourcing

Replace state-based verification with event log:
- VendorCreated
- DocumentUploaded
- VerificationStarted
- RequirementChecked
- VerificationCompleted
- StatusChanged

### CQRS (Command Query Responsibility Segregation)

Separate read/write models:
- **Write Model**: Commands update aggregate roots
- **Read Model**: Denormalized views for queries
- **Event Bus**: Sync read models via events

### GraphQL API

Add GraphQL layer for flexible querying:
- Batch operations
- Field-level authorization
- Real-time subscriptions
- Mobile-optimized queries

---

**Document Version**: 1.0
**Last Updated**: 2025-01-19
**Maintainer**: PrepChef Engineering Team
