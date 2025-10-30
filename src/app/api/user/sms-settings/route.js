// src/app/api/user/sms-settings/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// GET: Fetch SMS notification settings for a user
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return Response.json({ error: 'User ID is required' }, { status: 400 });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('phone_number, sms_notifications_enabled')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching SMS settings:', error);
      return Response.json({ error: 'Failed to fetch SMS settings' }, { status: 500 });
    }

    // Default to enabled if not explicitly set
    const smsEnabled = profile?.sms_notifications_enabled !== false;

    return Response.json({
      smsEnabled,
      phoneNumber: profile?.phone_number || null
    });

  } catch (error) {
    console.error('SMS settings GET error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST: Update SMS notification settings for a user
export async function POST(request) {
  try {
    const { userId, smsEnabled } = await request.json();

    if (!userId) {
      return Response.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (typeof smsEnabled !== 'boolean') {
      return Response.json({ error: 'smsEnabled must be a boolean' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ sms_notifications_enabled: smsEnabled })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating SMS settings:', error);
      return Response.json({ error: 'Failed to update SMS settings' }, { status: 500 });
    }

    console.log(`✅ SMS notifications ${smsEnabled ? 'enabled' : 'disabled'} for user ${userId}`);

    return Response.json({
      success: true,
      smsEnabled: data.sms_notifications_enabled,
      message: `SMS notifications ${smsEnabled ? 'enabled' : 'disabled'} successfully`
    });

  } catch (error) {
    console.error('SMS settings POST error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

