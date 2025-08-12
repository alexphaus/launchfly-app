// src/lib/playbooks/localSearch.js
// Tiny helper module for Local Search quick wins

export function buildLocalAdKit(intake) {
  const geo = intake.geo || 'your area';
  const vertical = intake.vertical || 'Local Service';
  return {
    headlines: [
      `${vertical} Near You`,
      `Top-Rated ${vertical} in ${geo}`,
      `Book ${vertical} Today`,
    ],
    descriptions: [
      `Fast, reliable ${vertical.toLowerCase()} in ${geo}. Book now.`,
      `Transparent pricing. 5-star reviews. Serving ${geo}.`,
    ],
    keywords: [`${vertical} ${geo}`, `${vertical} near me`, `${vertical} price`],
  };
}

export function getGBPQuickWinCopy(intake) {
  const vertical = intake.vertical || 'Local Service';
  return {
    description: `Trusted ${vertical.toLowerCase()} with fast booking and 5★ service.`,
    post: `New to ${intake.geo || 'town'}? Get 10% off your first ${vertical.toLowerCase()} session this week. Book now!`,
  };
}


