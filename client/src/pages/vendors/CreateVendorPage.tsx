/**
 * Create Vendor Page
 * Form to add a new vendor
 */

import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function CreateVendorPage() {
  return (
    <div>
      <div className="mb-6">
        <Link
          to="/vendors"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Vendors
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Add New Vendor</h1>
      </div>

      <div className="card">
        <p className="text-gray-600">
          Multi-step form to create a new vendor with business details,
          contact information, and document upload.
        </p>
      </div>
    </div>
  );
}
