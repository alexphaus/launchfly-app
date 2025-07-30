export default function DebugPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
        <h1 className="text-2xl font-bold text-green-600 mb-4">✅ Debug Route Works!</h1>
        <p className="text-gray-600 mb-4">
          If you can see this page, the routing system is working correctly.
        </p>
        <div className="text-sm text-gray-500 space-y-1">
          <p><strong>Test URLs:</strong></p>
          <p>• https://www.launchfly.ai/sites/debug</p>
          <p>• http://localhost:3000/sites/debug</p>
        </div>
      </div>
    </div>
  );
}
