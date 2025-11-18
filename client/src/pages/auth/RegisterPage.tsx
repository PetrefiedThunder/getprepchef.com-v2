/**
 * Register Page
 * New tenant and user registration
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { setTokens, setUser, setApiKey } from '@/lib/auth';
import type { RegisterResponse } from '@/types';

const registerSchema = z.object({
  tenant_name: z.string().min(1, 'Organization name is required'),
  tenant_type: z.enum(['kitchen_operator', 'enterprise', 'partner']),
  contact_email: z.string().email('Invalid email address'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  confirm_password: z.string(),
}).refine((data) => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKeyGenerated, setApiKeyGenerated] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      tenant_type: 'kitchen_operator',
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setError('');
    setIsLoading(true);

    try {
      const response = await api.post<RegisterResponse>('/api/v1/auth/register', {
        tenant_name: data.tenant_name,
        tenant_type: data.tenant_type,
        contact_email: data.contact_email,
        first_name: data.first_name,
        last_name: data.last_name,
        password: data.password,
      });

      // Store auth data
      setTokens(response.access_token, response.refresh_token);
      setUser(response.user);
      setApiKey(response.api_key);

      // Show API key to user (only shown once!)
      setApiKeyGenerated(response.api_key);

      // Wait 3 seconds to show API key, then redirect
      setTimeout(() => {
        navigate('/dashboard');
      }, 5000);
    } catch (err: unknown) {
      const apiError = err as { message?: string };
      setError(apiError.message || 'Registration failed. Please try again.');
      setIsLoading(false);
    }
  };

  // Show API key success screen
  if (apiKeyGenerated) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">
          Registration Successful!
        </h2>

        <div className="space-y-4">
          <div className="p-4 bg-success-50 border border-success-200 rounded-md">
            <p className="text-sm text-success-800 font-medium mb-2">
              Your account has been created successfully.
            </p>
            <p className="text-xs text-success-700">
              Redirecting to dashboard in 5 seconds...
            </p>
          </div>

          <div className="p-4 bg-warning-50 border border-warning-500 rounded-md">
            <p className="text-sm font-semibold text-warning-900 mb-2">
              ⚠️ Save Your API Key
            </p>
            <p className="text-xs text-warning-800 mb-3">
              This key will only be shown once. Store it securely.
            </p>
            <div className="bg-white p-3 rounded border border-warning-300">
              <code className="text-xs font-mono text-gray-900 break-all">
                {apiKeyGenerated}
              </code>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">
        Create your account
      </h2>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-danger-50 border border-danger-200">
          <p className="text-sm text-danger-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Organization info */}
        <div>
          <label htmlFor="tenant_name" className="label">
            Organization Name
          </label>
          <input
            id="tenant_name"
            type="text"
            className={errors.tenant_name ? 'input input-error' : 'input'}
            placeholder="My Kitchen Collective"
            {...register('tenant_name')}
          />
          {errors.tenant_name && (
            <p className="error-message">{errors.tenant_name.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="tenant_type" className="label">
            Organization Type
          </label>
          <select
            id="tenant_type"
            className={errors.tenant_type ? 'input input-error' : 'input'}
            {...register('tenant_type')}
          >
            <option value="kitchen_operator">Kitchen Operator</option>
            <option value="enterprise">Enterprise</option>
            <option value="partner">Partner</option>
          </select>
          {errors.tenant_type && (
            <p className="error-message">{errors.tenant_type.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="contact_email" className="label">
            Organization Email
          </label>
          <input
            id="contact_email"
            type="email"
            className={errors.contact_email ? 'input input-error' : 'input'}
            placeholder="admin@mykitchen.com"
            {...register('contact_email')}
          />
          {errors.contact_email && (
            <p className="error-message">{errors.contact_email.message}</p>
          )}
        </div>

        {/* User info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="first_name" className="label">
              First Name
            </label>
            <input
              id="first_name"
              type="text"
              className={errors.first_name ? 'input input-error' : 'input'}
              {...register('first_name')}
            />
            {errors.first_name && (
              <p className="error-message">{errors.first_name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="last_name" className="label">
              Last Name
            </label>
            <input
              id="last_name"
              type="text"
              className={errors.last_name ? 'input input-error' : 'input'}
              {...register('last_name')}
            />
            {errors.last_name && (
              <p className="error-message">{errors.last_name.message}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            type="password"
            className={errors.password ? 'input input-error' : 'input'}
            {...register('password')}
          />
          {errors.password && (
            <p className="error-message">{errors.password.message}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Min 8 characters with uppercase, lowercase, and number
          </p>
        </div>

        <div>
          <label htmlFor="confirm_password" className="label">
            Confirm Password
          </label>
          <input
            id="confirm_password"
            type="password"
            className={errors.confirm_password ? 'input input-error' : 'input'}
            {...register('confirm_password')}
          />
          {errors.confirm_password && (
            <p className="error-message">{errors.confirm_password.message}</p>
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
              Creating account...
            </>
          ) : (
            'Create account'
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-primary-600 hover:text-primary-500"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
