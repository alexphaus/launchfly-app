import { NextResponse } from 'next/server';

export function middleware(request) {
  // Get the hostname
  const hostname = request.headers.get('host') || '';
  const subdomain = hostname.split('.')[0];
  
  // Skip for main domain, www, and localhost
  if (subdomain === 'launchfly' || subdomain === 'www' || hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return NextResponse.next();
  }
  
  // Skip for API routes and static files
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/api/') || 
      pathname.startsWith('/_next/') || 
      pathname.startsWith('/favicon.ico') ||
      pathname.startsWith('/static/')) {
    return NextResponse.next();
  }
  
  // Rewrite subdomain requests to the sites route
  if (subdomain && subdomain !== 'launchfly' && !hostname.includes('localhost')) {
    return NextResponse.rewrite(
      new URL(`/sites/${subdomain}${pathname}`, request.url)
    );
  }
  
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
