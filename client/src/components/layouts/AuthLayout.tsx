/**
 * Auth Layout
 * Simple centered layout for login/register pages
 */

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-600">PrepChef</h1>
          <p className="mt-2 text-sm text-gray-600">
            Vendor Verification Platform
          </p>
        </div>

        {/* Auth content */}
        <div className="bg-white py-8 px-6 shadow-xl rounded-lg border border-gray-200">
          {children}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            Built for shared kitchen operators and food entrepreneurs
          </p>
        </div>
      </div>
    </div>
  );
}
