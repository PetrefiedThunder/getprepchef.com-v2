import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User, IUser } from '@/modules/users/user.model';
import { Tenant, ITenant } from '@/modules/tenants/tenant.model';
import { config } from '@/config/env';
import { UnauthorizedError, ValidationError, ConflictError } from '@/middleware/error_handler';
import logger from '@/lib/logger';
import { UserRole } from '@/config/constants';

/**
 * Authentication Service
 * Handles user authentication, JWT generation, and token management
 */

export interface ITokenPayload {
  user_id: string;
  email: string;
  role: UserRole;
  tenant_id?: string;
  token_version: number;
}

export interface IAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface IRegisterInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  tenant_name: string;
  tenant_type: string;
  contact_email: string;
}

export interface ILoginInput {
  email: string;
  password: string;
}

export class AuthService {
  /**
   * Register new tenant with owner user
   */
  static async register(input: IRegisterInput): Promise<{
    user: IUser;
    tenant: ITenant;
    tokens: IAuthTokens;
  }> {
    logger.info({
      msg: 'Registering new tenant',
      email: input.email,
      tenant_name: input.tenant_name,
    });

    // Check if user already exists
    const existingUser = await User.findOne({ email: input.email.toLowerCase() });
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Validate password strength
    this.validatePassword(input.password);

    // Create tenant
    const tenant = await Tenant.create({
      name: input.tenant_name,
      type: input.tenant_type,
      contact_email: input.contact_email || input.email,
      status: 'trial',
    });

    // Generate initial API key
    await tenant.generateApiKey('Default API Key');

    // Create owner user
    const passwordHash = await User.hashPassword(input.password);

    const user = await User.create({
      tenant_id: tenant._id,
      email: input.email.toLowerCase(),
      password_hash: passwordHash,
      first_name: input.first_name,
      last_name: input.last_name,
      role: 'tenant_owner',
      status: 'active',
    });

    logger.info({
      msg: 'Tenant and user registered',
      user_id: user._id.toString(),
      tenant_id: tenant._id.toString(),
    });

    // Generate tokens
    const tokens = this.generateTokens(user);

    return {
      user,
      tenant,
      tokens,
    };
  }

  /**
   * Login user with email and password
   */
  static async login(input: ILoginInput): Promise<{
    user: IUser;
    tokens: IAuthTokens;
  }> {
    logger.info({
      msg: 'User login attempt',
      email: input.email,
    });

    // Find user (include password hash)
    const user = await User.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if user is active
    if (user.status !== 'active') {
      throw new UnauthorizedError('Account is suspended');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(input.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Update last login
    user.last_login_at = new Date();
    await user.save();

    logger.info({
      msg: 'User logged in successfully',
      user_id: user._id.toString(),
    });

    // Generate tokens
    const tokens = this.generateTokens(user);

    return {
      user,
      tokens,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(refreshToken: string): Promise<IAuthTokens> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as ITokenPayload;

      // Get user
      const user = await User.findById(payload.user_id);
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      // Check token version (for invalidation)
      if (payload.token_version !== user.refresh_token_version) {
        throw new UnauthorizedError('Token has been revoked');
      }

      // Check if user is active
      if (user.status !== 'active') {
        throw new UnauthorizedError('Account is suspended');
      }

      logger.info({
        msg: 'Access token refreshed',
        user_id: user._id.toString(),
      });

      // Generate new tokens
      return this.generateTokens(user);
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Logout user (invalidate refresh tokens)
   */
  static async logout(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Increment token version to invalidate all refresh tokens
    await user.incrementRefreshTokenVersion();

    logger.info({
      msg: 'User logged out',
      user_id: userId,
    });
  }

  /**
   * Generate access and refresh tokens
   */
  private static generateTokens(user: IUser): IAuthTokens {
    const payload: ITokenPayload = {
      user_id: user._id.toString(),
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id?.toString(),
      token_version: user.refresh_token_version,
    };

    const accessToken = jwt.sign(payload, config.JWT_ACCESS_SECRET, {
      expiresIn: config.JWT_ACCESS_EXPIRY,
    });

    const refreshToken = jwt.sign(payload, config.JWT_REFRESH_SECRET, {
      expiresIn: config.JWT_REFRESH_EXPIRY,
    });

    // Parse expiry (e.g., "15m" -> seconds)
    const expiresIn = this.parseExpiry(config.JWT_ACCESS_EXPIRY);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
    };
  }

  /**
   * Verify access token and return payload
   */
  static verifyAccessToken(token: string): ITokenPayload {
    try {
      return jwt.verify(token, config.JWT_ACCESS_SECRET) as ITokenPayload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid access token');
      }
      throw error;
    }
  }

  /**
   * Validate password strength
   */
  private static validatePassword(password: string): void {
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    // Add more password requirements as needed
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      throw new ValidationError(
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      );
    }
  }

  /**
   * Parse expiry string to seconds
   */
  private static parseExpiry(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1), 10);

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 900; // 15 minutes default
    }
  }
}
