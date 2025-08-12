// src/lib/playbooks/b2bOutbound.js
// Tiny helper module for B2B outbound micro-offer

export function buildMicroOfferAudit(intake) {
  const niche = intake.vertical || 'your business';
  return {
    subject: `Quick ${niche} audit?`,
    body: `Hi {{name}},\n\nI put together a 3-point ${niche} growth audit with 1 fix you can ship this week.\nHappy to send it over—worth a quick look?\n\n– {{sender}}`,
  };
}


