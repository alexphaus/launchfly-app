import { NextResponse } from 'next/server';
import { getWhatsAppProvider } from '@/lib/whatsapp-provider';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, message, imageUrl, businessId } = body;

    if (!phone || !message || !businessId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const provider = await getWhatsAppProvider(businessId);
    let result;
    if (imageUrl) {
      result = await provider.sendImage(phone, imageUrl, message, businessId);
    } else {
      result = await provider.sendWhatsApp(phone, message, businessId);
    }

    if (!result.sent) {
      console.error(`[Delayed WhatsApp Job] Failed to send: ${result.error}`);
      return NextResponse.json({ ok: false, detail: result.error }, { status: 500 });
    }

    console.log(`[Delayed WhatsApp Job] Sent successfully to ${phone}`);
    return NextResponse.json({ ok: true, detail: 'Sent via delayed job' });
  } catch (err: any) {
    console.error(`[Delayed WhatsApp Job] Internal error:`, err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
