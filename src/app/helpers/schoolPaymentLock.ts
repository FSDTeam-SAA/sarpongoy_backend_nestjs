// Pending checkout attempts and failed payments must not freeze school pricing.
export const LOCKED_SCHOOL_PAYMENT_STATUSES = ['offline_pending', 'completed', 'refunded'];

export function hasLockedSchoolPayments(payments: Array<{ status: string }>) {
  return payments.some((payment) => LOCKED_SCHOOL_PAYMENT_STATUSES.includes(payment.status));
}

export function getLockedSchoolTermIds(terms: Array<{ termId: string }>, payments: Array<{ status: string; termId?: string; paymentPlan?: string }>) {
  const aliases: Record<string, string> = { first_term: 'term_1', second_term: 'term_2', third_term: 'term_3' };
  const ids = new Set<string>();
  for (const payment of payments) {
    if (!LOCKED_SCHOOL_PAYMENT_STATUSES.includes(payment.status)) continue;
    const plan = payment.termId || payment.paymentPlan;
    if (!plan || plan === 'full_year') { terms.forEach(term => ids.add(term.termId)); continue; }
    ids.add(terms.some(term => term.termId === plan) ? plan : aliases[plan] || plan);
  }
  return [...ids];
}
