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
const HISTORY_EXPIRY_HOURS = 192; // 8 days — covers longest automation sequences

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    toolCalls?: string; // JSON stringified tool calls for debugging
}

/**
 * Get recent conversation history for a phone number
 * Returns messages in the format expected by Vercel AI SDK
 */
export async function getConversationHistory(phone: string, businessId?: string): Promise<Message[]> {
    const phoneNormalized = phone.replace('whatsapp:', '').replace(/^\+/, '');
    
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - HISTORY_EXPIRY_HOURS);

    // FIX: Order by DESCENDING to get the *latest* messages, then reverse them
    const query = supabase
        .from('chat_history')
        .select('role, content, created_at')
        .eq('phone', phoneNormalized)
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

    // Convert to CoreMessage format
    return chronologicalMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
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
): Promise<string | null> {
    const phoneNormalized = phone.replace('whatsapp:', '').replace(/^\+/, '');

    const { data, error } = await supabase
        .from('chat_history')
        .insert({
            phone: phoneNormalized,
            business_id: businessId,
            role,
            content,
            tool_calls: toolCalls ? JSON.stringify(toolCalls) : null,
        })
        .select('id')
        .single();

    if (error) {
        console.error('❌ Failed to save message to history:', error.message);
        return null;
    }
    return data?.id || null;
}

/**
 * Clear conversation history for a phone number
 * Useful when starting a completely new flow
 */
export async function clearHistory(phone: string, businessId?: string): Promise<void> {
    const phoneNormalized = phone.replace('whatsapp:', '').replace(/^\+/, '');

    const query = supabase
        .from('chat_history')
        .delete()
        .eq('phone', phoneNormalized);

    if (businessId) {
        query.eq('business_id', businessId);
    }

    await query;
}

/**
 * Get the last business ID a customer interacted with
 */
export async function getLastBusinessId(phone: string): Promise<string | null> {
    const phoneNormalized = phone.replace('whatsapp:', '').replace(/^\+/, '');

    const { data } = await supabase
        .from('chat_history')
        .select('business_id')
        .eq('phone', phoneNormalized)
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
