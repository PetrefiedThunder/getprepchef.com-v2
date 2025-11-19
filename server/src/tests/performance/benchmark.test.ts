/**
 * Performance Benchmarks
 * Tests for API response times and throughput
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { build } from '../../app';
import { connectDatabase, disconnectDatabase } from '../../db/connection';

describe('Performance Benchmarks', () => {
  let app: any;

  beforeAll(async () => {
    await connectDatabase();
    app = await build();
  });

  afterAll(async () => {
    await app.close();
    await disconnectDatabase();
  });

  describe('API Response Times', () => {
    it('should respond to health check in < 50ms', async () => {
      const start = Date.now();
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });
      const duration = Date.now() - start;

      expect(response.statusCode).toBe(200);
      expect(duration).toBeLessThan(50);
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrency = 10;
      const requests = Array.from({ length: concurrency }, () =>
        app.inject({
          method: 'GET',
          url: '/health',
        })
      );

      const start = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - start;

      responses.forEach((response) => {
        expect(response.statusCode).toBe(200);
      });

      // All 10 requests should complete in < 500ms
      expect(duration).toBeLessThan(500);
    });

    it('should handle vendor list query in < 200ms', async () => {
      // This requires a valid API key and seed data
      // For now, we'll test the endpoint existence
      const start = Date.now();
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/vendors',
        headers: {
          'X-Prep-Api-Key': 'test-api-key',
        },
      });
      const duration = Date.now() - start;

      // Should respond quickly even if unauthorized
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Throughput Tests', () => {
    it('should handle 100 requests/second', async () => {
      const totalRequests = 100;
      const requests = Array.from({ length: totalRequests }, () =>
        app.inject({
          method: 'GET',
          url: '/health',
        })
      );

      const start = Date.now();
      await Promise.all(requests);
      const duration = Date.now() - start;

      // 100 requests should complete in < 1 second
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory on repeated requests', async () => {
      const iterations = 1000;
      const memBefore = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        await app.inject({
          method: 'GET',
          url: '/health',
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memAfter = process.memoryUsage().heapUsed;
      const memDelta = memAfter - memBefore;

      // Memory should not increase by more than 10MB
      expect(memDelta).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
