import { NextResponse, NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host');
  
  // Skip middleware for API routes, static files, and Next.js internals
  if (
    request.nextUrl.pathname.startsWith('/api/') ||
    request.nextUrl.pathname.startsWith('/_next/') ||
    request.nextUrl.pathname.startsWith('/favicon.ico') ||
    request.nextUrl.pathname.startsWith('/dashboard/')
  ) {
    return NextResponse.next();
  }

  // Extract subdomain from hostname
  const subdomain = hostname?.split('.')[0];
  
  console.log('Middleware - Hostname:', hostname);
  console.log('Middleware - Subdomain:', subdomain);
  console.log('Middleware - Pathname:', request.nextUrl.pathname);
  
  // Skip localhost and main domain
  if (
    hostname?.includes('localhost') ||
    hostname?.includes('127.0.0.1') ||
    subdomain === 'launchfly' ||
    subdomain === 'www'
  ) {
    console.log('Middleware - Skipping for main domain/localhost');
    return NextResponse.next();
  }
  
  // Handle subdomain routing
  const url = request.nextUrl.clone();
  url.pathname = `/sites/${subdomain}${request.nextUrl.pathname}`;
  
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
