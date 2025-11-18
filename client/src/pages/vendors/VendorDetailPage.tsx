/**
 * Vendor Detail Page
 * View and manage individual vendor
 */

import { useParams } from 'react-router-dom';

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Vendor Details</h1>
      <div className="card">
        <p className="text-gray-600">Vendor ID: {id}</p>
        <p className="text-sm text-gray-500 mt-2">
          Detailed vendor view with documents, verification history, and actions
        </p>
      </div>
    </div>
  );
}
