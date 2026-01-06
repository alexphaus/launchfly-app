// src/app/api/assets/share-templates/route.js
// Generate copy-paste ready sharing templates for WhatsApp Broadcast and Facebook Groups

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get('businessId');

  if (!businessId) {
    return Response.json({ error: 'Missing businessId' }, { status: 400 });
  }

  try {
    // Fetch business data
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (error || !business) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    const businessData = business.business_data || {};
    const businessName = businessData.businessName || business.name || 'Local Business';
    const niche = businessData.niche || 'Service';
    const city = businessData.city || businessData.location || 'your area';
    const phone = business.phone_number || businessData.phone || '';
    const leadMagnetTitle = businessData.lead_magnet_title || `Free ${niche} Guide`;
    const couponOffer = businessData.lead_magnet_pdf?.coupon_offer || '15% Off First Service';
    const couponCode = businessData.lead_magnet_pdf?.coupon_code || 'GUIDE15';
    // URL points to Quote Funnel - use subdomain format when available
    const landingPageUrl = business.subdomain
      ? `https://${business.subdomain}.launchfly.ai/quote`
      : `https://app.launchfly.ai/q/${businessId}`;

    // Generate templates
    const templates = {
      // WhatsApp Broadcast Message (personal, conversational)
      whatsapp_broadcast: {
        title: 'WhatsApp Broadcast Message',
        description: 'Send to your existing contacts/customers',
        template: `Hi! 👋

I just released something I think you'll find useful...

📄 *${leadMagnetTitle}*

It's a free guide that covers:
✅ Fair ${niche.toLowerCase()} prices in ${city}
✅ Common mistakes to avoid
✅ Tips to save money

No catch, just value. 

Download it here: ${landingPageUrl}

${couponOffer ? `Plus, there's a *${couponOffer}* inside! 🎁` : ''}

Feel free to share with anyone who might need it!

- ${businessName}
${phone ? `📞 ${phone}` : ''}`
      },

      // WhatsApp Status Caption
      whatsapp_status: {
        title: 'WhatsApp Status Caption',
        description: 'Post alongside your WhatsApp Status image',
        template: `🎁 FREE ${niche.toUpperCase()} GUIDE!

Download here 👉 ${landingPageUrl}

${couponOffer ? `+ ${couponOffer} inside! 🔥` : ''}

#${niche.replace(/\s+/g, '')} #${city.replace(/\s+/g, '')} #FreeGuide`
      },

      // Facebook Group Post (educational, value-focused)
      facebook_group: {
        title: 'Facebook Group Post',
        description: 'Post in local community/neighborhood groups',
        template: `Admin please allow 🙏

Hi neighbors! 👋

I'm ${businessName.split(' ')[0]} from ${businessName}, and I just put together a FREE guide that I think will help a lot of people here.

📄 "${leadMagnetTitle}"

Inside you'll learn:
• What fair ${niche.toLowerCase()} prices look like in ${city}
• 3 common mistakes that cost homeowners money
• Quick tips you can use right away

No sales pitch, just genuinely useful info I wish I could share with everyone.

👉 Download it free here: ${landingPageUrl}

${couponOffer ? `There's also a ${couponOffer} voucher inside if you ever need our services! 🎁` : ''}

Hope it helps someone! Feel free to ask questions in the comments.

#${city.replace(/\s+/g, '')} #${niche.replace(/\s+/g, '')} #LocalBusiness #FreeGuide`
      },

      // Facebook Personal Post
      facebook_personal: {
        title: 'Facebook Personal Post',
        description: 'Share on your personal timeline',
        template: `Hey everyone! 🙌

Just finished putting together something I'm really proud of...

A FREE guide called "${leadMagnetTitle}" 📄

It's packed with:
✅ Fair pricing info for ${niche.toLowerCase()} in ${city}
✅ Tips to avoid common costly mistakes
✅ Advice straight from ${(new Date()).getFullYear() - 2010}+ years experience

Whether you use my services or not, I genuinely hope this helps you make better decisions.

Download it free: ${landingPageUrl}

Please share with anyone who might find it useful! 🙏

#SmallBusiness #${niche.replace(/\s+/g, '')} #FreeGuide`
      },

      // SMS/Text Message (short)
      sms: {
        title: 'SMS Text Message',
        description: 'Short message for text blasts',
        template: `${businessName}: FREE ${niche} Guide released! Fair prices, tips & ${couponOffer || 'special offer'} inside. Download: ${landingPageUrl}`
      },

      // Voice Note Script
      voice_note: {
        title: 'Voice Note Script',
        description: 'What to say in a WhatsApp voice note',
        template: `"Hey! It's [Your Name] from ${businessName}. 

Quick one - I just put together a free guide on ${niche.toLowerCase()} that I think you'd find useful. It covers fair prices, common mistakes, and has some tips that could save you money.

There's also a discount code inside if you ever need anything.

I'll send the link after this - just click and download, it's totally free. 

Chat soon!"`
      }
    };

    return Response.json({
      success: true,
      businessName,
      landingPageUrl,
      templates
    });

  } catch (error) {
    console.error('Share templates error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
