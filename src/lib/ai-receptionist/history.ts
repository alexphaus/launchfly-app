// src/lib/ai-receptionist/history.ts
// Conversation History Manager
// Stores and retrieves message history per customer for context

import { createClient } from '@supabase/supabase-js';

// Define message type compatible with AI SDK
type Message = { role: 'user' | 'assistant'; content: string };

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

// How many messages to keep in context
const MAX_HISTORY_LENGTH = 50;
// How old messages can be before we start fresh (24 hours)
const HISTORY_EXPIRY_HOURS = 24;

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    toolCalls?: string; // JSON stringified tool calls for debugging
}

/**
 * Get recent conversation history for a phone number
 * Returns messages in the format expected by Vercel AI SDK
 * 
 * COMPATIBILITY NOTE: Mapped to 'conversation_history' table (V2 schema)
 * Mappings: 
 * - sender: 'customer' -> role: 'user'
 * - sender: 'bot' -> role: 'assistant'
 * - message -> content
 */
export async function getConversationHistory(phone: string, businessId?: string): Promise<Message[]> {
    const phoneNormalized = phone.replace('whatsapp:', '').replace(/^\+/, '');
    
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - HISTORY_EXPIRY_HOURS);

    // FIX: Order by DESCENDING to get the *latest* messages, then reverse them
    const query = supabase
        .from('conversation_history')
        .select('sender, message, created_at') // V2 columns
        .or(`customer_phone.eq.${phoneNormalized},customer_phone.eq.+${phoneNormalized}`)
        .gte('created_at', cutoffTime.toISOString())
        .order('created_at', { ascending: false }) // Get NEWEST first
        .limit(MAX_HISTORY_LENGTH);

    if (businessId) {
        query.eq('business_id', businessId);
    }

    const { data: messages, error } = await query;

    if (error || !messages) {
        console.log('📜 No history found or error:', error?.message);
        return [];
    }

    // Reverse to put back in chronological order (oldest -> newest) for the AI
    const chronologicalMessages = messages.reverse();

    // Convert to CoreMessage format with mapping
    return chronologicalMessages.map(msg => ({
        role: msg.sender === 'customer' ? 'user' : 'assistant',
        content: msg.message,
    }));
}

/**
 * Save a message to conversation history
 */
export async function saveMessage(
    phone: string,
    role: 'user' | 'assistant',
    content: string,
    businessId?: string,
    toolCalls?: object[],
): Promise<void> {
    // V2: Stores standard normalized phone (usually +123...)
    // Ensure we store it consistently
    const phoneWithPlus = phone.startsWith('+') ? phone : `+${phone.replace(/^whatsapp:/, '')}`;

    const { error } = await supabase
        .from('conversation_history')
        .insert({
            customer_phone: phoneWithPlus,
            business_id: businessId,
            sender: role === 'user' ? 'customer' : 'bot',
            message: content,
            // tool_calls not supported in V2 schema yet, ignoring
        });

    if (error) {
        console.error('❌ Failed to save message to history:', error.message);
    }
}

/**
 * Clear conversation history for a phone number
 * Useful when starting a completely new flow
 */
export async function clearHistory(phone: string, businessId?: string): Promise<void> {
    // V2 implementation
    // Generally we don't clear history in the DB, just ignore old ones
    // But for completeness:
    /*
    const phoneWithPlus = phone.startsWith('+') ? phone : `+${phone.replace(/^whatsapp:/, '')}`;
    const query = supabase
        .from('conversation_history')
        .delete()
        .eq('customer_phone', phoneWithPlus);

    if (businessId) {
        query.eq('business_id', businessId);
    }

    await query;
    */
}

/**
 * Get the last business ID a customer interacted with
 */
export async function getLastBusinessId(phone: string): Promise<string | null> {
    const phoneWithPlus = phone.startsWith('+') ? phone : `+${phone.replace(/^whatsapp:/, '')}`;

    const { data } = await supabase
        .from('conversation_history')
        .select('business_id')
        .eq('customer_phone', phoneWithPlus)
        .not('business_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    return data?.business_id || null;
}

// ============================================================
// SQL Migration for chat_history table
// Run this in Supabase SQL editor to create the table
// ============================================================
/*
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    tool_calls JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_chat_history_phone ON chat_history(phone);
CREATE INDEX IF NOT EXISTS idx_chat_history_phone_business ON chat_history(phone, business_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at);

-- Auto-cleanup old messages (optional - run as a cron job)
-- DELETE FROM chat_history WHERE created_at < NOW() - INTERVAL '7 days';
*/
