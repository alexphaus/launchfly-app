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

  // Skip localhost and main domain + reserved subdomains
  if (
    hostname?.includes('localhost') ||
    hostname?.includes('127.0.0.1') ||
    subdomain === 'launchfly' ||
    subdomain === 'www' ||
    subdomain === 'app'  // Reserved for main application
  ) {
    console.log('Middleware - Skipping for main domain/localhost');
    return NextResponse.next();
  }

  // If we have a subdomain, treat it as a dynamic site
  if (subdomain && (hostname?.includes('launchfly.ai') || hostname?.includes('vercel.app'))) {
    console.log('Middleware - Rewriting to:', `/sites/${subdomain}`);
    const url = request.nextUrl.clone();
    url.pathname = `/sites/${subdomain}`;

    return NextResponse.rewrite(url);
  }

  console.log('Middleware - No rewrite, continuing');
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
