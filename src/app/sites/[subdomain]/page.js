// Simple test to verify dynamic routing works
// Simple test to verify dynamic routing works
export default async function DynamicWebsite({ params }) {
  // Debug: Show what we're receiving
  console.log('DynamicWebsite - Params:', params);
  
  // Simple test first - let's make sure the route is working
  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
        <h1 className="text-3xl font-bold text-green-600 mb-4">🎉 Dynamic Route Works!</h1>
        <div className="space-y-2 text-left">
          <p><strong>Subdomain:</strong> {params.subdomain}</p>
          <p><strong>Route:</strong> /sites/[subdomain]/page.js</p>
          <p><strong>Status:</strong> This is the dynamic website route!</p>
        </div>
        <div className="mt-6 p-4 bg-green-50 rounded text-sm text-gray-600">
          If you see this, the Next.js dynamic routing is working correctly.
          Now we can add back the Supabase logic.
        </div>
      </div>
    </div>
  );
}
