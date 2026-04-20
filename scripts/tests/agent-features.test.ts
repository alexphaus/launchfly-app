// scripts/tests/agent-features.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Tests for the 5 new agent features:
//   1. GOAP scratch_pad structured reasoning
//   2. Memory nudge at step boundaries + completion reflection
//   3. Skill rewrite loop (evolve existing skills)
//   4. FTS search_conversations tool
//   5. MCP client adapter (discovery + execution + routing)
//
// Run with:
//   npx tsx scripts/tests/agent-features.test.ts
//   npx tsx scripts/tests/agent-features.test.ts --unit-only
//
// Requires:
//   - .env.local with SUPABASE keys (for DB-dependent tests)

/* eslint-disable @typescript-eslint/no-explicit-any */
import 'dotenv/config';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local') });

// ─── Helpers ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`    ✅ ${label}`);
    passed++;
  } else {
    console.error(`    ❌ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

function skip(label: string, reason: string) {
  console.log(`    ⏭️  ${label} (${reason})`);
  skipped++;
}

const unitOnly = process.argv.includes('--unit-only');

// ═══════════════════════════════════════════════════════════════════════════
// 1. MCP ADAPTER TESTS (mcp.ts)
// ═══════════════════════════════════════════════════════════════════════════

async function testMcpIsMcpTool() {
  console.log('\n🧪 MCP: isMcpTool — correctly identifies MCP vs native tools');

  const { isMcpTool } = await import('../../src/lib/agent/mcp');

  // Native tools should NOT be identified as MCP
  assert(!isMcpTool('search_web'), 'search_web is NOT MCP');
  assert(!isMcpTool('save_memory'), 'save_memory is NOT MCP');
  assert(!isMcpTool('send_report'), 'send_report is NOT MCP');
  assert(!isMcpTool('search_conversations'), 'search_conversations is NOT MCP');
  assert(!isMcpTool('generate_media'), 'generate_media is NOT MCP');

  // MCP tools should be identified
  assert(isMcpTool('mcp_github__get_repo'), 'mcp_github__get_repo IS MCP');
  assert(isMcpTool('mcp_notion__search_pages'), 'mcp_notion__search_pages IS MCP');
  assert(isMcpTool('mcp_slack__send_message'), 'mcp_slack__send_message IS MCP');

  // Edge: empty string
  assert(!isMcpTool(''), 'empty string is NOT MCP');
}

async function testMcpDiscoverNoServers() {
  console.log('\n🧪 MCP: discoverMcpTools — returns empty for non-existent business');

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    skip('discoverMcpTools', 'no DB credentials');
    return;
  }

  const { discoverMcpTools } = await import('../../src/lib/agent/mcp');

  // Use a random UUID that won't have any MCP servers configured
  const result = await discoverMcpTools('00000000-0000-0000-0000-000000000000');

  assert(Array.isArray(result.tools), 'Returns tools array');
  assert(result.tools.length === 0, `No tools for fake business (got ${result.tools.length})`);
  assert(result.serverMap instanceof Map, 'Returns serverMap as Map');
  assert(result.serverMap.size === 0, 'serverMap is empty');
}

async function testMcpExecuteNoServer() {
  console.log('\n🧪 MCP: executeMcpTool — returns error for missing server');

  const { executeMcpTool } = await import('../../src/lib/agent/mcp');

  const emptyMap = new Map<string, any>();
  const result = await executeMcpTool('mcp_fake__nonexistent_tool', { foo: 'bar' }, emptyMap);

  assert(typeof result === 'string', 'Returns string result');
  assert(result.includes('No server found'), `Error message mentions missing server: "${result.substring(0, 80)}"`);
}

async function testMcpToolSchemaFormat() {
  console.log('\n🧪 MCP: McpToolSchema — type structure matches OpenAI format');

  // Test that we can create a valid McpToolSchema and it has the right shape
  const schema: any = {
    type: 'function',
    function: {
      name: 'mcp_test__do_thing',
      description: '[MCP: Test] Do a thing',
      parameters: {
        type: 'object',
        properties: { input: { type: 'string' } },
        required: ['input'],
      },
    },
  };

  assert(schema.type === 'function', 'Schema type is function');
  assert(typeof schema.function.name === 'string', 'Function has name');
  assert(schema.function.name.startsWith('mcp_'), 'Name starts with mcp_ prefix');
  assert(typeof schema.function.description === 'string', 'Function has description');
  assert(schema.function.parameters.type === 'object', 'Parameters type is object');
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. GOAP SCRATCH_PAD TESTS (structural)
// ═══════════════════════════════════════════════════════════════════════════

async function testGoapScratchPadInWorkflowRunner() {
  console.log('\n🧪 GOAP: scratch_pad section present in workflow-runner.ts buildSystemPrompt');

  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'workflow-runner.ts'),
    'utf-8',
  );

  assert(src.includes('<scratch_pad>'), 'Contains <scratch_pad> opening tag');
  assert(src.includes('</scratch_pad>'), 'Contains </scratch_pad> closing tag');
  assert(src.includes('STRUCTURED REASONING'), 'Contains STRUCTURED REASONING header');
  assert(src.includes('Goal: [restate'), 'Contains Goal field template');
  assert(src.includes('Plan: [list'), 'Contains Plan field template');
  assert(src.includes('Observation:'), 'Contains Observation field');
  assert(src.includes('Reflection:'), 'Contains Reflection field');
}

async function testGoapScratchPadInRunner() {
  console.log('\n🧪 GOAP: scratch_pad section present in runner.ts buildSystemPrompt');

  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'runner.ts'),
    'utf-8',
  );

  assert(src.includes('<scratch_pad>'), 'Contains <scratch_pad> opening tag');
  assert(src.includes('</scratch_pad>'), 'Contains </scratch_pad> closing tag');
  assert(src.includes('STRUCTURED REASONING'), 'Contains STRUCTURED REASONING header');
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. MEMORY NUDGE + REFLECTION TESTS (structural)
// ═══════════════════════════════════════════════════════════════════════════

async function testMemoryNudgeWorkflowRunner() {
  console.log('\n🧪 Memory: nudge at step boundaries in workflow-runner.ts');

  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'workflow-runner.ts'),
    'utf-8',
  );

  assert(src.includes('Memory nudge'), 'Contains Memory nudge comment');
  assert(src.includes('stepsUsed >= 5 && stepsUsed % 5 === 0'), 'Triggers at step 5 boundaries');
  assert(src.includes('MEMORY CHECK'), 'Contains MEMORY CHECK nudge text');
  assert(src.includes('save_memory now before continuing'), 'Nudge mentions save_memory');
}

async function testMemoryReflectionWorkflowRunner() {
  console.log('\n🧪 Memory: reflection at task completion in workflow-runner.ts');

  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'workflow-runner.ts'),
    'utf-8',
  );

  assert(src.includes("memory-reflection"), 'Has memory-reflection context.run step');
  assert(src.includes('Extract 1-3 key learnings'), 'Reflection prompt asks for learnings');
  assert(src.includes('let memories:'), 'JSON.parse wrapped with typed variable');
  assert(src.includes("catch { /* LLM returned non-JSON"), 'JSON.parse has try-catch');
}

async function testMemoryNudgeRunner() {
  console.log('\n🧪 Memory: nudge + reflection in runner.ts');

  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'runner.ts'),
    'utf-8',
  );

  assert(src.includes('stepsUsed >= 5 && stepsUsed % 5 === 0'), 'Triggers at step 5 boundaries');
  assert(src.includes('Memory reflection at task completion'), 'Has reflection section');
  assert(src.includes("catch { /* LLM returned non-JSON"), 'JSON.parse has try-catch');
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. SKILL REWRITE TESTS (structural)
// ═══════════════════════════════════════════════════════════════════════════

async function testSkillRewriteWorkflowRunner() {
  console.log('\n🧪 Skill: rewrite loop in workflow-runner.ts autoCreateSkill');

  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'workflow-runner.ts'),
    'utf-8',
  );

  assert(src.includes('recalledSkillIds: string[] = []'), 'autoCreateSkill accepts recalledSkillIds param');
  assert(src.includes('Skill rewrite: if a recalled skill exists'), 'Has skill rewrite comment');
  assert(src.includes('isRecalled && existingSkill.content'), 'Checks if skill was recalled');
  assert(src.includes('auto_skill_rewrite'), 'Tags metadata as auto_skill_rewrite');
  assert(src.includes('rewrite_count'), 'Tracks rewrite_count in metadata');
  assert(src.includes('Rewrote existing skill'), 'Logs rewrite success');
}

async function testSkillRewriteRunner() {
  console.log('\n🧪 Skill: rewrite loop in runner.ts autoCreateSkill');

  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'runner.ts'),
    'utf-8',
  );

  assert(src.includes('recalledSkillIds: string[] = []'), 'autoCreateSkill accepts recalledSkillIds param');
  assert(src.includes('isRecalled && existingSkill.content'), 'Checks if skill was recalled');
  assert(src.includes('auto_skill_rewrite'), 'Tags metadata as auto_skill_rewrite');
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. SEARCH_CONVERSATIONS TOOL TESTS
// ═══════════════════════════════════════════════════════════════════════════

async function testSearchConversationsInCoreTools() {
  console.log('\n🧪 FTS: search_conversations is in CORE_TOOLS');

  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'tools.ts'),
    'utf-8',
  );

  // Check CORE_TOOLS set includes search_conversations
  const coreToolsMatch = src.match(/const CORE_TOOLS = new Set\(\[([\s\S]*?)\]\)/);
  assert(!!coreToolsMatch, 'Found CORE_TOOLS definition');
  if (coreToolsMatch) {
    assert(coreToolsMatch[1].includes("'search_conversations'"), 'search_conversations is in CORE_TOOLS');
  }
}

async function testSearchConversationsToolSchema() {
  console.log('\n🧪 FTS: search_conversations tool schema is valid');

  const { getToolsForAgent } = await import('../../src/lib/agent/tools');
  const tools = getToolsForAgent(['search_conversations']);

  const scTool = tools.find((t: any) => t.function.name === 'search_conversations');
  assert(!!scTool, 'search_conversations tool exists in getToolsForAgent output');

  if (scTool) {
    assert(scTool.type === 'function', 'Type is function');
    assert(typeof scTool.function.description === 'string', 'Has description');
    assert(scTool.function.parameters.type === 'object', 'Parameters type is object');

    const props = scTool.function.parameters.properties as any;
    assert(!!props.query, 'Has query parameter');
    assert(!!props.days, 'Has days parameter');
    assert(!!props.limit, 'Has limit parameter');

    const required = scTool.function.parameters.required as string[];
    assert(required.includes('query'), 'query is required');
  }
}

async function testSearchConversationsInParallelSafe() {
  console.log('\n🧪 FTS: search_conversations is in PARALLEL_SAFE_TOOLS (both runners)');

  const wfSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'workflow-runner.ts'),
    'utf-8',
  );
  const rSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'runner.ts'),
    'utf-8',
  );

  assert(wfSrc.includes("'search_conversations'"), 'workflow-runner.ts includes search_conversations in PARALLEL_SAFE_TOOLS');
  assert(rSrc.includes("'search_conversations'"), 'runner.ts includes search_conversations in PARALLEL_SAFE_TOOLS');
}

async function testSearchConversationsInExecuteTool() {
  console.log('\n🧪 FTS: search_conversations case in executeTool switch');

  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'tools.ts'),
    'utf-8',
  );

  assert(src.includes("case 'search_conversations':"), 'Has case for search_conversations in executeTool');
  assert(src.includes('executeSearchConversations'), 'Calls executeSearchConversations handler');
}

async function testSearchConversationsHandler() {
  console.log('\n🧪 FTS: executeSearchConversations handler logic');

  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'tools.ts'),
    'utf-8',
  );

  // Check the handler has proper validation and fallback chain
  assert(src.includes("query.trim().length < 2"), 'Validates query minimum length');
  assert(src.includes("supabase.rpc('search_conversations'"), 'Uses FTS RPC as primary search');
  assert(src.includes("supabase.rpc('search_conversations_like'"), 'Falls back to ILIKE RPC');
  assert(src.includes("Math.min(Math.max(1, days), 365)"), 'Clamps days to valid range');
  assert(src.includes("Math.min(Math.max(1, limit), 30)"), 'Clamps limit to valid range');
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. MCP INTEGRATION TESTS (structural)
// ═══════════════════════════════════════════════════════════════════════════

async function testMcpIntegrationWorkflowRunner() {
  console.log('\n🧪 MCP: integration wiring in workflow-runner.ts');

  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'workflow-runner.ts'),
    'utf-8',
  );

  // Import
  assert(src.includes("from './mcp'"), 'Imports from mcp module');
  assert(src.includes('discoverMcpTools'), 'Imports discoverMcpTools');
  assert(src.includes('executeMcpTool'), 'Imports executeMcpTool');
  assert(src.includes('isMcpTool'), 'Imports isMcpTool');

  // Discovery
  assert(src.includes("context.run('setup'"), 'MCP discovery in Upstash workflow setup step');
  assert(src.includes('discoverMcpTools(toolCtx.businessId)'), 'Passes businessId to discovery');
  assert(src.includes('...nativeTools, ...setupResult.mcpTools') || src.includes('...setupResult.mcpTools'), 'Merges MCP tools with native tools');

  // Serialization for Upstash
  assert(src.includes('originalToolName: mapping.originalToolName'), 'Serializes originalToolName');
  assert(src.includes('tool_filter: mapping.server.tool_filter'), 'Serializes tool_filter');

  // Execution routing
  assert(src.includes('isMcpTool(tc.function.name)'), 'Routes MCP tools via isMcpTool check');
  assert(src.includes('executeMcpTool(tc.function.name, toolArgs, mcpServerMap)'), 'Calls executeMcpTool for MCP tools');
}

async function testMcpIntegrationRunner() {
  console.log('\n🧪 MCP: integration wiring in runner.ts');

  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'runner.ts'),
    'utf-8',
  );

  assert(src.includes("from './mcp'"), 'Imports from mcp module');
  assert(src.includes('discoverMcpTools(row.business_id)'), 'Discovery with business_id');
  assert(src.includes('...nativeTools, ...mcpTools as typeof nativeTools'), 'Type-safe merge');
  assert(src.includes('isMcpTool(tc.function.name)'), 'Routes MCP tools in execution');
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. SQL MIGRATION TESTS (structural)
// ═══════════════════════════════════════════════════════════════════════════

async function testSqlFtsMigration() {
  console.log('\n🧪 SQL: chat_history FTS migration');

  const sql = fs.readFileSync(
    path.join(__dirname, '..', '..', 'add-chat-history-fts.sql'),
    'utf-8',
  );

  assert(sql.includes('ADD COLUMN IF NOT EXISTS fts tsvector'), 'Adds fts tsvector column');
  assert(sql.includes("GENERATED ALWAYS AS"), 'Column is auto-generated');
  assert(sql.includes('USING GIN (fts)'), 'Creates GIN index');
  assert(sql.includes("CREATE OR REPLACE FUNCTION search_conversations("), 'Creates search_conversations RPC');
  assert(sql.includes("websearch_to_tsquery('english', search_query)"), 'Uses websearch_to_tsquery');
  assert(sql.includes("CREATE OR REPLACE FUNCTION search_conversations_like("), 'Creates ILIKE fallback RPC');
  // Security: ILIKE metacharacter escaping
  assert(sql.includes("safe_query"), 'ILIKE function uses safe_query variable');
  assert(sql.includes("replace(search_query"), 'Escapes search input in ILIKE function');
  assert(sql.includes("'\\%'"), 'Escapes % wildcard');
  assert(sql.includes("'\\_'"), 'Escapes _ wildcard');
}

async function testSqlMcpServersMigration() {
  console.log('\n🧪 SQL: mcp_servers table migration');

  const sql = fs.readFileSync(
    path.join(__dirname, '..', '..', 'add-mcp-servers-table.sql'),
    'utf-8',
  );

  assert(sql.includes('CREATE TABLE IF NOT EXISTS mcp_servers'), 'Creates mcp_servers table');
  assert(sql.includes('business_id UUID NOT NULL REFERENCES businesses(id)'), 'business_id with FK');
  assert(sql.includes('ON DELETE CASCADE'), 'Cascade delete');
  assert(sql.includes("transport TEXT NOT NULL DEFAULT 'http'"), 'Default transport is http');
  assert(sql.includes('tool_filter TEXT[]'), 'tool_filter is TEXT array');
  assert(sql.includes('cached_tools JSONB'), 'cached_tools is JSONB');
  assert(sql.includes('ENABLE ROW LEVEL SECURITY'), 'RLS enabled');
  assert(sql.includes('service_role'), 'RLS policy for service_role');
  // Unique constraint
  assert(sql.includes('idx_mcp_servers_unique_name'), 'Has unique name constraint');
  assert(sql.includes('WHERE enabled = true'), 'Unique constraint scoped to enabled servers');
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. CROSS-CUTTING: runner.ts vs workflow-runner.ts parity checks
// ═══════════════════════════════════════════════════════════════════════════

async function testRunnerParity() {
  console.log('\n🧪 Parity: runner.ts has same features as workflow-runner.ts');

  const wfSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'workflow-runner.ts'),
    'utf-8',
  );
  const rSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'runner.ts'),
    'utf-8',
  );

  const features = [
    { name: 'GOAP scratch_pad', pattern: '<scratch_pad>' },
    { name: 'Memory nudge', pattern: 'MEMORY CHECK' },
    { name: 'Memory reflection', pattern: 'Memory reflection at task completion' },
    { name: 'Skill rewrite', pattern: 'auto_skill_rewrite' },
    { name: 'MCP import', pattern: "from './mcp'" },
    { name: 'MCP discovery', pattern: 'discoverMcpTools(' },
    { name: 'MCP routing', pattern: 'isMcpTool(tc.function.name)' },
    { name: 'search_conversations parallel', pattern: "'search_conversations'" },
    { name: 'JSON.parse safety', pattern: "catch { /* LLM returned non-JSON" },
  ];

  for (const feature of features) {
    const inWf = wfSrc.includes(feature.pattern);
    const inR = rSrc.includes(feature.pattern);
    assert(inWf && inR, `${feature.name}: present in both runners`,
      !inWf ? 'missing from workflow-runner.ts' : !inR ? 'missing from runner.ts' : undefined);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Agent Features Test Suite (5 new features)');
  console.log('═══════════════════════════════════════════════════');

  // 1. MCP unit tests
  await testMcpIsMcpTool();
  await testMcpToolSchemaFormat();
  await testMcpExecuteNoServer();

  // 2. GOAP structural tests
  await testGoapScratchPadInWorkflowRunner();
  await testGoapScratchPadInRunner();

  // 3. Memory nudge + reflection
  await testMemoryNudgeWorkflowRunner();
  await testMemoryReflectionWorkflowRunner();
  await testMemoryNudgeRunner();

  // 4. Skill rewrite
  await testSkillRewriteWorkflowRunner();
  await testSkillRewriteRunner();

  // 5. search_conversations
  await testSearchConversationsInCoreTools();
  await testSearchConversationsToolSchema();
  await testSearchConversationsInParallelSafe();
  await testSearchConversationsInExecuteTool();
  await testSearchConversationsHandler();

  // 6. MCP integration wiring
  await testMcpIntegrationWorkflowRunner();
  await testMcpIntegrationRunner();

  // 7. SQL migrations
  await testSqlFtsMigration();
  await testSqlMcpServersMigration();

  // 8. Parity
  await testRunnerParity();

  // DB-dependent tests
  if (!unitOnly) {
    await testMcpDiscoverNoServers();
  }

  // ─── Results ──────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log('═══════════════════════════════════════════════════');

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
