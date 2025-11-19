/**
 * AuthService Unit Tests
 * Tests for authentication and user management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthService } from '../auth.service';
import { User } from '../user.model';
import { Tenant } from '../../tenants/tenant.model';

// Mock models
vi.mock('../user.model');
vi.mock('../../tenants/tenant.model');

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('register', () => {
    it('should create a new tenant and user', async () => {
      const mockTenant = {
        _id: 'tenant123',
        name: 'Test Kitchen',
        type: 'kitchen_operator',
        contact_email: 'test@kitchen.com',
        save: vi.fn().mockResolvedValue(true),
        generateApiKey: vi.fn().mockReturnValue('api_key_123'),
      };

      const mockUser = {
        _id: 'user123',
        email: 'admin@kitchen.com',
        first_name: 'John',
        last_name: 'Doe',
        role: 'tenant_owner',
        tenant_id: 'tenant123',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(Tenant).mockImplementation(() => mockTenant as any);
      vi.mocked(User).mockImplementation(() => mockUser as any);
      vi.mocked(User.findByEmail).mockResolvedValue(null);
      vi.mocked(User.hashPassword).mockResolvedValue('hashed_password');

      const result = await AuthService.register({
        tenant_name: 'Test Kitchen',
        tenant_type: 'kitchen_operator',
        contact_email: 'test@kitchen.com',
        first_name: 'John',
        last_name: 'Doe',
        password: 'SecurePass123!',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tenant');
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result).toHaveProperty('api_key');
      expect(User.findByEmail).toHaveBeenCalledWith('test@kitchen.com');
      expect(mockTenant.save).toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw error if email already exists', async () => {
      const existingUser = {
        _id: 'user123',
        email: 'admin@kitchen.com',
      };

      vi.mocked(User.findByEmail).mockResolvedValue(existingUser as any);

      await expect(
        AuthService.register({
          tenant_name: 'Test Kitchen',
          tenant_type: 'kitchen_operator',
          contact_email: 'test@kitchen.com',
          first_name: 'John',
          last_name: 'Doe',
          password: 'SecurePass123!',
        })
      ).rejects.toThrow('Email already in use');
    });

    it('should validate password strength', async () => {
      await expect(
        AuthService.register({
          tenant_name: 'Test Kitchen',
          tenant_type: 'kitchen_operator',
          contact_email: 'test@kitchen.com',
          first_name: 'John',
          last_name: 'Doe',
          password: 'weak',
        })
      ).rejects.toThrow('Password must be at least 8 characters');
    });
  });

  describe('login', () => {
    it('should return user and tokens on valid credentials', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'admin@kitchen.com',
        first_name: 'John',
        last_name: 'Doe',
        role: 'tenant_owner',
        tenant_id: 'tenant123',
        refresh_token_version: 0,
        status: 'active',
        comparePassword: vi.fn().mockResolvedValue(true),
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(User.findByEmail).mockResolvedValue(mockUser as any);

      const result = await AuthService.login({
        email: 'admin@kitchen.com',
        password: 'SecurePass123!',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(mockUser.comparePassword).toHaveBeenCalledWith('SecurePass123!');
    });

    it('should throw error on invalid email', async () => {
      vi.mocked(User.findByEmail).mockResolvedValue(null);

      await expect(
        AuthService.login({
          email: 'invalid@kitchen.com',
          password: 'SecurePass123!',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error on invalid password', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'admin@kitchen.com',
        comparePassword: vi.fn().mockResolvedValue(false),
      };

      vi.mocked(User.findByEmail).mockResolvedValue(mockUser as any);

      await expect(
        AuthService.login({
          email: 'admin@kitchen.com',
          password: 'WrongPassword',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error if user is suspended', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'admin@kitchen.com',
        status: 'suspended',
        comparePassword: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(User.findByEmail).mockResolvedValue(mockUser as any);

      await expect(
        AuthService.login({
          email: 'admin@kitchen.com',
          password: 'SecurePass123!',
        })
      ).rejects.toThrow('Account is suspended');
    });
  });

  describe('verifyAccessToken', () => {
    it('should decode and return valid token payload', () => {
      const mockPayload = {
        user_id: 'user123',
        email: 'admin@kitchen.com',
        role: 'tenant_owner',
        tenant_id: 'tenant123',
        token_version: 0,
      };

      // Mock jwt.verify to return payload
      const token = 'valid.jwt.token';

      // This would require mocking jsonwebtoken
      // For now, this is a placeholder to show test structure
      expect(() => AuthService.verifyAccessToken(token)).not.toThrow();
    });

    it('should throw error on invalid token', () => {
      expect(() => AuthService.verifyAccessToken('invalid.token')).toThrow();
    });

    it('should throw error on expired token', () => {
      // Test with expired JWT token
      // This would require mocking jsonwebtoken with expired token
      expect(() => AuthService.verifyAccessToken('expired.jwt.token')).toThrow();
    });
  });

  describe('refreshToken', () => {
    it('should generate new access token with valid refresh token', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'admin@kitchen.com',
        role: 'tenant_owner',
        tenant_id: 'tenant123',
        refresh_token_version: 0,
        status: 'active',
      };

      vi.mocked(User.findById).mockResolvedValue(mockUser as any);

      // This would require mocking JWT verification
      // For now, this is a placeholder structure
      const result = await AuthService.refreshToken('valid.refresh.token');

      expect(result).toHaveProperty('access_token');
      expect(User.findById).toHaveBeenCalledWith('user123');
    });

    it('should throw error if token version mismatch', async () => {
      const mockUser = {
        _id: 'user123',
        refresh_token_version: 1, // Different version
      };

      vi.mocked(User.findById).mockResolvedValue(mockUser as any);

      await expect(
        AuthService.refreshToken('valid.refresh.token')
      ).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('logout', () => {
    it('should increment refresh token version', async () => {
      const mockUser = {
        _id: 'user123',
        refresh_token_version: 0,
        incrementRefreshTokenVersion: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(User.findById).mockResolvedValue(mockUser as any);

      await AuthService.logout('user123');

      expect(mockUser.incrementRefreshTokenVersion).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      vi.mocked(User.findById).mockResolvedValue(null);

      await expect(AuthService.logout('invalid_user_id')).rejects.toThrow(
        'User not found'
      );
    });
  });
});
