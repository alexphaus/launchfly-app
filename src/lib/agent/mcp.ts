// src/lib/agent/mcp.ts
// ═══════════════════════════════════════════════════════════════════════════
// MCP (Model Context Protocol) Client Adapter
// ═══════════════════════════════════════════════════════════════════════════
//
// Connects to MCP servers via Streamable HTTP or SSE transport.
// Discovers tools, converts them to OpenAI function calling format,
// and executes tool calls through the MCP protocol.
//
// Integration:
//   - On agent init, call discoverMcpTools(businessId) to get tools
//   - Merge returned tool schemas with native AGENT_TOOLS
//   - Route mcp_* tool calls through executeMcpTool()
//
// MCP Spec Reference: https://spec.modelcontextprotocol.io/

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// ─── Types ───────────────────────────────────────────────────────────────

interface McpServerConfig {
  id: string;
  name: string;
  transport: 'http' | 'sse';
  url: string;
  api_key?: string;
  headers?: Record<string, string>;
  tool_filter?: string[];
  cached_tools?: McpToolDefinition[];
  cached_at?: string;
}

interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

interface McpJsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface McpJsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface McpToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties?: Record<string, unknown>;
      required?: string[];
    };
  };
}

// ─── Constants ───────────────────────────────────────────────────────────

const MCP_REQUEST_TIMEOUT_MS = 30_000;
const MCP_TOOL_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MCP_TOOL_PREFIX = 'mcp_'; // Prefix for MCP tools to avoid name collisions

// ─── JSON-RPC Helpers ────────────────────────────────────────────────────

let rpcIdCounter = 1;

function buildJsonRpc(method: string, params?: Record<string, unknown>): McpJsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id: rpcIdCounter++,
    method,
    params,
  };
}

// ─── MCP Transport: Streamable HTTP ──────────────────────────────────────

async function mcpHttpRequest(
  serverUrl: string,
  request: McpJsonRpcRequest,
  apiKey?: string,
  extraHeaders?: Record<string, string>,
): Promise<McpJsonRpcResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(extraHeaders || {}),
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MCP_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`MCP server returned ${response.status}: ${await response.text().catch(() => 'unknown')}`);
    }

    const contentType = response.headers.get('content-type') || '';

    // Handle SSE streaming response (some servers use SSE even for HTTP transport)
    if (contentType.includes('text/event-stream')) {
      return await parseSseResponse(response, request.id);
    }

    // Standard JSON response
    const body = await response.json() as McpJsonRpcResponse;
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function parseSseResponse(response: Response, expectedId: number): Promise<McpJsonRpcResponse> {
  const text = await response.text();
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data) as McpJsonRpcResponse;
        if (parsed.jsonrpc === '2.0' && parsed.id === expectedId) {
          return parsed;
        }
      } catch {
        // Skip non-JSON SSE events
      }
    }
  }

  throw new Error('No valid JSON-RPC response found in SSE stream');
}

// ─── Tool Discovery ─────────────────────────────────────────────────────

/**
 * Discover tools from all enabled MCP servers for a business.
 * Returns OpenAI-compatible tool schemas with `mcp_` prefix.
 * Uses cached tools when available and fresh.
 */
