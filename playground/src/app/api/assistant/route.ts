import { NextRequest, NextResponse } from 'next/server';
import { snapshot, action } from '@/lib/assistant';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json(snapshot(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (raw.length > 30000) throw new Error('Aanvraag te groot.');
    return NextResponse.json(await action(JSON.parse(raw)), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    // Never expose raw provider exceptions, token responses or AI output.
    const message =
      error instanceof Error &&
      !/token|api|key|secret|json|zod/i.test(error.message) &&
      error.message.length < 200
        ? error.message
        : 'De actie is niet gelukt. Controleer je instellingen.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
