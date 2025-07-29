import { NextResponse } from 'next/server';

export async function middleware(request) {
  const hostname = request.headers.get('host');
  
  // Skip middleware for API routes, static files, and Next.js internals
  if (
    request.nextUrl.pathname.startsWith('/api/') ||
    request.nextUrl.pathname.startsWith('/_next/') ||
    request.nextUrl.pathname.startsWith('/favicon.ico') ||
    request.nextUrl.pathname.startsWith('/dashboard/') ||
    hostname?.includes('localhost') ||
    hostname?.includes('127.0.0.1') ||
    hostname?.includes('vercel.app')
  ) {
    return NextResponse.next();
  }

  // Extract subdomain from hostname
  const subdomain = hostname?.split('.')[0];
  
  // If we have a subdomain and it's not 'www', treat it as a dynamic site
  if (subdomain && subdomain !== 'www' && hostname?.includes('launchfly.site')) {
    // Rewrite to the dynamic site page
    const url = request.nextUrl.clone();
    url.pathname = `/sites/${subdomain}`;
    
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
