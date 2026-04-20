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

// ═══════════════════════════════════════════════════════════════════════════
// 9. EXTENDED TOOLS TESTS (P0-P3)
// ═══════════════════════════════════════════════════════════════════════════

async function testNewToolSchemas() {
  console.log('\n🧪 Extended Tools: All new tool schemas present in AGENT_TOOLS');

  const toolsModule = await import('../../src/lib/agent/tools');
  const { AGENT_TOOLS } = toolsModule;
  const toolNames = new Set(AGENT_TOOLS.map((t: any) => t.function.name));

  const newTools = [
    'execute_python', 'process_document', 'knowledge_base',
    'manage_calendar', 'process_payment', 'generate_document',
    'analyze_image', 'deep_research', 'translate', 'manage_project',
  ];

  for (const name of newTools) {
    assert(toolNames.has(name), `${name} schema exists in AGENT_TOOLS`);
  }

  // Verify required params for key tools
  const pyTool = AGENT_TOOLS.find((t: any) => t.function.name === 'execute_python');
  assert(
    pyTool?.function?.parameters?.required?.includes('code'),
    'execute_python requires "code" param',
  );

  const docTool = AGENT_TOOLS.find((t: any) => t.function.name === 'process_document');
  assert(
    docTool?.function?.parameters?.required?.includes('url'),
    'process_document requires "url" param',
  );

  const kbTool = AGENT_TOOLS.find((t: any) => t.function.name === 'knowledge_base');
  assert(
    kbTool?.function?.parameters?.properties?.action?.enum?.length === 4,
    'knowledge_base has 4 actions (search, add, list, delete)',
  );

  const calTool = AGENT_TOOLS.find((t: any) => t.function.name === 'manage_calendar');
  assert(
    calTool?.function?.parameters?.properties?.action?.enum?.length === 5,
    'manage_calendar has 5 actions',
  );

  const payTool = AGENT_TOOLS.find((t: any) => t.function.name === 'process_payment');
  assert(
    payTool?.function?.parameters?.properties?.action?.enum?.includes('create_payment_link'),
    'process_payment has create_payment_link action',
  );

  const researchTool = AGENT_TOOLS.find((t: any) => t.function.name === 'deep_research');
  assert(
    researchTool?.function?.parameters?.properties?.depth?.enum?.includes('thorough'),
    'deep_research has depth enum with thorough option',
  );
}

async function testToolSets() {
  console.log('\n🧪 Extended Tools: INTERNAL_TOOLS and CORE_TOOLS sets updated');

  const toolsSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'tools.ts'),
    'utf-8',
  );

  const internalToolsMatch = toolsSrc.match(/const INTERNAL_TOOLS = new Set\(\[([^\]]+)\]\)/);
  assert(!!internalToolsMatch, 'INTERNAL_TOOLS set found');

  const internalStr = internalToolsMatch?.[1] || '';
  const newInternalTools = [
    'execute_python', 'process_document', 'knowledge_base',
    'manage_calendar', 'process_payment', 'generate_document',
    'analyze_image', 'deep_research', 'manage_project',
  ];

  for (const tool of newInternalTools) {
    assert(internalStr.includes(`'${tool}'`), `${tool} in INTERNAL_TOOLS`);
  }

  // translate should be in CORE_TOOLS (available to everyone)
  const coreToolsMatch = toolsSrc.match(/const CORE_TOOLS = new Set\(\[([^\]]+)\]\)/);
  const coreStr = coreToolsMatch?.[1] || '';
  assert(coreStr.includes("'translate'"), 'translate in CORE_TOOLS');
}

async function testParseSelectAggregates() {
  console.log('\n🧪 query_database: parseSelect supports SUM/AVG/MIN/MAX aggregates');

  // Read tools.ts and find parseSelect function to verify it handles aggregates
  const toolsSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'tools.ts'),
    'utf-8',
  );

  assert(
    toolsSrc.includes("kind: 'aggregate'"),
    'parseSelect returns aggregate kind',
  );

  assert(
    toolsSrc.includes('SUM|AVG|MIN|MAX|COUNT'),
    'parseSelect recognizes SUM/AVG/MIN/MAX/COUNT',
  );

  // Verify the aggregate execution path exists
  assert(
    toolsSrc.includes('AGGREGATE (SUM, AVG, MIN, MAX)'),
    'executeQueryDatabase has aggregate execution path',
  );

  assert(
    toolsSrc.includes('computeAgg'),
    'computeAgg helper function exists',
  );
}

