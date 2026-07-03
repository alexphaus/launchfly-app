import { NextResponse, NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host');

  // Skip middleware for API routes, static files, and Next.js internals
  if (
    request.nextUrl.pathname.startsWith('/api/') ||
    request.nextUrl.pathname.startsWith('/_next/') ||
    request.nextUrl.pathname.startsWith('/favicon.ico') ||
    request.nextUrl.pathname.startsWith('/dashboard/') ||
    // Static assets in /public (e.g. index2.html, start.html, images) —
    // serve them as-is even on *.vercel.app preview domains
    /\.[a-zA-Z0-9]+$/.test(request.nextUrl.pathname)
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
    const url = request.nextUrl.clone();
    // Preserve the pathname (e.g., /quote) by appending it to /sites/[subdomain]
    const pathname = request.nextUrl.pathname === '/' ? '' : request.nextUrl.pathname;
    url.pathname = `/sites/${subdomain}${pathname}`;
    console.log('Middleware - Rewriting to:', url.pathname);

    return NextResponse.rewrite(url);
  }

  console.log('Middleware - No rewrite, continuing');
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
