console.log('MIDDLEWARE TEST')
import { NextResponse } from 'next/server';

export async function middleware(request) {
  const hostname = request.headers.get('host');
  const pathname = request.nextUrl.pathname;
  
  // Enhanced logging for debugging
  console.log('🔍 Middleware Debug:', {
    hostname,
    pathname,
    userAgent: request.headers.get('user-agent')?.slice(0, 50),
    timestamp: new Date().toISOString()
  });
  
  // Skip middleware for API routes, static files, and Next.js internals
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/dashboard/') ||
    pathname.includes('_vercel') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/sitemap.xml')
  ) {
    console.log('⏭️  Skipping middleware for:', pathname);
    return NextResponse.next();
  }

  // Extract subdomain from hostname
  const subdomain = hostname?.split('.')[0];
  
  console.log('🔧 Subdomain extracted:', subdomain);
  
  // Main domain conditions - be more specific
  const isMainDomain = (
    !hostname ||
    hostname === 'launchfly.ai' ||
    hostname === 'www.launchfly.ai' ||
    hostname.includes('localhost') ||
    hostname.includes('127.0.0.1') ||
    subdomain === 'www' ||
    subdomain === hostname // No dots in hostname (localhost case)
  );
  
  if (isMainDomain) {
    console.log('🏠 Main domain detected, continuing normally');
    return NextResponse.next();
  }

  // Production subdomain routing
  if (hostname?.includes('launchfly.ai') || hostname?.includes('vercel.app')) {
    console.log('🚀 Rewriting subdomain request:', {
      from: `${hostname}${pathname}`,
      to: `/sites/${subdomain}${pathname}`
    });
    
    const url = request.nextUrl.clone();
    url.pathname = `/sites/${subdomain}${pathname}`;
    
    const response = NextResponse.rewrite(url);
    
    // Add debug headers to help troubleshoot
    response.headers.set('x-middleware-subdomain', subdomain);
    response.headers.set('x-middleware-rewrite', `/sites/${subdomain}${pathname}`);
    
    return response;
  }

  console.log('❓ No rewrite condition matched, continuing');
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
