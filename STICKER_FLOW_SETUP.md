# Launchfly Smart Sticker Flow Setup

## Overview

The **Smart Sticker Flow** allows service businesses (Aircon, Plumbing, Pest Control, etc.) to use QR code stickers that customers scan to instantly book appointments via WhatsApp. 

**Key Features:**
- 🤖 AI-powered booking bot handles the entire conversation
- 📍 Customers can send location pins for address
- 📅 Smart slot suggestions based on current time
- 📱 Owner gets instant WhatsApp notification when booking is confirmed
- 🔄 Universal flow adapts to any service niche

## How It Works

```
Customer Scans QR → WhatsApp Opens → Launchfly Bot Responds → 
Customer Selects Service → Provides Details → Picks Slot → Confirms Address →
✅ Booking Created → Owner Notified
```

## Environment Setup

Add this to your `.env.local` or production environment:

```env
# Launchfly WhatsApp Bot Number (Twilio WhatsApp-enabled number)
# This is the central AI receptionist that handles all sticker scans
NEXT_PUBLIC_LAUNCHFLY_WHATSAPP=14155238886

# Twilio Configuration (for sending messages)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# OpenAI for intent classification
OPENAI_API_KEY=your_openai_key
```

## QR Code Generation

The QR code is generated from the Command Center dashboard (`/command/[businessId]`):

1. Click the **QR Code** button in the dashboard
2. Downloads a professional maintenance sticker PNG
3. QR encodes: `https://wa.me/{LAUNCHFLY_BOT}?text=Hi, I scanned the Service Sticker [BIZ:{businessId}]`

The `[BIZ:id]` tag allows the bot to identify which business the customer is contacting.

## Conversation Flow

### Step 1: VIP Greeting
When customer scans and sends the trigger message, they receive:

```
Welcome back! 👋
Since you scanned the sticker, I have pulled up your Priority Record. 🛠️

What do you need help with today?

1️⃣ Book Cleaning 💦
2️⃣ Not Cooling / Repair 🔧
3️⃣ Check Price 💰

Reply with 1, 2, or 3
```

### Step 2: Service Selection
Based on selection:
- **Option 1**: Ask how many units
- **Option 2**: Ask for photo/description of issue
- **Option 3**: Show price list

### Step 3: Collect Address
Bot asks for address (supports location pin 📍)

### Step 4: Slot Selection
Bot shows available time slots:
```
When works best for you?

1️⃣ Today 2pm - 4pm
2️⃣ Tomorrow 9am - 11am
3️⃣ Wed 22 Jan 2pm - 4pm

Reply with 1, 2, or 3
```

### Step 5: Confirmation
Bot confirms booking and notifies owner:

```
All set! ✅

*Booking Confirmed:*
👤 Name: John
📅 Date: Tomorrow 9am - 11am
🛠️ Service: Aircon Cleaning (2 units)
📍 Location: 123 Main St, Kuala Lumpur
💰 Estimate: RM 240

Our team from Moon Jatt AC will WhatsApp you 30 mins before arrival.
```

## Niche-Specific Configurations

The flow automatically adapts based on business niche:

### Aircon Service
- Cleaning: RM 120/unit
- Repair inspection: RM 80

### Pest Control
- General spray: RM 150/visit
- Termite: Quote on inspection

### Plumbing
- Visit fee: RM 80 (waived if repaired)

### Custom Niche
Use the `generateUniversalSystemPrompt()` function to create a custom AI persona.

## Adding New Service Types

Edit `src/lib/sticker-flow-templates.ts`:

```typescript
export const SERVICE_FLOW_CONFIGS: Record<string, StickerFlowConfig> = {
    // Add new service type
    landscaping: {
        serviceName: 'Landscaping Service',
        cleaningLabel: 'Garden Maintenance 🌿',
        repairLabel: 'Tree Removal / Repair 🪓',
        priceLabel: 'Check Price 💰',
        quantifierQuestion: 'What is the garden size? (sqm)',
        pricePerUnit: 50,
        unitLabel: 'sqm',
        repairInspectionFee: 100,
        currency: 'RM'
    },
    // ...
};
```

## Testing the Flow

1. Download the QR sticker from Command Center
2. Scan with your phone's camera
3. WhatsApp should open with pre-filled message
4. Send the message and verify bot responds
5. Complete the booking flow
6. Verify owner receives notification

## Troubleshooting

### QR doesn't open WhatsApp
- Ensure WhatsApp is installed
- Try clicking the QR result link manually

### Bot doesn't respond
- Check Twilio webhook is configured correctly
- Verify `TWILIO_WHATSAPP_NUMBER` matches the number in Twilio console
- Check server logs for errors

### Owner not receiving notifications
- Verify `whatsapp_number` is set in business record
- Check Twilio message logs for delivery status

### Wrong business context
- Ensure QR was generated from correct business dashboard
- Check `[BIZ:id]` is present in the trigger message

## API Endpoints

- **Webhook**: `POST /api/webhook/twilio` - Receives all incoming WhatsApp messages
- **Command Center**: `GET /command/[businessId]` - Dashboard with QR download

## Files Modified

- `src/components/CommandCenter.js` - QR generation with business context
- `src/lib/sticker-flow-templates.ts` - Flow configs and message templates
- `src/app/api/webhook/twilio/route.ts` - Message handling logic
- `src/lib/ai-intent.ts` - Intent classification with STICKER_SCAN support
