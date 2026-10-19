import { aggregatePromotionHealth, diagnosePromotionHealth } from '../src/modules/operations/promotion-health';

describe('promotion health diagnostics', () => {
  it('aggregates platform metrics and reports a healthy account', () => {
    const current = aggregatePromotionHealth([
      { spend: 300, impressions: 20_000, clicks: 500, leads: 3, validLeads: 2 },
      { spend: 200, impressions: 10_000, clicks: 250, leads: 2, validLeads: 2 },
    ]);
    const previous = aggregatePromotionHealth([{ spend: 450, impressions: 25_000, clicks: 600, leads: 4, validLeads: 3 }]);
    const result = diagnosePromotionHealth(current, previous, 2);

    expect(current).toMatchObject({ spend: 500, impressions: 30_000, clicks: 750, leads: 5, validLeads: 4, costPerLead: 100 });
    expect(result.status).toBe('HEALTHY');
    expect(result.score).toBe(100);
  });

  it('flags high cost, low valid rate and deteriorating conversion performance', () => {
    const current = aggregatePromotionHealth([{ spend: 1200, impressions: 20_000, clicks: 400, leads: 3, validLeads: 1 }]);
    const previous = aggregatePromotionHealth([{ spend: 600, impressions: 20_000, clicks: 400, leads: 6, validLeads: 4 }]);
    const result = diagnosePromotionHealth(current, previous, 7);

    expect(result.status).toBe('RISK');
    expect(result.issues.map((item) => item.key)).toEqual(expect.arrayContaining(['CVR_DECLINE', 'HIGH_CPA', 'CPA_RISE', 'LOW_VALID_RATE']));
  });

  it('does not invent a score when the selected period has no delivery data', () => {
    const empty = aggregatePromotionHealth([]);
    const result = diagnosePromotionHealth(empty, empty, 0);

    expect(result.status).toBe('INSUFFICIENT');
    expect(result.score).toBeNull();
    expect(result.issues[0].key).toBe('NO_DATA');
  });
});