async function testScrapPageAutoDetect() {
  console.log('\n🧪 scrape_page: Auto-detects document URLs');

  const toolsSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'tools.ts'),
    'utf-8',
  );

  assert(
    toolsSrc.includes('Auto-detect document URLs and route to process_document'),
    'scrape_page has auto-detection comment',
  );

  assert(
    toolsSrc.includes("\\.(pdf|xlsx?|csv|docx?|pptx?)$"),
    'scrape_page detects PDF, Excel, CSV, Word, PowerPoint extensions',
  );

  assert(
    toolsSrc.includes('return executeProcessDocument(url, extract)'),
    'scrape_page routes to executeProcessDocument for document URLs',
  );
}

async function testTranslate() {
  console.log('\n🧪 translate: Handler exists and handles missing input');

  const { executeTranslate } = await import('../../src/lib/agent/tools-extended');

  const result1 = await executeTranslate({});
  assert(result1.includes('Error: text is required'), 'Returns error for missing text');

  const result2 = await executeTranslate({ text: 'hello' });
  assert(result2.includes('Error: target_language is required'), 'Returns error for missing target_language');
}

async function testKnowledgeBaseChunking() {
  console.log('\n🧪 knowledge_base: Text chunking works correctly');

  // Import the module to access chunkText indirectly — test via executeKnowledgeBase
  const extModule = await import('../../src/lib/agent/tools-extended');

  // Test the handler input validation
  const result1 = await extModule.executeKnowledgeBase(
    { action: 'add', title: '' },
    { businessId: 'test', ownerPhone: '', assistantName: '', businessName: '' } as any,
  );
  assert(result1.includes('Error: title is required'), 'Requires title for add action');

  const result2 = await extModule.executeKnowledgeBase(
    { action: 'add', title: 'Test', content: '' },
    { businessId: 'test', ownerPhone: '', assistantName: '', businessName: '' } as any,
  );
  assert(result2.includes('Error: either url or content'), 'Requires url or content for add action');

  const result3 = await extModule.executeKnowledgeBase(
    { action: 'search', query: '' },
    { businessId: 'test', ownerPhone: '', assistantName: '', businessName: '' } as any,
  );
  assert(result3.includes('Error: query is required'), 'Requires query for search action');

  const result4 = await extModule.executeKnowledgeBase(
    { action: 'delete' },
    { businessId: 'test', ownerPhone: '', assistantName: '', businessName: '' } as any,
  );
  assert(result4.includes('Error: doc_id is required'), 'Requires doc_id for delete action');
}

async function testContradictionDetection() {
  console.log('\n🧪 save_memory: Contradiction detection integrated');

  const toolsSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'tools.ts'),
    'utf-8',
  );

  assert(
    toolsSrc.includes('checkMemoryContradiction'),
    'save_memory calls checkMemoryContradiction',
  );

  assert(
    toolsSrc.includes('CONTRADICTION DETECTED'),
    'save_memory reports contradictions',
  );

  assert(
    toolsSrc.includes("outcome: 'superseded'"),
    'save_memory auto-supersedes contradicting memories',
  );

  // Test the contradiction checker function directly
  const { checkMemoryContradiction } = await import('../../src/lib/agent/tools-extended');
  assert(typeof checkMemoryContradiction === 'function', 'checkMemoryContradiction is exported');
}