export async function discoverMcpTools(businessId: string): Promise<{
  tools: McpToolSchema[];
  serverMap: Map<string, McpServerConfig>;
}> {
  const supabase = getSupabase();
  const tools: McpToolSchema[] = [];
  const serverMap = new Map<string, McpServerConfig>();

  try {
    const { data: servers, error } = await supabase
      .from('mcp_servers')
      .select('*')
      .eq('business_id', businessId)
      .eq('enabled', true);

    if (error || !servers?.length) {
      return { tools, serverMap };
    }

    for (const server of servers as McpServerConfig[]) {
      try {
        let mcpTools: McpToolDefinition[];

        // Use cache if fresh
        const cacheAge = server.cached_at
          ? Date.now() - new Date(server.cached_at).getTime()
          : Infinity;

        if (server.cached_tools?.length && cacheAge < MCP_TOOL_CACHE_TTL_MS) {
          mcpTools = server.cached_tools;
        } else {
          // Discover tools via MCP protocol
          mcpTools = await listToolsFromServer(server);

          // Cache the discovered tools
          await supabase.from('mcp_servers').update({
            cached_tools: mcpTools,
            cached_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', server.id);
        }

        // Apply tool filter if configured
        if (server.tool_filter?.length) {
          const allowed = new Set(server.tool_filter);
          mcpTools = mcpTools.filter(t => allowed.has(t.name));
        }

        // Convert to OpenAI format with prefix
        for (const tool of mcpTools) {
          const prefixedName = `${MCP_TOOL_PREFIX}${server.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}__${tool.name}`;

          // OpenAI tool names have a 64-char limit
          const safeName = prefixedName.substring(0, 64);

          tools.push({
            type: 'function',
            function: {
              name: safeName,
              description: `[MCP: ${server.name}] ${tool.description || tool.name}`.substring(0, 1024),
              parameters: tool.inputSchema || { type: 'object', properties: {} },
            },
          });

          // Map the prefixed name back to the server + original tool name
          serverMap.set(safeName, server);
        }

        console.log(`[mcp] Discovered ${mcpTools.length} tools from "${server.name}" (${server.url})`);
      } catch (err) {
        console.warn(`[mcp] Failed to discover tools from "${server.name}":`, err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.warn('[mcp] Error loading MCP servers:', err);
  }

  return { tools, serverMap };
}

async function listToolsFromServer(server: McpServerConfig): Promise<McpToolDefinition[]> {
  // First, initialize the session
  const initResponse = await mcpHttpRequest(
    server.url,
    buildJsonRpc('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'launchfly-agent', version: '1.0.0' },
    }),
    server.api_key,
    server.headers,
  );

  if (initResponse.error) {
    throw new Error(`MCP init failed: ${initResponse.error.message}`);
  }

  // Then list tools
  const toolsResponse = await mcpHttpRequest(
    server.url,
    buildJsonRpc('tools/list'),
    server.api_key,
    server.headers,
  );

  if (toolsResponse.error) {
    throw new Error(`MCP tools/list failed: ${toolsResponse.error.message}`);
  }

  const result = toolsResponse.result as { tools?: McpToolDefinition[] } | undefined;
  return result?.tools || [];
}

// ─── Tool Execution ──────────────────────────────────────────────────────

/**
 * Execute an MCP tool call. Extracts the server and original tool name
 * from the prefixed tool name, then sends a tools/call JSON-RPC request.
 */
export async function executeMcpTool(
  prefixedToolName: string,
  args: Record<string, unknown>,
  serverMap: Map<string, McpServerConfig>,
): Promise<string> {
  const server = serverMap.get(prefixedToolName);
  if (!server) {
    return `MCP tool error: No server found for tool "${prefixedToolName}". The MCP server may have been disconnected.`;
  }

  // Extract original tool name from the prefixed name
  // Format: mcp_{serverName}__{originalToolName}
  const originalToolName = extractOriginalToolName(prefixedToolName, server.name);

  try {
    const response = await mcpHttpRequest(
      server.url,
      buildJsonRpc('tools/call', {
        name: originalToolName,
        arguments: args,
      }),
      server.api_key,
      server.headers,
    );

    if (response.error) {
      return `MCP tool error (${originalToolName}): ${response.error.message}`;
    }

    // MCP tool results come as content array
    const result = response.result as { content?: Array<{ type: string; text?: string }> } | undefined;
    if (result?.content?.length) {
      return result.content
        .map(c => c.text || JSON.stringify(c))
        .join('\n')
        .substring(0, 6000);
    }

    // Fallback: stringify the raw result
    return JSON.stringify(response.result).substring(0, 6000);
  } catch (err) {
    return `MCP tool failed (${originalToolName}): ${err instanceof Error ? err.message : String(err)}`;
  }
}

function extractOriginalToolName(prefixedName: string, serverName: string): string {
  const serverSlug = serverName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const prefix = `${MCP_TOOL_PREFIX}${serverSlug}__`;
  if (prefixedName.startsWith(prefix)) {
    return prefixedName.substring(prefix.length);
  }
  // Fallback: strip the generic mcp_ prefix and first __ segment
  const withoutPrefix = prefixedName.replace(/^mcp_/, '');
  const doubleUnderIdx = withoutPrefix.indexOf('__');
  return doubleUnderIdx >= 0 ? withoutPrefix.substring(doubleUnderIdx + 2) : withoutPrefix;
}

/**
 * Check if a tool name is an MCP tool (starts with mcp_ prefix).
 */
export function isMcpTool(toolName: string): boolean {
  return toolName.startsWith(MCP_TOOL_PREFIX);
}
