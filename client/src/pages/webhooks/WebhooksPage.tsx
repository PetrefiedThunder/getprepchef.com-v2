/**
 * Webhooks Page
 * Manage webhook endpoints and view delivery logs
 */

export default function WebhooksPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Webhooks</h1>

      <div className="card">
        <p className="text-gray-600 mb-4">
          Configure webhook endpoints to receive real-time notifications about vendor
          status changes and regulatory updates.
        </p>
        <p className="text-sm text-gray-500">
          List of webhook endpoints, creation form, and delivery logs table.
        </p>
      </div>
    </div>
  );
}
