/**
 * Authentication utilities
 * Manages tokens, API keys, and auth state
 */

import type { User } from '@/types';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const API_KEY_KEY = 'api_key';
const USER_KEY = 'user';

/**
 * Get access token from localStorage
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Get refresh token from localStorage
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Get API key from localStorage
 */
export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_KEY);
}

/**
 * Get stored user from localStorage
 */
export function getStoredUser(): User | null {
  const userJson = localStorage.getItem(USER_KEY);
  if (!userJson) return null;

  try {
    return JSON.parse(userJson) as User;
  } catch {
    return null;
  }
}

/**
 * Set tokens in localStorage
 */
export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

/**
 * Set API key in localStorage
 */
export function setApiKey(apiKey: string): void {
  localStorage.setItem(API_KEY_KEY, apiKey);
}

/**
 * Set user in localStorage
 */
export function setUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Clear all auth data
 */
export function clearAuth(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(API_KEY_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

/**
 * Decode JWT token payload (without verification)
 * Used for client-side token inspection only
 */
export function decodeToken(token: string): unknown | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token) as { exp?: number } | null;
  if (!payload || !payload.exp) return true;

  // Check if token expires in the next 30 seconds
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now + 30;
}

/**
 * Get token expiration time
 */
export function getTokenExpiration(token: string): Date | null {
  const payload = decodeToken(token) as { exp?: number } | null;
  if (!payload || !payload.exp) return null;

  return new Date(payload.exp * 1000);
}
