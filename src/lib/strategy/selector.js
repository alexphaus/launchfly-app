// src/lib/strategy/selector.js
// Minimal, explainable selector v0 (heuristic): choose one of two playbooks

/**
 * @typedef {Object} Intake
 * @property {string} vertical
 * @property {string} geo
 * @property {number} budget
 * @property {Object} assets
 */

/**
 * @typedef {Object} StrategyPlan
 * @property {string} playbook
 * @property {Array} channels
 * @property {Object} kpis
 * @property {Array<string>} rationale
 */

/**
 * @param {Intake} intake
 * @returns {StrategyPlan}
 */
export function selectPlan(intake = {}) {
  const vertical = (intake.vertical || '').toLowerCase();
  const isLocal = ['plumber', 'roofer', 'dentist', 'spa', 'yoga', 'chiro', 'cleaning'].some((v) =>
    vertical.includes(v)
  );
  const hasBudget = Number(intake.budget || 0) >= 150;

  if (isLocal) {
    return {
      playbook: 'LocalSearch',
      channels: [
        { name: 'Search', cap: hasBudget ? 50 : 25, stopLoss: 35 },
        { name: 'Outreach', cap: 25, stopLoss: 0 }, // emails/day
      ],
      kpis: { minReply: 0.03, maxCPA: 35 },
      rationale: ['Local intent is high; GBP + quick win'],
    };
  }

  return {
    playbook: 'B2BOutbound',
    channels: [{ name: 'Outreach', cap: 25, stopLoss: 0 }],
    kpis: { minReply: 0.05 },
    rationale: ['High ACV, narrow ICP → outbound beats paid early'],
  };
}


