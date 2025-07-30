import { headers } from 'next/headers';

export default function DebugPage() {
  const headersList = headers();
  const hostname = headersList.get('host');
  const subdomain = hostname?.split('.')[0];
  
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-red-600 mb-6">🐛 Debug Information</h1>
        
        <div className="space-y-4 text-sm">
          <div>
            <strong>Hostname:</strong> {hostname}
          </div>
          <div>
            <strong>Subdomain:</strong> {subdomain}
          </div>
          <div>
            <strong>Current URL Path:</strong> /debug
          </div>
          <div>
            <strong>Expected Behavior:</strong> This should show the dynamic website for "{subdomain}"
          </div>
          
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800">
              <strong>If you're seeing this page:</strong><br/>
              The middleware is NOT rewriting correctly. Check Vercel logs and domain configuration.
            </p>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-blue-800">
              <strong>Next Steps:</strong><br/>
              1. Check Vercel Function logs<br/>
              2. Verify *.launchfly.ai domain is added to Vercel<br/>
              3. Check DNS configuration
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
