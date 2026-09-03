// scripts/tests/foundation-scoring.test.ts
// ─── Unit tests for Foundation's deterministic scorer and capacity model ───
// Run with: npx tsx scripts/tests/foundation-scoring.test.ts
//
// No network, no database — these are the pure functions the "92% MATCH" badge
// rests on, so they must be provable at this level.

import { scoreOpportunity, scoreConfidence, WEIGHTS } from '../../src/lib/foundation/scoring';
import {
  CAPACITY, capacityFit, capacityForMinutes, fitPlanToCapacity, rerankForCapacity,
} from '../../src/lib/foundation/capacity';
import type { FoundationGoal, FoundationSkill } from '../../src/lib/foundation/types';

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
  } else {
    console.error(`  ❌ ${label}`);
    process.exitCode = 1;
  }
}

const NOW = new Date('2026-09-03T09:00:00Z');

function skill(slug: string, label: string, proficiency: number): FoundationSkill {
  return {
    id: slug, user_id: 'u', slug, label, proficiency, source: 'declared',
    evidence: [], demand_count: 0, matched_count: 0, last_seen_at: null,
  };
}

function goal(over: Partial<FoundationGoal>): FoundationGoal {
  return {
    id: 'g', user_id: 'u', key: 'k', label: 'Monthly revenue', kind: 'revenue',
    target_value: 2000, current_value: 1500, unit: 'currency', period: 'month',
    priority: 1, note: null, status: 'active', ...over,
  };
}

const SKILLS = [skill('n8n', 'n8n workflow architecture', 90), skill('whatsapp-api', 'WhatsApp API', 70)];

function baseInput(over: Record<string, unknown> = {}) {
  const { opportunity: oppOver, ...rest } = over;
  return {
    skills: SKILLS,
    goals: [goal({})],
    semanticSimilarity: 0.8,
    minDealValue: 500,
    capacityMode: 'deep' as const,
    now: NOW,
    ...rest,
    opportunity: {
      type: 'client' as const,
      title: 'WhatsApp booking build for an agency client',
      value_amount: 1800,
      value_kind: 'fixed' as const,
      effort_hours: 10,
      required_skills: ['n8n', 'whatsapp-api'],
      deadline_at: null,
      posted_at: NOW.toISOString(),
      ...((oppOver as object) ?? {}),
    },
  };
}

console.log('\n🧪 Weights sum to 1');
{
  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  assert(Math.abs(total - 1) < 1e-9, `weights total ${total}`);
}

console.log('\n🧪 A well-matched, well-paid, goal-closing job scores high');
{
  const { score, breakdown } = scoreOpportunity(baseInput() as never);
  assert(score >= 80, `score ${score} >= 80`);
  assert(breakdown.matchedSkills.length === 2, `matched both skills: ${breakdown.matchedSkills.join(',')}`);
  assert(breakdown.missingSkills.length === 0, 'no missing skills');
  assert(breakdown.notes.length > 0, `${breakdown.notes.length} reasoning notes recorded`);
}

console.log('\n🧪 Scoring is deterministic');
{
  const a = scoreOpportunity(baseInput() as never);
  const b = scoreOpportunity(baseInput() as never);
  assert(a.score === b.score, `${a.score} === ${b.score}`);
  assert(JSON.stringify(a.breakdown) === JSON.stringify(b.breakdown), 'identical breakdown');
}

console.log('\n🧪 Missing skills drag the score down');
{
  const withGap = scoreOpportunity(
    baseInput({ opportunity: { required_skills: ['voice-ai-intake', 'n8n'] } }) as never,
  );
  const full = scoreOpportunity(baseInput() as never);
  assert(withGap.score < full.score, `${withGap.score} < ${full.score}`);
  assert(withGap.breakdown.missingSkills.includes('voice-ai-intake'), 'names the missing skill');
}

console.log('\n🧪 Work below the rate floor is penalised, not just ranked lower');
{
  const cheap = scoreOpportunity(baseInput({ opportunity: { value_amount: 150 } }) as never);
  assert(cheap.breakdown.valueFit < 0.2, `valueFit ${cheap.breakdown.valueFit} < 0.2`);
  assert(
    cheap.breakdown.notes.some((n) => n.includes('below your')),
    'explains the floor in plain language',
  );
}

