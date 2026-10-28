import { NextRequest, NextResponse } from 'next/server';
/** Local single-user app. Remote/multi-user deployment requires an authentication layer. */
export function proxy(request: NextRequest) {
  const configured = new URL(
    process.env.ASSISTANT_ORIGIN ?? 'http://localhost:4000',
  );
  const host = request.headers.get('host');
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(configured.hostname) ||
    host !== configured.host
  )
    return NextResponse.json({ error: 'Local access only.' }, { status: 403 });
  const origin = request.headers.get('origin');
  if (origin && origin !== configured.origin)
    return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  if (
    request.headers.get('sec-fetch-site') === 'cross-site' &&
    !request.nextUrl.pathname.startsWith('/api/oauth/gmail')
  )
    return NextResponse.json(
      { error: 'Cross-site request blocked.' },
      { status: 403 },
    );
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
    origin !== configured.origin
  )
    return NextResponse.json({ error: 'Origin required.' }, { status: 403 });
  const path = request.nextUrl.pathname;
  const legacy = path.startsWith('/api/emai') || path === '/api/config';
  if (legacy && process.env.ENABLE_LEGACY_PLAYGROUND !== '1')
    return NextResponse.json(
      { error: 'Developer tools disabled.' },
      { status: 403 },
    );
  if (
    !path.startsWith('/api/') &&
    !path.startsWith('/_next/') &&
    !['/', '/dashboard', '/emails', '/settings', '/favicon.ico'].includes(
      path,
    ) &&
    process.env.ENABLE_LEGACY_PLAYGROUND !== '1'
  )
    return NextResponse.redirect(new URL('/settings', request.url));
  const response = NextResponse.next();
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
