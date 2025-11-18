import { FastifyInstance } from 'fastify';
import createApp from './app';
import { connectDatabase, disconnectDatabase } from '@/db/connection';

describe('PrepChef API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Connect to test database
    await connectDatabase({ maxRetries: 3, retryDelay: 1000 });

    // Create app
    app = await createApp();
  });

  afterAll(async () => {
    // Close app
    if (app) {
      await app.close();
    }

    // Disconnect database
    await disconnectDatabase();
  });

  describe('GET /', () => {
    it('should return API info', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        name: 'PrepChef API',
        version: 'v1',
        description: expect.any(String),
      });
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body).toMatchObject({
        status: expect.stringMatching(/healthy|degraded/),
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        environment: 'test',
        database: {
          connected: expect.any(Boolean),
          ready_state: expect.any(Number),
        },
      });
    });
  });

  describe('GET /ready', () => {
    it('should return readiness status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect([200, 503]).toContain(response.statusCode);
      expect(response.json()).toHaveProperty('status');
    });
  });

  describe('GET /live', () => {
    it('should return liveness status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/live',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        status: 'alive',
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/non-existent-route',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toHaveProperty('error');
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/',
        headers: {
          origin: 'http://localhost:5173',
          'access-control-request-method': 'GET',
        },
      });

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      // Helmet should add security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });
});
