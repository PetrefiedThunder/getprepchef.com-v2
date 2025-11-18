/**
 * Vendors Page
 * List and manage vendors
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { api } from '@/lib/api';
import type { Vendor, VendorStatus } from '@/types';
import { clsx } from 'clsx';

const statusColors: Record<VendorStatus, string> = {
  verified: 'badge-success',
  pending: 'badge-gray',
  needs_review: 'badge-warning',
  rejected: 'badge-danger',
  expired: 'badge-danger',
  suspended: 'badge-danger',
};

const statusLabels: Record<VendorStatus, string> = {
  verified: 'Verified',
  pending: 'Pending',
  needs_review: 'Needs Review',
  rejected: 'Rejected',
  expired: 'Expired',
  suspended: 'Suspended',
};

export default function VendorsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VendorStatus | 'all'>('all');

  // Fetch vendors
  const { data: vendorsData, isLoading } = useQuery<{ vendors: Vendor[] }>({
    queryKey: ['vendors', statusFilter, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (search) params.append('search', search);

      return api.get(`/api/v1/vendors?${params.toString()}`);
    },
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
        <Link to="/vendors/new" className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Add Vendor
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search vendors..."
                className="input pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Status filter */}
          <div className="w-48">
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as VendorStatus | 'all')}
            >
              <option value="all">All Statuses</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="needs_review">Needs Review</option>
              <option value="expired">Expired</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Vendors table */}
      {isLoading ? (
        <div className="card">
          <p className="text-gray-600">Loading vendors...</p>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Business Name
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Entity Type
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Contact
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Last Verified
                  </th>
                </tr>
              </thead>
              <tbody>
                {vendorsData?.vendors.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      No vendors found. Add your first vendor to get started.
                    </td>
                  </tr>
                ) : (
                  vendorsData?.vendors.map((vendor) => (
                    <tr
                      key={vendor._id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <Link
                          to={`/vendors/${vendor._id}`}
                          className="text-sm font-medium text-primary-600 hover:text-primary-700"
                        >
                          {vendor.business_name}
                        </Link>
                        {vendor.dba_name && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            DBA: {vendor.dba_name}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-700 capitalize">
                          {vendor.legal_entity_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-900">{vendor.contact.primary_contact_name}</p>
                        <p className="text-xs text-gray-500">{vendor.contact.email}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className={clsx('badge', statusColors[vendor.status])}>
                          {statusLabels[vendor.status]}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-700">
                          {vendor.last_verified_at
                            ? new Date(vendor.last_verified_at).toLocaleDateString()
                            : 'Never'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