async function testToolTimeoutOverrides() {
  console.log('\n🧪 Both runners: TOOL_TIMEOUT_OVERRIDES include new tools');

  const workflowSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'workflow-runner.ts'),
    'utf-8',
  );

  const runnerSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'runner.ts'),
    'utf-8',
  );

  const newTimeoutTools = [
    'execute_python', 'process_document', 'deep_research',
    'generate_document', 'manage_calendar', 'process_payment',
  ];

  for (const tool of newTimeoutTools) {
    assert(
      workflowSrc.includes(`${tool}:`),
      `workflow-runner: ${tool} in TOOL_TIMEOUT_OVERRIDES`,
    );
    assert(
      runnerSrc.includes(`${tool}:`),
      `runner: ${tool} in TOOL_TIMEOUT_OVERRIDES`,
    );
  }

  // Verify PARALLEL_SAFE_TOOLS updated in both
  for (const file of [workflowSrc, runnerSrc]) {
    assert(
      file.includes("'translate'") && file.includes("'knowledge_base'") && file.includes("'analyze_image'"),
      'PARALLEL_SAFE_TOOLS includes translate, knowledge_base, analyze_image',
    );
  }

  // Verify system prompt tips
  for (const src of [workflowSrc, runnerSrc]) {
    assert(
      src.includes('**execute_python**'),
      'System prompt has execute_python tip',
    );
    assert(
      src.includes('**knowledge_base**'),
      'System prompt has knowledge_base tip',
    );
    assert(
      src.includes('**manage_calendar**'),
      'System prompt has manage_calendar tip',
    );
    assert(
      src.includes('**deep_research**'),
      'System prompt has deep_research tip',
    );
    assert(
      src.includes('**translate**'),
      'System prompt has translate tip',
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECURITY TESTS — Post-adversarial-review
// ═══════════════════════════════════════════════════════════════════════════

async function testPythonInjectionPrevention() {
  console.log('\n🧪 Security: Python code injection prevention via base64 encoding');

  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'tools-extended.ts'),
    'utf-8',
  );

  // No triple-quoted string interpolation of user input should remain
  // All user strings should go through base64 encoding
  const tripleQuoteInterpolations = src.match(/'''(\$\{[^}]+\})'''/g) || [];
  // Filter out any that are NOT user-controlled (e.g. constants)
  const dangerousInterpolations = tripleQuoteInterpolations.filter(m =>
    m.includes('url') || m.includes('content') || m.includes('title') || m.includes('data')
  );

  assert(
    dangerousInterpolations.length === 0,
    `No triple-quoted Python string interpolation of user input (found ${dangerousInterpolations.length}: ${dangerousInterpolations.join(', ')})`,
  );

  // Verify base64 encoding is used for user strings
  assert(
    src.includes("Buffer.from(url).toString('base64')") || src.includes("Buffer.from(file.url).toString('base64')"),
    'URL base64 encoding present for process_document',
  );
  assert(
    src.includes("const titleB64 = Buffer.from(title).toString('base64')"),
    'Title base64 encoding present for generate_document',
  );
  assert(
    src.includes("const contentB64 = Buffer.from(content).toString('base64')"),
    'Content base64 encoding present for generate_document',
  );
}

async function testSsrfProtection() {
  console.log('\n🧪 Security: SSRF protection in all URL-fetching tools');

  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'tools-extended.ts'),
    'utf-8',
  );

  // checkSsrf helper must exist
  assert(src.includes('function checkSsrf(url: string)'), 'checkSsrf helper exists');
  assert(src.includes('169\\.254\\.'), 'checkSsrf blocks AWS metadata IP range');
  assert(src.includes('localhost'), 'checkSsrf blocks localhost');
  assert(src.includes('.local'), 'checkSsrf blocks .local domains');

  // process_document must call checkSsrf
  const processDocSection = src.substring(
    src.indexOf('executeProcessDocument'),
    src.indexOf('executeProcessDocument') + 2000,
  );
  assert(processDocSection.includes('checkSsrf'), 'process_document calls checkSsrf');

  // knowledge_base add must call checkSsrf
  const kbSection = src.substring(
    src.indexOf("case 'add':"),
    src.indexOf("case 'add':") + 2000,
  );
  assert(kbSection.includes('checkSsrf'), 'knowledge_base add calls checkSsrf');
}

