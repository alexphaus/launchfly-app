import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy to Evolution API server — keeps the API key out of the browser.
 *
 * POST /api/businesses/whatsapp-instances/evolution
 *   body: { action: 'create' | 'connect' | 'status' | 'set-webhook', baseUrl, apiKey, instanceName, webhookUrl? }
 */
export async function POST(req: NextRequest) {
  try {
    const { action, baseUrl, apiKey, instanceName, webhookUrl } = await req.json();

    if (!baseUrl || !apiKey || !instanceName) {
      return NextResponse.json({ error: 'Missing baseUrl, apiKey, or instanceName' }, { status: 400 });
    }

    // Validate baseUrl is a proper URL (prevent SSRF to internal networks)
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(baseUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid baseUrl' }, { status: 400 });
    }
    const hostname = parsedUrl.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('169.254.')) {
      return NextResponse.json({ error: 'Internal addresses not allowed' }, { status: 400 });
    }

    const base = baseUrl.replace(/\/+$/, '');
    const headers: Record<string, string> = {
      apikey: apiKey,
      'Content-Type': 'application/json',
    };

    // ── CREATE INSTANCE ──
    if (action === 'create') {
      const res = await fetch(`${base}/instance/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          instanceName,
          integration: 'WHATSAPP-BAILEYS',
          qrcode: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json({ error: data?.response?.message?.[0] || data?.message || 'Failed to create instance' }, { status: res.status });
      }
      return NextResponse.json({ ok: true, data });
    }

    // ── GET QR CODE / CONNECTION STATUS ──
    if (action === 'connect') {
      const res = await fetch(`${base}/instance/connect/${instanceName}`, { headers: { apikey: apiKey } });
      const data = await res.json();
      return NextResponse.json({ ok: true, data });
    }

    // ── CHECK INSTANCE STATUS ──
    if (action === 'status') {
      const res = await fetch(`${base}/instance/connectionState/${instanceName}`, { headers: { apikey: apiKey } });
      const data = await res.json();
      return NextResponse.json({ ok: true, data });
    }

    // ── SET WEBHOOK ──
    if (action === 'set-webhook') {
      if (!webhookUrl) {
        return NextResponse.json({ error: 'Missing webhookUrl' }, { status: 400 });
      }
      const res = await fetch(`${base}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url: webhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          events: ['MESSAGES_UPSERT'],
        }),
      });
      const data = await res.json();
      return NextResponse.json({ ok: true, data });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
