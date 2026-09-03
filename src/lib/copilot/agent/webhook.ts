// src/lib/copilot/agent/webhook.ts
// External agent over HTTP. This is the seam for a dedicated, vertical agent
// service (with search, scraping, listing ranking) that lives outside this app.
//
//   POST $COPILOT_AGENT_URL
//   Authorization: Bearer $COPILOT_AGENT_SECRET
//   { "kind": "daily_brief", "pack": ContextPack }
//   -> BriefOutput JSON (or { "brief": BriefOutput })

import type { BriefOutput, ContextPack, OpportunityAgent } from '../types';
import { normalizeBrief } from './schema';

export class WebhookAgent implements OpportunityAgent {
  readonly name = 'webhook' as const;
  readonly model: string;

  constructor(private url: string, private secret?: string, private timeoutMs = 90_000) {
    this.model = new URL(url).host;
  }

  async generateBrief(pack: ContextPack): Promise<BriefOutput> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(this.secret ? { authorization: `Bearer ${this.secret}` } : {}) },
        body: JSON.stringify({ kind: 'daily_brief', pack }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`agent ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const json = (await res.json()) as Record<string, unknown>;
      return normalizeBrief(json.brief ?? json);
    } finally {
      clearTimeout(t);
    }
  }
}
