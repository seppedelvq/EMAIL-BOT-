import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isDemo, store, saveCredential } from '@/lib/assistant';
export const runtime = 'nodejs';
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: false,
  path: '/api/oauth/gmail',
  maxAge: 600,
};
export async function GET(request: NextRequest) {
  const origin = process.env.ASSISTANT_ORIGIN ?? 'http://localhost:4000';
  const redirectUri = `${origin}/api/oauth/gmail`;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (
    isDemo() ||
    !clientId ||
    !clientSecret ||
    !/^[a-f\d]{64}$/i.test(process.env.ASSISTANT_MASTER_KEY ?? '')
  )
    return NextResponse.redirect(
      new URL('/settings?connection=configure', origin),
    );
  if (request.nextUrl.searchParams.has('error'))
    return NextResponse.redirect(
      new URL('/settings?connection=cancelled', origin),
    );
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    const state = randomBytes(32).toString('hex');
    const verifier = randomBytes(48).toString('base64url');
    const settings = store().settings();
    const scopes = ['https://www.googleapis.com/auth/gmail.readonly'];
    if (settings.autoSort)
      scopes.push('https://www.googleapis.com/auth/gmail.modify');
    if (settings.briefingEnabled || settings.acknowledgment.enabled)
      scopes.push('https://www.googleapis.com/auth/gmail.send');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
    });
    const response = NextResponse.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    );
    response.cookies.set('oauth_state', state, cookieOptions);
    response.cookies.set('oauth_verifier', verifier, cookieOptions);
    return response;
  }
  const supplied = Buffer.from(request.nextUrl.searchParams.get('state') ?? '');
  const expected = Buffer.from(request.cookies.get('oauth_state')?.value ?? '');
  const verifier = request.cookies.get('oauth_verifier')?.value;
  const response = NextResponse.redirect(
    new URL('/settings?connection=connected', origin),
  );
  response.cookies.set('oauth_state', '', { ...cookieOptions, maxAge: 0 });
  response.cookies.set('oauth_verifier', '', { ...cookieOptions, maxAge: 0 });
  if (
    !expected.length ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected) ||
    !verifier
  )
    return NextResponse.json(
      { error: 'Ongeldige of verlopen aanmelding. Probeer opnieuw.' },
      { status: 400 },
    );
  try {
    const result = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const tokens = (await result.json()) as {
      access_token?: string;
      refresh_token?: string;
      scope?: string;
    };
    if (!result.ok || !tokens.access_token || !tokens.refresh_token)
      throw new Error('OAuth failed');
    const profileResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/profile',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    const profile = (await profileResponse.json()) as { emailAddress?: string };
    if (!profileResponse.ok || !profile.emailAddress)
      throw new Error('Profile failed');
    const existing = store().get('account');
    if (existing && existing !== profile.emailAddress)
      throw new Error('Disconnect and clear the previous installation first');
    saveCredential('refreshToken', tokens.refresh_token);
    store().set('account', profile.emailAddress);
    store().set('scopes', tokens.scope ?? '');
    return response;
  } catch {
    return NextResponse.redirect(
      new URL('/settings?connection=failed', origin),
    );
  }
}
