// middleware.js - Dynamic subdomain routing for customer websites
import { NextResponse } from 'next/server';

export async function middleware(request) {
  const hostname = request.headers.get('host');
  const url = request.nextUrl.clone();
  
  // Skip middleware for local development, API routes, and static assets
  if (
    hostname?.includes('localhost') ||
    hostname?.includes('127.0.0.1') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/static') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Extract subdomain
  const subdomain = hostname?.split('.')[0];
  
  // Skip if no subdomain or if it's www
  if (!subdomain || subdomain === 'www' || subdomain === hostname) {
    return NextResponse.next();
  }

  // Check if this is a main app route (dashboard, admin, etc.)
  const appRoutes = ['dashboard', 'admin', 'app'];
  if (appRoutes.includes(subdomain)) {
    return NextResponse.next();
  }

  // This is a customer website subdomain
  // Rewrite to the dynamic website renderer
  url.pathname = `/sites/${subdomain}${url.pathname}`;
  
  console.log(`🌐 Routing ${hostname} to ${url.pathname}`);
  
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
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
