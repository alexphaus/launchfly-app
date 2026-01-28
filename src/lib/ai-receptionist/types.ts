// src/lib/ai-receptionist/types.ts
// Shared types for AI Receptionist V3

import type { BusinessContext, CustomerContext } from './system-prompt';

export type { BusinessContext, CustomerContext };

export interface WebhookContext {
    customerPhone: string;
    messageText: string;
    businessId: string | null;
    businessContext: BusinessContext | null;
    customerContext: CustomerContext | null;
    history: ConversationMessage[];
    twilioClient: any;
    fromNumber: string;
}

export interface ConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ToolCall {
    toolName: string;
    args?: Record<string, unknown>;
}

export interface ToolResult {
    toolName: string;
    output?: Record<string, unknown>;
    result?: Record<string, unknown>;
}

export interface AIResponse {
    text: string;
    toolCalls: ToolCall[];
    success: boolean;
    error?: string;
}

export interface HandlerResult {
    handled: boolean;
    response?: string;
    shouldContinue?: boolean;
}

export interface BookingInfo {
    id: string;
    slotDate: string;
    slotTime: 'morning' | 'afternoon';
    status: string;
    customerName?: string;
    address?: string;
}
