// scripts/managed/setup.ts
// Create or update the Claude agent this app hands research to, from the
// definition kept in src/lib/copilot/managedwire.ts.
//
//   ANTHROPIC_API_KEY=... npx tsx scripts/managed/setup.ts --networking unrestricted
//   ANTHROPIC_API_KEY=... npx tsx scripts/managed/setup.ts --networking limited --hosts booking.com,airbnb.com
//
// Agents are persistent and versioned: this is setup, never the request path.
// Run it once, set the three variables it prints, and run it again whenever
// managedwire.ts changes the agent (AGENT_CONFIG_VERSION) — it updates the
// same agent in place, which publishes a new version that every new session
// picks up. Sessions already running keep the version they started on.
//
// Networking is asked for, never defaulted. Research on the open web needs the
// web tools to reach any site, and only `unrestricted` lets them; `limited`
// keeps them to the hosts you list. The agent has no shell and no file tools —
// web search, web fetch and the report tool only — so nothing in its sandbox
// can use that network on its own, and no secret is ever put in the sandbox:
// the person's accounts are vault credentials, injected outside it.
//
// It builds a team of two (managedwire.ts agentDefinition): the lead, which
// splits a big job across copies of itself and a cheaper Web reader, and the
// reader. One session's budget covers every thread.

import Anthropic from '@anthropic-ai/sdk';
import { AGENT_CONFIG_VERSION, agentDefinition, environmentDefinition, readerDefinition } from '../../src/lib/copilot/managedwire';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const networking = arg('networking');
  if (networking !== 'unrestricted' && networking !== 'limited') {
    console.error('Say which: --networking unrestricted (the web tools reach any site; needed for open research) or --networking limited --hosts a.com,b.com.');
    process.exit(2);
  }
  const hosts = (arg('hosts') ?? '').split(',').map((h) => h.trim()).filter(Boolean);
  if (networking === 'limited' && !hosts.length) console.warn('limited with no --hosts: the web tools will reach nothing, so research will find nothing.');

  const client = new Anthropic({ baseURL: process.env.COPILOT_ANTHROPIC_BASE_URL || undefined });
  const env = environmentDefinition(networking, hosts);
  const envId = process.env.COPILOT_MANAGED_ENVIRONMENT_ID;
  const environment = envId
    ? await client.beta.environments.update(envId, env as never)
    : await client.beta.environments.create(env as never);

  // Found by what this app wrote on them, so a second run updates rather than duplicates.
  const mine = new Map<string, { id: string; version: number }>();
  for await (const a of client.beta.agents.list()) {
    const m = (a as { metadata?: Record<string, string> }).metadata ?? {};
    if (m.app === 'copilot' && m.role && !mine.has(m.role) && !(a as { archived_at?: string | null }).archived_at) mine.set(m.role, { id: a.id, version: a.version });
  }

  const upsert = async (role: string, def: Record<string, unknown>) => {
    const found = mine.get(role);
    return found
      ? client.beta.agents.update(found.id, { ...def, version: found.version } as never)
      : client.beta.agents.create(def as never);
  };
  const reader = await upsert('reader', readerDefinition());
  const lead = await upsert('lead', agentDefinition(reader.id));

  console.log(`\nThe Claude agent (config version ${AGENT_CONFIG_VERSION}) is ready. Set these on the app:\n`);
  console.log(`COPILOT_MANAGED_AGENT_ID=${lead.id}`);
  console.log(`COPILOT_MANAGED_ENVIRONMENT_ID=${environment.id}`);
  console.log('ANTHROPIC_API_KEY=<the key you ran this with>');
  console.log('\nThen, in the Claude Console → Manage → Webhooks, add');
  console.log(`  ${(process.env.NEXT_PUBLIC_APP_URL || 'https://<your app>').replace(/\/$/, '')}/api/copilot/workers/claude/webhook`);
  console.log('subscribed to the session.* events, and set ANTHROPIC_WEBHOOK_SIGNING_KEY to the whsec_ secret it shows once.');
  console.log('Without the webhook the nightly pass still reads every session back; with it, results land within seconds.\n');
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
