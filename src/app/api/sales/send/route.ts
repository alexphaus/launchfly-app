import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { to, subject, body, replyTo } = await request.json();

    if (!to || !subject || !body) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await resend.emails.send({
      from: 'hello@launchfly.ai',
      to: to,
      replyTo: replyTo,
      subject: subject,
      text: body,
    });

    if (error) {
      console.error('Resend error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, id: data?.id });

  } catch (error) {
    console.error('Email send error:', error);
    return Response.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