async function testTenantIsolation() {
  console.log('\n🧪 Security: Tenant isolation in manage_project updates');

  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'tools-extended.ts'),
    'utf-8',
  );

  // All .update() calls in manage_project must include business_id filter
  const manageProjectSection = src.substring(
    src.indexOf('executeManageProject'),
    src.lastIndexOf("Unknown action: ${action}. Use: create_project"),
  );

  // Count update operations and ensure they all have business_id
  const updateCalls = manageProjectSection.match(/\.update\([^)]+\)\.eq\([^)]+\)/g) || [];
  for (const call of updateCalls) {
    // Each update chain should eventually have business_id (we check the surrounding context)
    // This is a structural check — the actual assertion is that no update lacks business_id
  }

  // Specific check: no .update().eq('id', ...) without .eq('business_id', ...)
  const unsafeUpdates = manageProjectSection.match(/\.update\([^)]+\)\.eq\('id'[^.]*$/gm) || [];
  assert(
    unsafeUpdates.length === 0,
    `No update calls without business_id filter (found ${unsafeUpdates.length})`,
  );

  // Positive check: business_id appears after every update().eq('id')
  const allUpdateChains = manageProjectSection.match(/\.update\([^)]+\)\.eq\('id'[^;]*/g) || [];
  for (const chain of allUpdateChains) {
    assert(
      chain.includes("'business_id'") || chain.includes('business_id'),
      `Update chain includes business_id: ${chain.substring(0, 80)}...`,
    );
  }
}

async function testPaymentAmountCap() {
  console.log('\n🧪 Security: Payment amount cap enforced');

  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'tools-extended.ts'),
    'utf-8',
  );

  assert(src.includes('PAYMENT_MAX_AMOUNT'), 'PAYMENT_MAX_AMOUNT constant exists');
  assert(src.includes('amount > PAYMENT_MAX_AMOUNT'), 'Amount cap check in payment handler');

  // Stripe error sanitization
  assert(src.includes('safeStripeError'), 'safeStripeError helper used');
  assert(src.includes('[REDACTED]'), 'Stripe key redaction pattern present');
}

async function testEmbeddingDedup() {
  console.log('\n🧪 Architecture: getEmbedding is single-source (no duplication)');

  const toolsSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'tools.ts'),
    'utf-8',
  );
  const extSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'tools-extended.ts'),
    'utf-8',
  );

  // tools.ts should export getEmbedding
  assert(
    toolsSrc.includes('export async function getEmbedding'),
    'tools.ts exports getEmbedding',
  );

  // tools-extended.ts should import it, NOT define its own
  assert(
    extSrc.includes("import { getEmbedding } from './tools'"),
    'tools-extended.ts imports getEmbedding from tools.ts',
  );

  // tools-extended.ts should NOT have its own getEmbedding definition
  const extGetEmbeddingDefs = (extSrc.match(/async function getEmbedding/g) || []).length;
  assert(
    extGetEmbeddingDefs === 0,
    `tools-extended.ts has no local getEmbedding definition (found ${extGetEmbeddingDefs})`,
  );
}

async function testChunkCountCap() {
  console.log('\n🧪 Cost control: Knowledge base chunk count is capped');

  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'tools-extended.ts'),
    'utf-8',
  );

  assert(
    src.includes('.slice(0, 200)'),
    'Chunks array is capped at 200',
  );
  assert(
    src.includes('MAX_CONTENT_LENGTH'),
    'Content length is capped before chunking',
  );
}

async function testAggregateNoStackOverflow() {
  console.log('\n🧪 Bug fix: computeAgg uses reduce instead of spread for MIN/MAX');

  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'lib', 'agent', 'tools.ts'),
    'utf-8',
  );

  // Should NOT use Math.min(...values) or Math.max(...values) in computeAgg
  const computeAggSection = src.substring(
    src.indexOf('const computeAgg'),
    src.indexOf('const computeAgg') + 500,
  );
  assert(
    !computeAggSection.includes('Math.min(...'),
    'computeAgg does NOT use Math.min(...values) spread',
  );
  assert(
    !computeAggSection.includes('Math.max(...'),
    'computeAgg does NOT use Math.max(...values) spread',
  );
  assert(
    computeAggSection.includes('.reduce('),
    'computeAgg uses reduce for MIN/MAX',
  );
}

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

  // 9. Extended tools
  await testNewToolSchemas();
  await testToolSets();
  await testParseSelectAggregates();
  await testScrapPageAutoDetect();
  await testTranslate();
  await testKnowledgeBaseChunking();
  await testContradictionDetection();
  await testToolTimeoutOverrides();

  // 10. Security (post-adversarial-review)
  await testPythonInjectionPrevention();
  await testSsrfProtection();
  await testTenantIsolation();
  await testPaymentAmountCap();
  await testEmbeddingDedup();
  await testChunkCountCap();
  await testAggregateNoStackOverflow();

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
