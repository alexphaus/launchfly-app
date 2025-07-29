// Simple test page to verify routing works
export default function TestPage({ params }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
        <h1 className="text-2xl font-bold text-green-600 mb-4">✅ Route Works!</h1>
        <div className="space-y-2 text-left">
          <p><strong>Subdomain:</strong> {params.subdomain}</p>
          <p><strong>Route:</strong> /sites/[subdomain]/page.js</p>
          <p><strong>Status:</strong> Dynamic route is working correctly</p>
        </div>
        <div className="mt-6 p-4 bg-gray-50 rounded text-sm text-gray-600">
          This means your Next.js routing is working. If you're seeing this page, 
          the issue is not with the route file itself.
        </div>
      </div>
    </div>
  );
}