console.log('\n🧪 A passed deadline zeroes urgency');
{
  const stale = scoreOpportunity(
    baseInput({ opportunity: { deadline_at: '2026-09-01T00:00:00Z' } }) as never,
  );
  assert(stale.breakdown.urgency === 0, `urgency ${stale.breakdown.urgency}`);
}

console.log('\n🧪 Short runway lifts cash work');
{
  const bigGoal = goal({ target_value: 8000, current_value: 1500 });
  const runway = goal({
    key: 'runway', kind: 'runway', label: 'Runway',
    current_value: 4.2, target_value: null, unit: 'months', period: 'none',
  });
  const calm = scoreOpportunity(baseInput({ goals: [bigGoal] }) as never);
  const tight = scoreOpportunity(baseInput({ goals: [bigGoal, runway] }) as never);
  assert(tight.breakdown.goalAlignment > calm.breakdown.goalAlignment,
    `${tight.breakdown.goalAlignment} > ${calm.breakdown.goalAlignment}`);
}

console.log('\n🧪 The base score is capacity-neutral; capacity only adjusts');
{
  const deep = scoreOpportunity(baseInput({ capacityMode: 'deep' }) as never);
  const low = scoreOpportunity(baseInput({ capacityMode: 'low' }) as never);
  assert(deep.score === low.score, `stored score unchanged: ${deep.score} === ${low.score}`);
  assert(low.adjustedScore < deep.adjustedScore, `adjusted ${low.adjustedScore} < ${deep.adjustedScore}`);
  assert(low.adjustedScore > 0, 'big work is demoted, never hidden');
}

console.log('\n🧪 Capacity fit');
{
  assert(capacityForMinutes(20) === 'low', '20 min → low');
  assert(capacityForMinutes(45) === 'moderate', '45 min → moderate');
  assert(capacityForMinutes(180) === 'deep', '180 min → deep');
  assert(capacityFit('low', 'deep') === 1, 'light work fits a deep session');
  assert(capacityFit('deep', 'low') < 0.5, 'deep work in a low state is heavily demoted');
}

console.log('\n🧪 Re-ranking for capacity is a stable re-sort');
{
  const items = [
    { id: 'deep-big', score: 92, capacity_fit: 'deep' as const },
    { id: 'quick-admin', score: 61, capacity_fit: 'low' as const },
  ];
  const inDeep = rerankForCapacity(items, 'deep');
  const inLow = rerankForCapacity(items, 'low');
  assert(inDeep[0].id === 'deep-big', 'deep focus surfaces the $1,800 build first');
  assert(inLow[0].id === 'quick-admin', 'low energy surfaces the 30-minute task first');
  assert(inLow.length === items.length, 'nothing is dropped, only reordered');
}

console.log('\n🧪 Plan fitting respects the minute budget');
{
  const plan = fitPlanToCapacity(
    [
      { title: 'one-pager', estimated_minutes: 90, score: 80 },
      { title: 'reply', estimated_minutes: 15, score: 70 },
      { title: 'intro dm', estimated_minutes: 10, score: 60 },
      { title: 'deep refactor', estimated_minutes: 240, score: 95 },
    ],
    'low',
  );
  const spent = plan.reduce((n, p) => n + (p.estimated_minutes ?? 0), 0);
  assert(spent <= CAPACITY.low.budgetMinutes * 1.25, `${spent} min within low-energy budget`);
  assert(plan.length >= 1, 'always returns at least one thing to do');
}

console.log('\n🧪 Confidence rises with connected context, never hits certainty');
{
  const cold = scoreConfidence({ connectedSources: 0, hasPositioning: false, declaredSkills: 0, taggedRequirements: false });
  const warm = scoreConfidence({ connectedSources: 3, hasPositioning: true, declaredSkills: 6, taggedRequirements: true });
  assert(cold < 0.4, `cold start ${cold} < 0.4`);
  assert(warm > cold, `${warm} > ${cold}`);
  assert(warm <= 0.95, `capped at 0.95, got ${warm}`);
}

console.log(process.exitCode ? '\n❌ Failures above\n' : '\n✅ All Foundation scoring tests passed\n');
