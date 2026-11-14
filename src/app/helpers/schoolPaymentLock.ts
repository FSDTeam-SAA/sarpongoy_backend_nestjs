// Pending checkout attempts and failed payments must not freeze school pricing.
export const LOCKED_SCHOOL_PAYMENT_STATUSES = ['offline_pending', 'completed', 'refunded'];

export function hasLockedSchoolPayments(payments: Array<{ status: string }>) {
  return payments.some((payment) => LOCKED_SCHOOL_PAYMENT_STATUSES.includes(payment.status));
}
