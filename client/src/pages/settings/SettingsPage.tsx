/**
 * Settings Page
 * Manage account and tenant settings
 */

import { getStoredUser } from '@/lib/auth';

export default function SettingsPage() {
  const user = getStoredUser();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="space-y-6">
        {/* User Info */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            User Information
          </h2>
          <div className="space-y-2">
            <p className="text-sm">
              <span className="text-gray-600">Name:</span>{' '}
              <span className="font-medium text-gray-900">
                {user?.first_name} {user?.last_name}
              </span>
            </p>
            <p className="text-sm">
              <span className="text-gray-600">Email:</span>{' '}
              <span className="font-medium text-gray-900">{user?.email}</span>
            </p>
            <p className="text-sm">
              <span className="text-gray-600">Role:</span>{' '}
              <span className="font-medium text-gray-900 capitalize">
                {user?.role?.replace('_', ' ')}
              </span>
            </p>
          </div>
        </div>

        {/* API Keys */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            API Keys
          </h2>
          <p className="text-sm text-gray-500">
            View and manage API keys for programmatic access.
          </p>
        </div>

        {/* Notification Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Notification Preferences
          </h2>
          <p className="text-sm text-gray-500">
            Configure email and webhook notification settings.
          </p>
        </div>
      </div>
    </div>
  );
}
