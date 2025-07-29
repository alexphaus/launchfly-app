// Simple debug page to test routing
export default function DebugPage({ params }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center">
        <h1 className="text-3xl font-bold text-green-600 mb-4">✅ Routing Works!</h1>
        <p className="text-lg mb-2">Subdomain detected: <strong>{params.subdomain}</strong></p>
        <p className="text-gray-600">This means your middleware is working correctly.</p>
        <div className="mt-6 p-4 bg-gray-50 rounded">
          <p className="text-sm text-gray-700">
            Next step: Check if the business exists in your database with subdomain "{params.subdomain}"
          </p>
        </div>
      </div>
    </div>
  );
}
