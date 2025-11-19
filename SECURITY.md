# Security Policy

## Reporting Security Vulnerabilities

**DO NOT** open public issues for security vulnerabilities.

Instead, please report security issues to: **security@prepchef.com**

We will respond within 48 hours and work with you to understand and address the issue.

## Security Measures

### Authentication & Authorization

#### JWT Tokens
- **Access Tokens**: 1 hour expiry, HS256 algorithm
- **Refresh Tokens**: 7 days expiry with version tracking
- **Token Storage**: Refresh tokens stored server-side with version number
- **Invalidation**: Instant token revocation via version increment

#### API Keys
- **Generation**: 32 bytes cryptographically random (crypto.randomBytes)
- **Storage**: SHA-256 hashed (irreversible)
- **Transmission**: HTTPS only in production
- **Rotation**: Supported without downtime

#### Password Security
- **Hashing**: bcrypt with 12 rounds (configurable)
- **Requirements**: Minimum 8 characters, uppercase, lowercase, number
- **Storage**: Never stored in plain text
- **Transmission**: HTTPS only

### Input Validation

#### Request Validation
- **Schema Validation**: Zod schemas for all API inputs
- **Type Checking**: TypeScript strict mode
- **Sanitization**: Automatic escaping of user input
- **Size Limits**: Request body size limited to 10MB

#### SQL/NoSQL Injection Prevention
- **Mongoose**: Parameterized queries only
- **No Raw Queries**: All queries use Mongoose ODM
- **Input Filtering**: Special characters escaped

#### XSS Prevention
- **Output Encoding**: All user content encoded before rendering
- **Content Security Policy**: Helmet.js CSP headers
- **No eval()**: No dynamic code execution
- **React**: Automatic XSS protection in JSX

### Rate Limiting

#### API Endpoints
- **Authentication**: 5 requests per 15 minutes per IP
- **General API**: 100 requests per 15 minutes per API key
- **Webhook Creation**: 10 requests per hour per tenant
- **Implementation**: Redis-backed sliding window

#### DDoS Protection
- **Request Timeout**: 30 seconds
- **Connection Pooling**: Limited connections per IP
- **Load Balancer**: Rate limiting at ingress level (production)

### Data Protection

#### Encryption at Rest
- **Database**: MongoDB encryption at rest (production)
- **PII Fields**: Additional encryption for tax_id, SSN
- **Backups**: Encrypted backups with separate keys

#### Encryption in Transit
- **HTTPS**: TLS 1.3 only in production
- **Certificate**: Let's Encrypt with auto-renewal
- **HSTS**: Strict-Transport-Security headers

#### PII Handling
- **Logging**: PII excluded from logs
- **Storage**: Minimal PII stored
- **Access**: RBAC for PII access
- **Retention**: 90-day deletion policy for inactive accounts

### Webhook Security

#### HMAC Signatures
- **Algorithm**: HMAC-SHA256
- **Secret**: 32-byte random per endpoint
- **Verification**: Required for all webhook payloads
- **Header**: X-Prep-Signature

```javascript
// Verification example
const crypto = require('crypto');
const signature = req.headers['x-prep-signature'];
const expectedSig = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(req.body))
  .digest('hex');

if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
  throw new Error('Invalid signature');
}
```

#### Webhook Endpoints
- **HTTPS Required**: No HTTP endpoints allowed
- **Timeout**: 10 seconds max
- **Retry Logic**: Exponential backoff with max 5 attempts
- **Auto-Disable**: After 50 consecutive failures

### Dependency Management

#### NPM Audit
- **Automated**: GitHub Actions runs `npm audit` on every PR
- **Policy**: No high/critical vulnerabilities allowed
- **Updates**: Weekly dependency updates via Dependabot

#### License Compliance
- **Allowed**: MIT, Apache-2.0, BSD-3-Clause
- **Prohibited**: GPL, AGPL (copyleft)
- **Tracking**: license-checker in CI/CD

### Infrastructure Security

