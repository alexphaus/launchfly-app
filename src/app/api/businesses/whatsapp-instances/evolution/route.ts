import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy to Evolution API server — keeps the API key on the server.
 * baseUrl + apiKey come from env vars; only instanceName + action come from client.
 *
 * POST /api/businesses/whatsapp-instances/evolution
 *   body: { action: 'create' | 'connect' | 'status' | 'set-webhook', instanceName, webhookUrl? }
 */

const EVO_BASE = (process.env.EVOLUTION_BASE_URL || '').replace(/\/+$/, '');
const EVO_KEY  = process.env.EVOLUTION_API_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const { action, instanceName, webhookUrl } = await req.json();

    if (!EVO_BASE || !EVO_KEY) {
      return NextResponse.json({ error: 'Evolution API not configured on server' }, { status: 500 });
    }
    if (!instanceName) {
      return NextResponse.json({ error: 'Missing instanceName' }, { status: 400 });
    }

    const headers: Record<string, string> = {
      apikey: EVO_KEY,
      'Content-Type': 'application/json',
    };

    // ── CREATE INSTANCE ──
    if (action === 'create') {
      const res = await fetch(`${EVO_BASE}/instance/create`, {
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
        // If instance already exists, that's fine — we'll just connect
        const errMsg = data?.response?.message?.[0] || data?.message || '';
        if (typeof errMsg === 'string' && errMsg.toLowerCase().includes('already')) {
          return NextResponse.json({ ok: true, data, alreadyExists: true });
        }
        return NextResponse.json({ error: errMsg || 'Failed to create instance' }, { status: res.status });
      }

      // Apply default settings: show online, auto-read, ignore groups
      fetch(`${EVO_BASE}/settings/set/${instanceName}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          rejectCall: false,
          groupsIgnore: true,
          alwaysOnline: true,
          readMessages: true,
          readStatus: true,
          syncFullHistory: false,
        }),
      }).catch(() => {});

      // Extract the QR from the create response — normalize the format
      const qr = data?.qrcode?.base64 || data?.base64 || data?.qrcode?.pairingCode || null;
      return NextResponse.json({ ok: true, data, qrBase64: qr });
    }

    // ── GET QR CODE / CONNECTION STATUS ──
    if (action === 'connect') {
      const res = await fetch(`${EVO_BASE}/instance/connect/${instanceName}`, { headers: { apikey: EVO_KEY } });
      const data = await res.json();
      // Normalize: Evolution v2 may nest QR in different places
      const qr = data?.base64 || data?.qrcode?.base64 || data?.code || null;
      const pairingCode = data?.pairingCode || data?.qrcode?.pairingCode || null;
      return NextResponse.json({ ok: true, data, qrBase64: qr, pairingCode });
    }

    // ── CHECK INSTANCE STATUS ──
    if (action === 'status') {
      const res = await fetch(`${EVO_BASE}/instance/connectionState/${instanceName}`, { headers: { apikey: EVO_KEY } });
      const data = await res.json();
      return NextResponse.json({ ok: true, data });
    }

    // ── SET WEBHOOK ──
    if (action === 'set-webhook') {
      if (!webhookUrl) {
        return NextResponse.json({ error: 'Missing webhookUrl' }, { status: 400 });
      }
      const res = await fetch(`${EVO_BASE}/webhook/set/${instanceName}`, {
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
