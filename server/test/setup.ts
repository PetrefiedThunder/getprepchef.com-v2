/**
 * Jest test setup
 * Runs before all tests
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/prepchef_test';
process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret-min-32-chars-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-min-32-chars-for-testing-only';
process.env.WEBHOOK_SIGNING_SECRET = 'test-webhook-secret-min-32-chars-for-testing-only';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests
process.env.LOG_PRETTY = 'false';

// Set test timeouts
jest.setTimeout(30000); // 30 seconds for integration tests
