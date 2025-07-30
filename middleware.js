console.log('MIDDLEWARE TEST')
import { NextResponse } from 'next/server';

export async function middleware(request) {
  const hostname = request.headers.get('host');
  
  console.log('Middleware - Hostname:', hostname);
  console.log('Middleware - Pathname:', request.nextUrl.pathname);
  
  // Skip middleware for API routes, static files, and Next.js internals
  if (
    request.nextUrl.pathname.startsWith('/api/') ||
    request.nextUrl.pathname.startsWith('/_next/') ||
    request.nextUrl.pathname.startsWith('/favicon.ico') ||
    request.nextUrl.pathname.startsWith('/dashboard/') ||
    request.nextUrl.pathname.includes('_vercel')
  ) {
    return NextResponse.next();
  }

  // Extract subdomain from hostname
  const subdomain = hostname?.split('.')[0];
  
  // Skip localhost and main domain
  if (
    hostname?.includes('localhost') ||
    hostname?.includes('127.0.0.1') ||
    subdomain === 'launchfly' ||
    subdomain === 'www' ||
    !subdomain ||
    subdomain === hostname // No dots in hostname
  ) {
    console.log('Middleware - Skipping for main domain/localhost');
    return NextResponse.next();
  }

  // Production subdomain routing
  if (hostname?.includes('launchfly.ai') || hostname?.includes('vercel.app')) {
    console.log('Middleware - Rewriting subdomain to:', `/sites/${subdomain}`);
    const url = request.nextUrl.clone();
    url.pathname = `/sites/${subdomain}${request.nextUrl.pathname}`;
    
    return NextResponse.rewrite(url);
  }

  console.log('Middleware - No rewrite, continuing');
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
