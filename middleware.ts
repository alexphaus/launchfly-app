import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl.clone();
  
  // Skip middleware for API routes, static files, and internal Next.js routes
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/favicon.ico') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next();
  }
  
  // Extract subdomain
  const subdomain = hostname.split('.')[0];
  
  // Skip for main domain variations
  if (
    subdomain === 'launchfly' ||
    subdomain === 'www' ||
    hostname === 'localhost:3000' ||
    hostname.startsWith('localhost')
  ) {
    return NextResponse.next();
  }
  
  // Rewrite subdomain requests to the dynamic sites route
  console.log(`Middleware: Rewriting ${hostname}${url.pathname} to /sites/${subdomain}${url.pathname}`);
  
  url.pathname = `/sites/${subdomain}${url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
