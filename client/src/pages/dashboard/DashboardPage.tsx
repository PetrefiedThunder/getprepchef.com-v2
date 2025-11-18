/**
 * Dashboard Page
 * Main overview page with metrics and charts
 */

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import type { VerificationStats } from '@/types';

export default function DashboardPage() {
  // Fetch verification stats
  const { data: stats, isLoading } = useQuery<{ stats: VerificationStats }>({
    queryKey: ['verification-stats'],
    queryFn: () => api.get('/api/v1/verification-stats'),
  });

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  const metrics = [
    {
      name: 'Total Vendors',
      value: stats?.stats.total_vendors || 0,
      icon: Users,
      color: 'text-primary-600',
      bgColor: 'bg-primary-100',
    },
    {
      name: 'Verified',
      value: stats?.stats.verified || 0,
      icon: CheckCircle,
      color: 'text-success-600',
      bgColor: 'bg-success-100',
    },
    {
      name: 'Pending Review',
      value: (stats?.stats.pending || 0) + (stats?.stats.needs_review || 0),
      icon: AlertCircle,
      color: 'text-warning-600',
      bgColor: 'bg-warning-100',
    },
    {
      name: 'Expired',
      value: stats?.stats.expired || 0,
      icon: TrendingUp,
      color: 'text-danger-600',
      bgColor: 'bg-danger-100',
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Metrics grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.name} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{metric.name}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{metric.value}</p>
                </div>
                <div className={`p-3 rounded-full ${metric.bgColor}`}>
                  <Icon className={`w-6 h-6 ${metric.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Placeholder for charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Verification Status Distribution
          </h3>
          <div className="text-sm text-gray-500">
            Chart placeholder - compliance status breakdown
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Activity
          </h3>
          <div className="text-sm text-gray-500">
            Timeline placeholder - recent verifications and updates
          </div>
        </div>
      </div>
    </div>
  );
}