#### Docker
- **Base Images**: Official Node.js slim images
- **Updates**: Monthly base image updates
- **Scanning**: Trivy security scanner in CI/CD
- **User**: Non-root user in containers

#### Kubernetes
- **RBAC**: Role-based access control enabled
- **Network Policies**: Pod-to-pod traffic restricted
- **Secrets**: Kubernetes secrets for sensitive data
- **Pod Security**: SecurityContext with minimal privileges

#### Database
- **Authentication**: Username/password + IP whitelist
- **Encryption**: TLS for MongoDB connections
- **Backups**: Daily encrypted backups to S3
- **Access**: Bastion host for production access

#### Redis
- **Authentication**: RequirePass enabled
- **Network**: Internal network only
- **Persistence**: AOF + RDB for durability
- **Encryption**: TLS in production

### Logging & Monitoring

#### Security Logs
- **Failed Logins**: Logged with IP address
- **API Key Usage**: Last used timestamp
- **Rate Limit Hits**: Logged for analysis
- **Database Queries**: Slow query log enabled

#### Alerting
- **Failed Logins**: Alert after 5 failed attempts
- **API Errors**: Alert on 5xx error spike
- **Database**: Alert on high query time
- **Infrastructure**: Alert on high CPU/memory

### Compliance

#### GDPR
- **Data Portability**: Export user data via API
- **Right to Deletion**: Account deletion endpoint
- **Consent**: Explicit consent for data processing
- **Privacy Policy**: Clear data usage documentation

#### SOC 2 (Planned)
- **Access Control**: Documented RBAC policies
- **Audit Logs**: Immutable audit trail
- **Encryption**: All data encrypted in transit and at rest
- **Incident Response**: Documented incident response plan

## Security Best Practices for Development

### Code Review
- **Required**: All code changes require review
- **Security Focus**: Reviewers check for security issues
- **Automated**: ESLint security plugin catches common issues
- **Training**: Team trained on OWASP Top 10

### Testing
- **Unit Tests**: Security-critical functions tested
- **Integration Tests**: Auth flows tested end-to-end
- **Penetration Testing**: Annual third-party pentest
- **Bug Bounty**: Planned for post-Series A

### Secrets Management
- **Never Commit**: Secrets never in git repository
- **Environment Variables**: All secrets in .env files
- **Production**: AWS Secrets Manager or similar
- **Rotation**: Quarterly secret rotation policy

### Secure Development
- **Branches**: Feature branches with PR reviews
- **Signing**: Git commits signed (GPG)
- **2FA**: GitHub 2FA required for all developers
- **SSH Keys**: Password-protected SSH keys

## Vulnerability Disclosure Timeline

1. **Report Received**: Acknowledge within 48 hours
2. **Triage**: Assess severity within 5 days
3. **Fix**: Critical issues patched within 7 days
4. **Release**: Security release with changelog
5. **Disclosure**: Public disclosure after 90 days

## Security Severity Levels

### Critical
- Remote code execution
- Authentication bypass
- SQL injection
- **Response**: Immediate patch + hotfix release

### High
- Privilege escalation
- Information disclosure (PII)
- Stored XSS
- **Response**: Patch within 7 days

### Medium
- Reflected XSS
- CSRF
- Weak encryption
- **Response**: Patch in next regular release

### Low
- Information disclosure (non-PII)
- Rate limiting bypass
- **Response**: Fix when convenient

## Security Contacts

- **Security Issues**: security@prepchef.com
- **Privacy Issues**: privacy@prepchef.com
- **General Support**: team@prepchef.com

## Security Audit History

| Date | Auditor | Scope | Issues Found | Status |
|------|---------|-------|--------------|--------|
| TBD | TBD | Full Platform | TBD | Planned |

## Security Certifications

- **SOC 2 Type II**: Planned for 2025
- **ISO 27001**: Planned for 2026
- **GDPR Compliance**: Active

---

**Last Updated**: January 19, 2025
**Next Review**: April 19, 2025
