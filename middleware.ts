import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname.toLowerCase();

  // WordPress vulnerability scanner paths and suspicious automated crawler patterns
  const isScannerPath = 
    pathname.includes('wp-') || 
    pathname.includes('wlwmanifest') ||
    pathname.includes('xmlrpc') ||
    pathname.includes('wp-includes') ||
    pathname.includes('wp-content') ||
    pathname.endsWith('.php');

  if (isScannerPath) {
    // Return a lightweight, flat text 404 response instantly.
    // This bypasses the whole Next.js page generation/Server Component rendering pipeline,
    // protecting your CPU cycle quota and keeping backend resources clean.
    return new NextResponse('Not Found', { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /api (your backend api routes)
     * - /_next/static (next.js static files)
     * - /_next/image (next.js image optimization)
     * - favicon.ico and other static brand assets
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
