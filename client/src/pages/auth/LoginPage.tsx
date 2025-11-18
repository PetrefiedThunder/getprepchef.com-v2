/**
 * Login Page
 * User authentication page
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { setTokens, setUser, setApiKey } from '@/lib/auth';
import type { LoginResponse } from '@/types';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError('');
    setIsLoading(true);

    try {
      const response = await api.post<LoginResponse>('/api/v1/auth/login', data);

      // Store auth data
      setTokens(response.access_token, response.refresh_token);
      setUser(response.user);

      // Fetch and store API key (first available key)
      // In a real app, user might select which tenant/API key to use
      try {
        const meResponse = await api.get<{ user: { tenant_id?: string } }>(
          '/api/v1/auth/me'
        );
        if (meResponse.user.tenant_id) {
          // Fetch tenant to get API key (this is a simplification)
          // In production, API key should be retrieved from a dedicated endpoint
          const demoApiKey = localStorage.getItem('demo_api_key');
          if (demoApiKey) {
            setApiKey(demoApiKey);
          }
        }
      } catch (e) {
        console.warn('Could not fetch API key');
      }

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (err: unknown) {
      const apiError = err as { message?: string };
      setError(apiError.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">
        Sign in to your account
      </h2>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-danger-50 border border-danger-200">
          <p className="text-sm text-danger-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="email" className="label">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={errors.email ? 'input input-error' : 'input'}
            {...register('email')}
          />
          {errors.email && (
            <p className="error-message">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className={errors.password ? 'input input-error' : 'input'}
            {...register('password')}
          />
          {errors.password && (
            <p className="error-message">{errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full btn-primary btn-lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="font-medium text-primary-600 hover:text-primary-500"
          >
            Register here
          </Link>
        </p>
      </div>

      {/* Demo credentials hint */}
      <div className="mt-6 p-3 bg-primary-50 border border-primary-200 rounded-md">
        <p className="text-xs text-primary-800 font-medium mb-1">Demo Credentials:</p>
        <p className="text-xs text-primary-700">
          admin@kitchencollective-la.com / Admin1234!
        </p>
      </div>
    </div>
  );
}
