import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
    try {
        const { to, subject, html, text } = await req.json();

        if (!to || !subject || (!html && !text)) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const { data, error } = await resend.emails.send({
            from: 'Alex <alex@launchfly.ai>',
            to,
            subject,
            html: `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background-color: #f9f9f9;
    margin: 0;
    padding: 0;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
  }
  .content {
    background: #ffffff;
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .footer {
    margin-top: 20px;
    text-align: center;
    font-size: 12px;
    color: #9ca3af;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="content">
      <div style="font-size: 16px; line-height: 1.6; color: #374151;">
        ${html || text}
      </div>
    </div>
    <div class="footer">
      <p>Sent from Alex's iPhone</p>
      <p style="margin-top: 10px;">
        <a href="#" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`,
            text: `${text || html}\n\n--\nSent from Alex's iPhone\nUnsubscribe: #`,
        });

        if (error) {
            console.error('Resend error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        console.error('Send email error:', err);
        return NextResponse.json(
            { error: err.message || 'Failed to send email' },
            { status: 500 }
        );
    }
}
