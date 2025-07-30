import { NextResponse } from 'next/server';

export async function middleware(request) {
  const hostname = request.headers.get('host');
  const pathname = request.nextUrl.pathname;
  
  // Skip middleware for API routes, static files, and Next.js internals
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/dashboard/') ||
    pathname.startsWith('/sites/') // Important: Skip if already going to /sites/
  ) {
    return NextResponse.next();
  }

  // Extract subdomain from hostname
  const subdomain = hostname?.split('.')[0];
  
  // Enhanced logging for production debugging
  console.log('🔍 Middleware Debug:', {
    hostname,
    subdomain,
    pathname,
    userAgent: request.headers.get('user-agent')?.substring(0, 50)
  });
  
  // Skip localhost and main domain
  if (
    hostname?.includes('localhost') ||
    hostname?.includes('127.0.0.1') ||
    subdomain === 'launchfly' ||
    subdomain === 'www' ||
    !subdomain ||
    subdomain === 'launchfly-app' // Skip Vercel preview URLs
  ) {
    console.log('⏭️  Middleware - Skipping for main domain/localhost');
    return NextResponse.next();
  }

  // If we have a subdomain and it's on the right domain, treat it as a dynamic site
  if (subdomain && (hostname?.includes('launchfly.ai') || hostname?.includes('vercel.app'))) {
    console.log('🔄 Middleware - Rewriting to:', `/sites/${subdomain}${pathname}`);
    const url = request.nextUrl.clone();
    url.pathname = `/sites/${subdomain}${pathname}`;
    
    return NextResponse.rewrite(url);
  }

  console.log('🚫 Middleware - No rewrite, continuing to main app');
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
